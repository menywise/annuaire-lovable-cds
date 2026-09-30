/**
 * CDS — Module « Veille de sites » : le travail réseau, côté serveur uniquement.
 * Appelé par l'admin (fonctions serveur), les agents (/api/hooks/veille) et la tâche planifiée
 * (/api/cron/veille). Écrit en base avec la clé de service : chaque point d'entrée vérifie
 * l'identité AVANT d'appeler ce fichier.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { firecrawlMode, firecrawlScrape, firecrawlSearch } from "@/lib/firecrawl.server";
import { assertPublicUrl, isPublicHost } from "@/lib/url-guard";
import {
  MAX_HTML,
  WATCH_SETTINGS_KEY,
  availability,
  decide,
  detectFonts,
  evaluateDetectors,
  frenchScore,
  htmlLanguage,
  networkScore,
  normalizeSiteUrl,
  normalizeWatchSettings,
  pageMeta,
  pathsToProbe,
  textFromHtml,
  type DetectionInput,
  type PathProbe,
  type WatchDetector,
} from "@/lib/watch";

const USER_AGENT = "CDS-veille/1.0 (+veille de sites)";
/** Un passage (tâche planifiée, agent) ne dépasse pas ce temps : le reste attend le suivant. */
const BUDGET_MS = 100_000;
/** Un domaine refusé n'est pas réanalysé par la recherche avant ce délai. */
const REJECT_COOLDOWN_DAYS = 30;

export type WatchSource = "manuel" | "recherche" | "source" | "agent" | "proposition";

export async function loadWatchSettings() {
  const { data } = await supabaseAdmin
    .from("site_settings")
    .select("value")
    .eq("key", WATCH_SETTINGS_KEY)
    .maybeSingle();
  return normalizeWatchSettings(data?.value);
}

async function loadDetectors(): Promise<WatchDetector[]> {
  const { data } = await supabaseAdmin
    .from("watch_detectors")
    .select("code, name, kind, target, selector, pattern, weight")
    .eq("enabled", true)
    .order("code");
  return (data ?? []) as WatchDetector[];
}

/**
 * Requête vers un site visité. Les redirections sont suivies à la main (5 au plus) et chaque
 * étape repasse la garde d'adresse : un site public ne peut pas renvoyer le serveur vers une
 * adresse interne.
 */
async function request(url: string, method: "HEAD" | "GET", timeoutMs: number) {
  const signal = AbortSignal.timeout(timeoutMs);
  let current = new URL(url);
  for (let hop = 0; hop <= 5; hop += 1) {
    assertPublicUrl(current);
    const res = await fetch(current, {
      method,
      redirect: "manual",
      signal,
      headers: { "user-agent": USER_AGENT, accept: "text/html,*/*" },
    });
    const location = res.headers.get("location");
    if (res.status < 300 || res.status >= 400 || !location) return res;
    await res.body?.cancel().catch(() => undefined);
    current = new URL(location, current);
  }
  throw new Error("Trop de redirections.");
}

/** Corps de réponse lu dans la limite de MAX_HTML octets (jamais une page entière en mémoire). */
async function readCapped(res: Response) {
  const reader = res.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (size < MAX_HTML) {
    const { done, value } = await reader.read();
    if (done || !value) break;
    chunks.push(value);
    size += value.byteLength;
  }
  await reader.cancel().catch(() => undefined);
  const all = new Uint8Array(Math.min(size, MAX_HTML));
  let offset = 0;
  for (const chunk of chunks) {
    const part = chunk.subarray(0, Math.max(0, all.length - offset));
    all.set(part, offset);
    offset += part.byteLength;
    if (offset >= all.length) break;
  }
  return new TextDecoder().decode(all);
}

