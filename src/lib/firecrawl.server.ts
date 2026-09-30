/**
 * CDS — Firecrawl (recherche web et lecture de pages), côté serveur uniquement.
 *
 * Clé en secret d'environnement, jamais en base ni dans le code :
 * - FIRECRAWL_API_KEY commençant par « fc- » : API Firecrawl directe (compte Firecrawl) ;
 * - sinon, connecteur Firecrawl de Lovable : FIRECRAWL_API_KEY (clé du connecteur) + LOVABLE_API_KEY.
 * Sans clé : la recherche est indisponible et la lecture d'une page se fait par simple requête.
 */

const DIRECT = "https://api.firecrawl.dev/v2";
const GATEWAY = "https://connector-gateway.lovable.dev/firecrawl/v2";

export function firecrawlMode(): "direct" | "lovable" | "absent" {
  const key = process.env["FIRECRAWL_API_KEY"] ?? "";
  if (!key) return "absent";
  if (key.startsWith("fc-")) return "direct";
  return process.env["LOVABLE_API_KEY"] ? "lovable" : "absent";
}

async function call(path: string, body: unknown) {
  const mode = firecrawlMode();
  const key = process.env["FIRECRAWL_API_KEY"] ?? "";
  if (mode === "absent")
    throw new Error("Firecrawl n'est pas configuré (secret FIRECRAWL_API_KEY).");
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (mode === "direct") headers["Authorization"] = `Bearer ${key}`;
  else {
    headers["Authorization"] = `Bearer ${process.env["LOVABLE_API_KEY"]}`;
    headers["X-Connection-Api-Key"] = key;
  }
  const response = await fetch(`${mode === "direct" ? DIRECT : GATEWAY}${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(60_000),
  });
  const text = await response.text();
  if (!response.ok) {
    // Jamais la clé dans le message : seulement le code et le début de la réponse.
    throw new Error(`Firecrawl a répondu ${response.status} : ${text.slice(0, 200)}`);
  }
  return JSON.parse(text) as Record<string, unknown>;
}

export type SearchResult = { url?: string; title?: string; description?: string };

export async function firecrawlSearch(query: string, limit: number): Promise<SearchResult[]> {
  const json = await call("/search", { query, limit, sources: ["web"] });
  const data = (json["data"] ?? {}) as Record<string, unknown>;
  const web = Array.isArray(data["web"])
    ? data["web"]
    : Array.isArray(json["data"])
      ? json["data"]
      : [];
  return web as SearchResult[];
}

export type ScrapeResult = {
  html: string;
  markdown: string;
  screenshot: string | null;
  metadata: Record<string, unknown>;
};

export async function firecrawlScrape(url: string): Promise<ScrapeResult> {
  const request = (formats: string[], timeout: number) =>
    call("/scrape", {
      url,
      formats,
      onlyMainContent: false,
      waitFor: 1200,
      timeout,
      blockAds: true,
    });
  let json: Record<string, unknown>;
  try {
    json = await request(["markdown", "rawHtml", "screenshot"], 40_000);
  } catch {
    // La capture d'écran est la partie la plus lente : nouvel essai sans capture.
    json = await request(["markdown", "rawHtml"], 25_000);
  }
  const data = (json["data"] as Record<string, unknown> | undefined) ?? json;
  return {
    html: String(data["rawHtml"] ?? data["html"] ?? ""),
    markdown: String(data["markdown"] ?? ""),
    screenshot: typeof data["screenshot"] === "string" ? data["screenshot"] : null,
    metadata: (data["metadata"] as Record<string, unknown> | undefined) ?? {},
  };
}
