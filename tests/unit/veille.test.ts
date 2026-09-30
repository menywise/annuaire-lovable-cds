import { test } from "node:test";
import assert from "node:assert/strict";
import {
  availability,
  decide,
  detectFonts,
  evaluateDetectors,
  frenchScore,
  htmlLanguage,
  isValidPattern,
  networkScore,
  normalizeSiteUrl,
  normalizeWatchSettings,
  pageMeta,
  pathsToProbe,
  textFromHtml,
  type WatchDetector,
} from "../../src/lib/watch.ts";

// Règles reprises de la migration (mêmes motifs, sans antislash).
const D: WatchDetector[] = [
  {
    code: "react",
    name: "React",
    kind: "framework",
    target: "html",
    selector: "",
    pattern: "data-reactroot|react-dom|__REACT_DEVTOOLS|_jsx",
    weight: 0,
  },
  {
    code: "wordpress",
    name: "WordPress",
    kind: "plateforme",
    target: "html",
    selector: "",
    pattern: "wp-content/|wp-includes/",
    weight: 0,
  },
  {
    code: "lovable-flock",
    name: "Lovable",
    kind: "empreinte",
    target: "path",
    selector: "/~flock.js",
    pattern: "javascript",
    weight: 50,
  },
  {
    code: "lovable-deployment-id",
    name: "Lovable",
    kind: "empreinte",
    target: "header",
    selector: "x-deployment-id",
    pattern: "",
    weight: 10,
  },
  {
    code: "lovable-id-preview",
    name: "Lovable",
    kind: "empreinte",
    target: "html",
    selector: "",
    pattern: "id-preview--[a-f0-9-]+[.]lovable[.]app",
    weight: 30,
  },
  {
    code: "lovable-build-tsr",
    name: "Lovable",
    kind: "empreinte",
    target: "html",
    selector: "",
    pattern: "/_build/[^]*__TSR__|__TSR__[^]*/_build/",
    weight: 10,
  },
];

const lovableHtml =
  '<html lang="fr"><head><title>Mon outil</title><script src="/_build/app.js"></script></head>' +
  '<body><img src="https://id-preview--1234abcd.lovable.app/x.png"><script>window.__TSR__={}</script>' +
  "<div data-reactroot></div></body></html>";

test("règles : technologies une fois par nom, score = somme des poids déclenchés", () => {
  const result = evaluateDetectors(D, {
    html: lovableHtml,
    headers: { "x-deployment-id": "b7a1c3d2-0000-4000-8000-000000000000" },
    paths: { "/~flock.js": { ok: true, contentType: "application/javascript; charset=utf-8" } },
  });
  assert.deepEqual(
    result.stack.map((t) => t.name),
    ["React", "Lovable"],
  );
  // Une empreinte apparaît comme plateforme dans les technologies.
  assert.equal(result.stack.find((t) => t.name === "Lovable")?.kind, "plateforme");
  assert.equal(result.score, 100);
  assert.deepEqual(
    result.matched.map((m) => m.code),
    ["lovable-flock", "lovable-deployment-id", "lovable-id-preview", "lovable-build-tsr"],
  );
});

test("règle de chemin : réponse 2xx ET type de contenu attendu", () => {
  const base = { html: "", headers: {} };
  assert.equal(
    networkScore(D, { ...base, paths: { "/~flock.js": { ok: true, contentType: "text/html" } } }),
    0,
  );
  assert.equal(
    networkScore(D, {
      ...base,
      paths: { "/~flock.js": { ok: false, contentType: "application/javascript" } },
    }),
    0,
  );
  assert.equal(
    networkScore(D, {
      ...base,
      paths: { "/~flock.js": { ok: true, contentType: "application/javascript" } },
    }),
    50,
  );
  // Le score réseau ignore les règles de page.
  assert.equal(networkScore(D, { html: lovableHtml, headers: {}, paths: {} }), 0);
  assert.deepEqual(pathsToProbe(D), ["/~flock.js"]);
});

test("motif invalide : ignoré, jamais d'exception", () => {
  const bad: WatchDetector = { ...D[0]!, code: "bad", pattern: "(" };
  assert.equal(isValidPattern("("), false);
  assert.equal(isValidPattern(""), true);
  assert.equal(evaluateDetectors([bad], { html: "(", headers: {}, paths: {} }).stack.length, 0);
});

test("portiers : empreinte, puis langue ; « forcer » passe outre", () => {
  const s = normalizeWatchSettings({ gate_min_score: 50, language: "fr", min_language_score: 45 });
  assert.equal(decide(s, { score: 40, languageMeta: "fr", languageScore: 90 }).accepted, false);
  const lang = decide(s, { score: 60, languageMeta: "en", languageScore: 10 });
  assert.equal(lang.accepted, false);
  assert.equal(lang.accepted === false && lang.reason, "langue");
  assert.equal(decide(s, { score: 60, languageMeta: "fr-FR", languageScore: 0 }).accepted, true);
  assert.equal(decide(s, { score: 60, languageMeta: "", languageScore: 50 }).accepted, true);
  assert.equal(
    decide(s, { score: 0, languageMeta: "en", languageScore: 0, force: true }).accepted,
    true,
  );
  const open = normalizeWatchSettings({ gate_min_score: 0, language: null });
  assert.equal(decide(open, { score: 0, languageMeta: "de", languageScore: 0 }).accepted, true);
});

test("réglages : valeurs hors bornes ramenées aux valeurs par défaut", () => {
  const s = normalizeWatchSettings({
    gate_min_score: -1,
    search_limit: 99,
    checks_per_run: "12",
    language: "",
  });
  assert.equal(s.gate_min_score, 0);
  assert.equal(s.search_limit, 8);
  assert.equal(s.checks_per_run, 12);
  assert.equal(s.language, null);
  assert.equal(normalizeWatchSettings(null).language, "fr");
});

test("adresse normalisée en https, domaine en minuscules", () => {
  assert.equal(normalizeSiteUrl("  Exemple.FR/page?x=1 ").url, "https://exemple.fr");
  assert.equal(normalizeSiteUrl("http://www.site.fr.").host, "www.site.fr");
});

test("langue, titre, description, texte, polices", () => {
  assert.equal(htmlLanguage(lovableHtml), "fr");
  assert.deepEqual(
    pageMeta('<title>Café &amp; Co</title><meta name="description" content="Le meilleur café">'),
    { title: "Café & Co", description: "Le meilleur café" },
  );
  assert.equal(
    textFromHtml("<p>Bonjour</p><script>var x = 1;</script><style>p{}</style> à tous"),
    "Bonjour à tous",
  );
  assert.ok(
    frenchScore(
      "Bienvenue sur notre site : découvrez les tarifs pour vous et votre équipe, avec plus de services",
    ) >= 45,
  );
  assert.ok(frenchScore("Welcome to our website, discover pricing for your team") < 20);
  assert.deepEqual(
    detectFonts(
      '<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400&family=Roboto+Mono">',
    ),
    ["Inter", "Roboto Mono"],
  );
});

test("disponibilité selon le code de réponse", () => {
  assert.equal(availability(200), "en_ligne");
  assert.equal(availability(301), "en_ligne");
  assert.equal(availability(404), "instable");
  assert.equal(availability(503), "hors_ligne");
  assert.equal(availability(null), "hors_ligne");
});