/** Page d'accueil (en-têtes, code, temps de réponse) et chemins des règles « path ». */
async function probeNetwork(url: string, detectors: WatchDetector[]) {
  const start = Date.now();
  let root = await request(url, "HEAD", 8000).catch(() => null);
  // Certains serveurs refusent HEAD : nouvel essai en GET.
  if (!root || root.status === 405 || root.status === 501) {
    root = await request(url, "GET", 10_000).catch(() => null);
    await root?.body?.cancel().catch(() => undefined);
  }
  const ttfbMs = root ? Date.now() - start : null;
  const headers: Record<string, string> = {};
  root?.headers.forEach((value, name) => {
    headers[name.toLowerCase()] = value;
  });
  const base = url.replace(/\/+$/, "");
  const paths: Record<string, PathProbe> = {};
  await Promise.all(
    pathsToProbe(detectors).map(async (path) => {
      const res = await request(`${base}${path}`, "HEAD", 5000).catch(() => null);
      paths[path] = { ok: Boolean(res?.ok), contentType: res?.headers.get("content-type") ?? "" };
    }),
  );
  return { httpStatus: root?.status ?? null, ttfbMs, headers, paths };
}

/** Lecture directe de la page quand Firecrawl n'est pas configuré. */
async function fetchHtml(url: string) {
  const res = await request(url, "GET", 12_000);
  return readCapped(res);
}

export type AnalysisResult = {
  url: string;
  host: string;
  decision: "retenu" | "refuse" | "erreur";
  reason: string | null;
  score: number | null;
  message: string;
  siteId?: string;
  stack?: string[];
};

async function logReject(row: {
  host: string;
  url: string;
  reason: string;
  score?: number | null;
  detail?: Record<string, unknown>;
  source: WatchSource;
  sourceQuery?: string | null | undefined;
}) {
  await supabaseAdmin.from("watch_rejects").insert({
    host: row.host,
    url: row.url,
    reason: row.reason,
    score: row.score ?? null,
    detail: (row.detail ?? {}) as never,
    source: row.source,
    source_query: row.sourceQuery ?? null,
  });
}

/**
 * Analyse une adresse : garde d'adresse, relevé réseau, préfiltre, lecture de la page,
 * règles de détection, langue, portiers ; enregistre le site retenu ou le refus motivé.
 */
