/**
 * CDS — Module « Veille de sites » : règles pures (sans réseau ni base), partagées par le
 * serveur, l'admin et les tests. Reprises de la veille de l'annuaire des sites, rendues
 * génériques : les règles de détection et les seuils viennent de la base.
 */

export const WATCH_SETTINGS_KEY = "watch";

export type WatchSettings = {
  /** Score d'empreinte minimal pour retenir un site (0 = tout accepter). */
  gate_min_score: number;
  /** Score réseau minimal avant le scrape payant (0 = pas de préfiltre). */
  prefilter_min_score: number;
  /** Langue attendue (« fr ») ou null pour ne pas filtrer. */
  language: "fr" | null;
  min_language_score: number;
  search_limit: number;
  sources_per_run: number;
  checks_per_run: number;
  submissions_per_run: number;
};

export const defaultWatchSettings: WatchSettings = {
  gate_min_score: 0,
  prefilter_min_score: 0,
  language: "fr",
  min_language_score: 45,
  search_limit: 8,
  sources_per_run: 2,
  checks_per_run: 25,
  submissions_per_run: 5,
};

function bounded(value: unknown, min: number, max: number, fallback: number) {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isInteger(n) && n >= min && n <= max ? n : fallback;
}

/** Réglages lus en base : valeurs hors bornes ramenées aux valeurs par défaut. */
export function normalizeWatchSettings(value: unknown): WatchSettings {
  const raw = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
  const d = defaultWatchSettings;
  return {
    gate_min_score: bounded(raw["gate_min_score"], 0, 500, d.gate_min_score),
    prefilter_min_score: bounded(raw["prefilter_min_score"], 0, 500, d.prefilter_min_score),
    language: raw["language"] === null || raw["language"] === "" ? null : "fr",
    min_language_score: bounded(raw["min_language_score"], 0, 100, d.min_language_score),
    search_limit: bounded(raw["search_limit"], 1, 20, d.search_limit),
    sources_per_run: bounded(raw["sources_per_run"], 0, 10, d.sources_per_run),
    checks_per_run: bounded(raw["checks_per_run"], 0, 60, d.checks_per_run),
    submissions_per_run: bounded(raw["submissions_per_run"], 0, 10, d.submissions_per_run),
  };
}

// Adresses -------------------------------------------------------------------------------------------

/** « Exemple.fr/page » → https://exemple.fr. La garde d'adresse est appliquée par le serveur. */
export function normalizeSiteUrl(input: string) {
  const trimmed = input.trim();
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  const parsed = new URL(withScheme);
  const host = parsed.hostname.toLowerCase().replace(/\.$/, "");
  return { parsed, host, url: `https://${host}` };
}

// Règles de détection -------------------------------------------------------------------------------

export type WatchDetector = {
  code: string;
  name: string;
  kind: string;
  target: "html" | "header" | "path";
  selector: string;
  pattern: string;
  weight: number;
};

export type PathProbe = { ok: boolean; contentType: string };

export type DetectionInput = {
  html: string;
  /** En-têtes de la page d'accueil, noms en minuscules. */
  headers: Record<string, string>;
  /** Résultat des visites en HEAD, par chemin (« /~flock.js »). */
  paths: Record<string, PathProbe>;
};

export type DetectionResult = {
  stack: Array<{ name: string; kind: string }>;
  score: number;
  /** Règles comptées dans le score (code et poids). */
  matched: Array<{ code: string; weight: number }>;
};

/** Plafond de page analysée : au-delà, le motif ne cherche que dans le début. */
export const MAX_HTML = 600_000;

function safeRegex(pattern: string) {
  try {
    return new RegExp(pattern, "i");
  } catch {
    return null;
  }
}

/** Vrai si le motif est une expression régulière valide (écran d'administration). */
export function isValidPattern(pattern: string) {
  return pattern === "" || safeRegex(pattern) !== null;
}

/** Une règle s'applique-t-elle à ce qui a été relevé ? */
export function detectorMatches(detector: WatchDetector, input: DetectionInput): boolean {
  const regex = detector.pattern ? safeRegex(detector.pattern) : null;
  if (detector.pattern && !regex) return false;
  switch (detector.target) {
    case "html":
      return Boolean(regex?.test(input.html.slice(0, MAX_HTML)));
    case "header": {
      const value = input.headers[detector.selector.toLowerCase()];
      if (value === undefined) return false;
      return regex ? regex.test(value) : true;
    }
    case "path": {
      const probe = input.paths[detector.selector];
      if (!probe?.ok) return false;
      return regex ? regex.test(probe.contentType) : true;
    }
    default:
      return false;
  }
}

/** Technologies détectées (une fois par nom) et score d'empreinte. */
export function evaluateDetectors(
  detectors: ReadonlyArray<WatchDetector>,
  input: DetectionInput,
): DetectionResult {
  const stack: DetectionResult["stack"] = [];
  const matched: DetectionResult["matched"] = [];
  for (const detector of detectors) {
    if (!detectorMatches(detector, input)) continue;
    if (!stack.some((t) => t.name === detector.name)) {
      stack.push({
        name: detector.name,
        kind: detector.kind === "empreinte" ? "plateforme" : detector.kind,
      });
    }
    if (detector.weight > 0) matched.push({ code: detector.code, weight: detector.weight });
  }
  return { stack, score: matched.reduce((sum, m) => sum + m.weight, 0), matched };
}