export async function analyzeSite(input: {
  url: string;
  source: WatchSource;
  sourceQuery?: string | null;
  submittedBy?: string | null;
  force?: boolean;
  fallbackTitle?: string;
  fallbackDescription?: string;
}): Promise<AnalysisResult> {
  let host = input.url.slice(0, 120);
  let url = input.url;
  try {
    const normalized = normalizeSiteUrl(input.url);
    assertPublicUrl(normalized.parsed);
    host = normalized.host;
    url = normalized.url;
  } catch (error) {
    return {
      url: input.url,
      host,
      decision: "refuse",
      reason: "adresse",
      score: null,
      message: error instanceof Error ? error.message : "Adresse invalide",
    };
  }

  try {
    const [settings, detectors] = await Promise.all([loadWatchSettings(), loadDetectors()]);
    const network = await probeNetwork(url, detectors);
    if (network.httpStatus === null) {
      await logReject({
        host,
        url,
        reason: "erreur",
        source: input.source,
        sourceQuery: input.sourceQuery,
        detail: { motif: "Site injoignable" },
      });
      return {
        url,
        host,
        decision: "erreur",
        reason: "erreur",
        score: null,
        message: "Site injoignable.",
      };
    }

    const empty: DetectionInput = { html: "", headers: network.headers, paths: network.paths };
    const prefilter = networkScore(detectors, empty);
    if (
      !input.force &&
      settings.prefilter_min_score > 0 &&
      prefilter < settings.prefilter_min_score
    ) {
      await logReject({
        host,
        url,
        reason: "prefiltre",
        score: prefilter,
        source: input.source,
        sourceQuery: input.sourceQuery,
        detail: { score_reseau: prefilter },
      });
      return {
        url,
        host,
        decision: "refuse",
        reason: "prefiltre",
        score: prefilter,
        message: `Écarté au préfiltre réseau : ${prefilter}/${settings.prefilter_min_score}`,
      };
    }

    // Lecture de la page : Firecrawl si configuré (rendu complet, capture), sinon requête simple.
    let html = "";
    let markdown = "";
    let screenshot: string | null = null;
    let metaLanguage = "";
    let metaTitle = "";
    let metaDescription = "";
    if (firecrawlMode() !== "absent") {
      const scrape = await firecrawlScrape(url);
      html = scrape.html.slice(0, MAX_HTML);
      markdown = scrape.markdown;
      screenshot = scrape.screenshot;
      const lang = scrape.metadata["language"];
      metaLanguage = String(Array.isArray(lang) ? (lang[0] ?? "") : (lang ?? "")).toLowerCase();
      metaTitle = typeof scrape.metadata["title"] === "string" ? scrape.metadata["title"] : "";
      metaDescription =
        typeof scrape.metadata["description"] === "string" ? scrape.metadata["description"] : "";
    } else {
      html = await fetchHtml(url);
    }
    const meta = pageMeta(html);
    const title = (metaTitle || meta.title || input.fallbackTitle || host).slice(0, 300);
    const description = (
      metaDescription ||
      meta.description ||
      input.fallbackDescription ||
      ""
    ).slice(0, 1000);
    const languageMeta = metaLanguage || htmlLanguage(html);
    const text = `${title} ${description} ${(markdown || textFromHtml(html)).slice(0, 8000)}`;
    const languageScore = frenchScore(text);

    const detection = evaluateDetectors(detectors, {
      html,
      headers: network.headers,
      paths: network.paths,
    });
    const fonts = detectFonts(html);
    const verdict = decide(settings, {
      score: detection.score,
      languageMeta,
      languageScore,
      force: input.force === true,
    });

    if (!verdict.accepted) {
      // Dossier complet conservé : un refus reste exploitable sans nouvelle lecture payante.
      await logReject({
        host,
        url,
        reason: verdict.reason,
        score: detection.score,
        source: input.source,
        sourceQuery: input.sourceQuery,
        detail: {
          motif: verdict.message,
          empreintes: detection.matched,
          langue: { declaree: languageMeta || null, score: languageScore },
          technologies: detection.stack.map((t) => t.name),
          titre: title.slice(0, 120),
        },
      });
      return {
        url,
        host,
        decision: "refuse",
        reason: verdict.reason,
        score: detection.score,
        message: verdict.message,
        stack: detection.stack.map((t) => t.name),
      };
    }

    const now = new Date().toISOString();
    const { data: site, error } = await supabaseAdmin
      .from("watch_sites")
      .upsert(
        {
          host,
          url,
          title,
          description,
          language: languageMeta || null,
          language_score: languageScore,
          gate_score: detection.score,
          gate_detail: detection.matched as never,
          stack: detection.stack as never,
          fonts,
          screenshot_url: screenshot,
          source: input.source,
          source_query: input.sourceQuery ?? null,
          ...(input.submittedBy ? { submitted_by: input.submittedBy } : {}),
          last_analyzed_at: now,
        },
        { onConflict: "host" },
      )
      .select("id")
      .single();
    if (error || !site)
      throw new Error(`Enregistrement impossible : ${error?.message ?? "inconnu"}`);
    await supabaseAdmin.rpc("watch_record_check", {
      _site_id: site.id,
      _status: availability(network.httpStatus),
      _http: network.httpStatus,
      _ttfb: network.ttfbMs,
    });
    return {
      url,
      host,
      decision: "retenu",
      reason: null,
      score: detection.score,
      message: input.force ? "Retenu (ajout forcé)." : "Retenu.",
      siteId: site.id,
      stack: detection.stack.map((t) => t.name),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 300) : "Analyse impossible";
    await logReject({
      host,
      url,
      reason: "erreur",
      source: input.source,
      sourceQuery: input.sourceQuery,
      detail: { motif: message },
    }).catch(() => undefined);
    return { url, host, decision: "erreur", reason: "erreur", score: null, message };
  }
}

/** Analyse plusieurs adresses, deux à la fois, dans le budget de temps. */
export async function analyzeMany(
  urls: string[],
  options: {
    source: WatchSource;
    force?: boolean;
    submittedBy?: string | null;
    sourceQuery?: string | null;
  },
) {
  const queue = [...urls];
  const results: AnalysisResult[] = [];
  const started = Date.now();
  const worker = async () => {
    while (queue.length > 0 && Date.now() - started < BUDGET_MS) {
      const url = queue.shift();
      if (!url) return;
      results.push(await analyzeSite({ url, ...options }));
    }
  };
  await Promise.all([worker(), worker()]);
  return { results, postponed: queue };
}

/** Contrôle de disponibilité des sites vérifiés depuis le plus longtemps. */
export async function checkSites(limit: number) {
  const { data: sites, error } = await supabaseAdmin
    .from("watch_sites")
    .select("id, url")
    .order("last_checked_at", { ascending: true, nullsFirst: true })
    .limit(Math.max(0, Math.min(limit, 60)));
  if (error) throw new Error(error.message);
  const started = Date.now();
  const results: Array<{ url: string; status: string }> = [];
  for (const site of sites ?? []) {
    if (Date.now() - started > BUDGET_MS) break;
    const t0 = Date.now();
    const res = await request(site.url, "GET", 12_000).catch(() => null);
    await res?.body?.cancel().catch(() => undefined);
    const status = availability(res?.status ?? null);
    await supabaseAdmin.rpc("watch_record_check", {
      _site_id: site.id,
      _status: status,
      _http: res?.status ?? null,
      _ttfb: res ? Date.now() - t0 : null,
    });
    results.push({ url: site.url, status });
  }
  return {
    checked: results.length,
    hors_ligne: results.filter((r) => r.status === "hors_ligne").length,
    results,
  };
}

/** Recherche web, puis analyse des domaines encore inconnus (ni retenus, ni refusés récemment). */
export async function discover(input: { query: string; limit: number; sourceId?: string }) {
  const found = await firecrawlSearch(input.query, input.limit);
  const candidates = new Map<string, { url: string; title: string; description: string }>();
  for (const result of found) {
    if (!result.url) continue;
    try {
      const host = new URL(result.url).hostname.toLowerCase();
      if (!isPublicHost(host) || candidates.has(host)) continue;
      candidates.set(host, {
        url: `https://${host}`,
        title: result.title ?? "",
        description: result.description ?? "",
      });
    } catch {
      continue;
    }
  }
  const hosts = [...candidates.keys()];
  let fresh = hosts;
  if (hosts.length) {
    const since = new Date(Date.now() - REJECT_COOLDOWN_DAYS * 86_400_000).toISOString();
    const [{ data: known }, { data: rejected }] = await Promise.all([
      supabaseAdmin.from("watch_sites").select("host").in("host", hosts),
      supabaseAdmin.from("watch_rejects").select("host").in("host", hosts).gte("created_at", since),
    ]);
    const skip = new Set([...(known ?? []), ...(rejected ?? [])].map((r) => r.host));
    fresh = hosts.filter((h) => !skip.has(h));
  }
  const source: WatchSource = input.sourceId ? "source" : "recherche";
  const queue = [...fresh];
  const results: AnalysisResult[] = [];
  const started = Date.now();
  const worker = async () => {
    while (queue.length > 0 && Date.now() - started < BUDGET_MS) {
      const host = queue.shift();
      if (!host) return;
      const c = candidates.get(host)!;
      results.push(
        await analyzeSite({
          url: c.url,
          source,
          sourceQuery: input.query,
          fallbackTitle: c.title,
          fallbackDescription: c.description,
        }),
      );
    }
  };
  await Promise.all([worker(), worker()]);
  const added = results.filter((r) => r.decision === "retenu").length;
  if (input.sourceId) {
    const { data: row } = await supabaseAdmin
      .from("watch_sources")
      .select("run_count, found_count")
      .eq("id", input.sourceId)
      .maybeSingle();
    await supabaseAdmin
      .from("watch_sources")
      .update({
        last_run_at: new Date().toISOString(),
        run_count: (row?.run_count ?? 0) + 1,
        found_count: (row?.found_count ?? 0) + added,
      })
      .eq("id", input.sourceId);
  }
  return {
    query: input.query,
    found: hosts.length,
    new: fresh.length,
    added,
    results,
    postponed: queue,
  };
}

/** Sources actives les plus anciennes, dans le budget de temps. */
export async function runDueSources(maxSources: number, limit: number) {
  if (maxSources <= 0) return [];
  const { data, error } = await supabaseAdmin
    .from("watch_sources")
    .select("id, query")
    .eq("enabled", true)
    .order("last_run_at", { ascending: true, nullsFirst: true })
    .limit(Math.min(maxSources, 10));
  if (error) throw new Error(error.message);
  const runs = [];
  const started = Date.now();
  for (const source of data ?? []) {
    if (Date.now() - started > BUDGET_MS) break;
    runs.push(await discover({ query: source.query, limit, sourceId: source.id }));
  }
  return runs;
}