/** Chemins à visiter en HEAD (règles « path »), sans doublon, dix au plus. */
export function pathsToProbe(detectors: ReadonlyArray<WatchDetector>) {
  return [...new Set(detectors.filter((d) => d.target === "path").map((d) => d.selector))].slice(
    0,
    10,
  );
}

/** Score maximal atteignable par les seules règles réseau (en-têtes et chemins). */
export function networkScore(detectors: ReadonlyArray<WatchDetector>, input: DetectionInput) {
  return evaluateDetectors(
    detectors.filter((d) => d.target !== "html"),
    input,
  ).score;
}

// Langue et polices -----------------------------------------------------------------------------------

const FRENCH_MARKERS = [
  " le ",
  " la ",
  " les ",
  " des ",
  " une ",
  " nous ",
  " vous ",
  " pour ",
  " avec ",
  " votre ",
  " notre ",
  " est ",
  " sur ",
  " plus ",
  " tout ",
  " sans ",
  " déjà ",
  "connexion",
  "inscription",
  "accueil",
  "à propos",
  "tarifs",
  "contactez",
];

/** Score de francophonie (0 à 100) sur un extrait de texte. */
export function frenchScore(text: string): number {
  const haystack = ` ${text.toLowerCase().replace(/\s+/g, " ")} `;
  const hits = FRENCH_MARKERS.filter((marker) => haystack.includes(marker)).length;
  return Math.min(100, Math.round((hits / FRENCH_MARKERS.length) * 145));
}

/** Texte lisible d'une page HTML (scripts, styles et balises retirés). */
export function textFromHtml(html: string) {
  return html
    .slice(0, MAX_HTML)
    .replace(/<(script|style|noscript)[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Langue déclarée dans <html lang="…">. */
export function htmlLanguage(html: string) {
  return (
    /<html[^>]*\slang=["']?([a-zA-Z-]{2,10})/i.exec(html.slice(0, 5000))?.[1] ?? ""
  ).toLowerCase();
}

/** Titre et description de la page. */
export function pageMeta(html: string) {
  const head = html.slice(0, 200_000);
  const decode = (s: string) =>
    s
      .replace(/&amp;/g, "&")
      .replace(/&quot;/g, '"')
      .replace(/&#39;|&apos;/g, "'")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .trim();
  const title = /<title[^>]*>([^<]{1,300})<\/title>/i.exec(head)?.[1] ?? "";
  const description =
    /<meta[^>]+name=["']description["'][^>]+content=["']([^"']{1,1000})["']/i.exec(head)?.[1] ??
    /<meta[^>]+content=["']([^"']{1,1000})["'][^>]+name=["']description["']/i.exec(head)?.[1] ??
    "";
  return { title: decode(title), description: decode(description) };
}

export function detectFonts(html: string): string[] {
  const families = new Set<string>();
  for (const match of html.slice(0, MAX_HTML).matchAll(/family=([^&"'?:;]+)/gi)) {
    for (const raw of decodeURIComponent(match[1] ?? "").split("|")) {
      const name = raw.split(":")[0]?.replace(/\+/g, " ").trim();
      if (name && name.length < 40) families.add(name);
    }
  }
  return [...families].slice(0, 8);
}

// Décision -----------------------------------------------------------------------------------------

export type WatchDecision =
  { accepted: true } | { accepted: false; reason: "empreintes" | "langue"; message: string };

/** Portiers : empreinte d'abord, langue ensuite. `force` : ajout assumé par l'admin. */
export function decide(
  settings: WatchSettings,
  input: { score: number; languageMeta: string; languageScore: number; force?: boolean },
): WatchDecision {
  if (input.force) return { accepted: true };
  if (input.score < settings.gate_min_score) {
    return {
      accepted: false,
      reason: "empreintes",
      message: `Empreinte insuffisante : ${input.score}/${settings.gate_min_score}`,
    };
  }
  if (settings.language === "fr") {
    const declared = input.languageMeta.startsWith("fr");
    if (!declared && input.languageScore < settings.min_language_score) {
      return {
        accepted: false,
        reason: "langue",
        message: `Hors périmètre francophone : score ${input.languageScore}/${settings.min_language_score}${
          input.languageMeta ? ` (langue déclarée : ${input.languageMeta})` : ""
        }`,
      };
    }
  }
  return { accepted: true };
}

/** État d'un site à partir d'un code de réponse (null : aucune réponse). */
export function availability(httpStatus: number | null): "en_ligne" | "instable" | "hors_ligne" {
  if (httpStatus === null) return "hors_ligne";
  if (httpStatus >= 200 && httpStatus < 400) return "en_ligne";
  return httpStatus >= 500 ? "hors_ligne" : "instable";
}

export const WATCH_STATUS_LABEL: Record<string, string> = {
  en_ligne: "En ligne",
  instable: "Instable",
  hors_ligne: "Hors ligne",
};

export const WATCH_REASON_LABEL: Record<string, string> = {
  empreintes: "Empreinte insuffisante",
  langue: "Hors périmètre de langue",
  prefiltre: "Écarté au préfiltre réseau",
  erreur: "Analyse impossible",
  adresse: "Adresse refusée",
};

export const WATCH_SUBMISSION_LABEL: Record<string, string> = {
  en_attente: "En attente",
  acceptee: "Retenue",
  refusee: "Non retenue",
  erreur: "Analyse impossible",
};