/** File des propositions des membres, les plus anciennes d'abord. */
export async function processSubmissions(limit: number) {
  if (limit <= 0) return { processed: 0, results: [] as AnalysisResult[] };
  const { data, error } = await supabaseAdmin
    .from("watch_submissions")
    .select("id, url, host, submitted_by")
    .eq("status", "en_attente")
    .order("created_at", { ascending: true })
    .limit(Math.min(limit, 10));
  if (error) throw new Error(error.message);
  const results: AnalysisResult[] = [];
  const started = Date.now();
  for (const item of data ?? []) {
    if (Date.now() - started > BUDGET_MS) break;
    const { data: known } = await supabaseAdmin
      .from("watch_sites")
      .select("id")
      .eq("host", item.host)
      .maybeSingle();
    const result: AnalysisResult = known
      ? {
          url: item.url,
          host: item.host,
          decision: "retenu",
          reason: null,
          score: null,
          message: "Déjà suivi par la veille.",
          siteId: known.id,
        }
      : await analyzeSite({ url: item.url, source: "proposition", submittedBy: item.submitted_by });
    results.push(result);
    await supabaseAdmin
      .from("watch_submissions")
      .update({
        status:
          result.decision === "retenu"
            ? "acceptee"
            : result.decision === "refuse"
              ? "refusee"
              : "erreur",
        result: {
          decision: result.decision,
          motif: result.reason,
          message: result.message,
        } as never,
        processed_at: new Date().toISOString(),
      })
      .eq("id", item.id);
  }
  return { processed: results.length, results };
}

/** Passage planifié : propositions, sources, contrôles, selon les volumes réglés en admin. */
export async function runScheduled() {
  const settings = await loadWatchSettings();
  const submissions = await processSubmissions(settings.submissions_per_run);
  const sources =
    firecrawlMode() === "absent"
      ? []
      : await runDueSources(settings.sources_per_run, settings.search_limit);
  const checks = await checkSites(settings.checks_per_run);
  return {
    propositions: submissions.processed,
    sources: sources.map((s) => ({ requete: s.query, trouves: s.found, retenus: s.added })),
    controles: checks.checked,
    hors_ligne: checks.hors_ligne,
  };
}

/** État d'un domaine pour un agent : suivi, refusé (motifs), proposé. */
export async function domainState(input: string) {
  const { host } = normalizeSiteUrl(input);
  const [site, rejects, submissions] = await Promise.all([
    supabaseAdmin
      .from("watch_sites")
      .select(
        "host, status, gate_score, stack, last_checked_at, last_analyzed_at, source, listing_id",
      )
      .eq("host", host)
      .maybeSingle(),
    supabaseAdmin
      .from("watch_rejects")
      .select("reason, score, created_at, detail")
      .eq("host", host)
      .order("created_at", { ascending: false })
      .limit(10),
    supabaseAdmin
      .from("watch_submissions")
      .select("status, created_at, processed_at")
      .eq("host", host)
      .order("created_at", { ascending: false })
      .limit(5),
  ]);
  return {
    host,
    suivi: Boolean(site.data),
    site: site.data ?? null,
    refus: rejects.data ?? [],
    propositions: submissions.data ?? [],
  };
}

/** Règles et seuils appliqués : ce qu'un agent doit savoir pour proposer des sites utiles. */
export async function catalogue() {
  const [settings, detectors] = await Promise.all([loadWatchSettings(), loadDetectors()]);
  const fingerprints = detectors.filter((d) => d.weight > 0);
  let hash = 5381;
  for (const line of [
    ...fingerprints.map((d) => `${d.code}:${d.weight}`),
    `seuil:${settings.gate_min_score}`,
  ]) {
    for (let i = 0; i < line.length; i += 1) hash = ((hash << 5) + hash + line.charCodeAt(i)) >>> 0;
  }
  return {
    version: hash.toString(16).padStart(8, "0"),
    reglages: settings,
    empreintes: fingerprints.map((d) => ({
      code: d.code,
      cible: d.target,
      selecteur: d.selector || null,
      poids: d.weight,
    })),
    technologies: [...new Set(detectors.filter((d) => d.weight === 0).map((d) => d.name))],
    firecrawl: firecrawlMode(),
  };
}
