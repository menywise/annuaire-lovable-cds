/**
 * En-têtes de sécurité : posés sur chaque réponse HTML, jamais écrasés, encadrement limité au
 * site sauf dans l'aperçu de Lovable.
 * Lancer : node --test tests/unit/*.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  ancetresAutorises,
  avecEnTetesSecurite,
  enTetesSecurite,
  estZoneApercuLovable,
  poserEnTetesSecurite,
} from "../../src/lib/en-tetes-securite.ts";

const SRC = join(import.meta.dirname, "..", "..", "src");
const UUID = "0f6a1b2c-3d4e-4f50-a6b7-c8d9e0f1a2b3";

function html(entetes: Record<string, string> = {}): Response {
  return new Response("<!doctype html>", {
    status: 200,
    headers: { "content-type": "text/html; charset=utf-8", ...entetes },
  });
}

test("hors aperçu Lovable : les cinq en-têtes, encadrement réservé au site", () => {
  for (const hote of [
    "site.exemple",
    "www.site.exemple",
    "localhost",
    "lovable.app.site.exemple",
  ]) {
    assert.equal(estZoneApercuLovable(hote), false, hote);
    assert.equal(ancetresAutorises(hote), "'self'", hote);
    assert.deepEqual(enTetesSecurite(hote), [
      ["X-Content-Type-Options", "nosniff"],
      ["Referrer-Policy", "strict-origin-when-cross-origin"],
      ["Strict-Transport-Security", "max-age=31536000; includeSubDomains"],
      ["Content-Security-Policy", "frame-ancestors 'self'"],
      ["X-Frame-Options", "SAMEORIGIN"],
    ]);
  }
});

test("zone d'aperçu Lovable : l'éditeur peut encadrer, personne d'autre", () => {
  for (const hote of [
    `id-preview--${UUID}.lovable.app`,
    `${UUID}.lovableproject.com`,
    "cds-mac97000.lovable.app",
    "lovable.app",
  ]) {
    assert.equal(estZoneApercuLovable(hote), true, hote);
    const ancetres = ancetresAutorises(hote);
    assert.equal(
      ancetres,
      "'self' https://lovable.dev https://*.lovable.dev https://gptengineer.app https://*.gptengineer.app",
      hote,
    );
    assert.doesNotMatch(ancetres, /localhost|\*(?![.])| \*/, hote);
    const noms = enTetesSecurite(hote).map(([nom]) => nom);
    assert.ok(!noms.includes("X-Frame-Options"), hote);
    assert.ok(noms.includes("Content-Security-Policy"), hote);
  }
  const dev = ancetresAutorises(`${UUID}.lovableproject-dev.com`);
  assert.match(dev, /^'self' https:\/\/lovable\.dev .* http:\/\/localhost:3000$/);
  assert.doesNotMatch(ancetresAutorises(`${UUID}.lovableproject.com`), /localhost/);
});

test("un en-tête déjà présent n'est pas écrasé", () => {
  const entetes = new Headers({
    "Strict-Transport-Security": "max-age=60",
    "Referrer-Policy": "no-referrer",
    "X-Frame-Options": "DENY",
  });
  poserEnTetesSecurite(entetes, "site.exemple");
  assert.equal(entetes.get("strict-transport-security"), "max-age=60");
  assert.equal(entetes.get("referrer-policy"), "no-referrer");
  assert.equal(entetes.get("x-frame-options"), "DENY");
  assert.equal(entetes.get("x-content-type-options"), "nosniff");
  assert.equal(entetes.get("content-security-policy"), "frame-ancestors 'self'");
});

test("une politique de contenu présente garde ses directives et reçoit frame-ancestors", () => {
  const sans = new Headers({ "Content-Security-Policy": "default-src 'self'; img-src *;" });
  poserEnTetesSecurite(sans, "site.exemple");
  assert.equal(
    sans.get("content-security-policy"),
    "default-src 'self'; img-src *; frame-ancestors 'self'",
  );

  const avec = new Headers({
    "Content-Security-Policy": "default-src 'self'; Frame-Ancestors https://parent.exemple",
  });
  poserEnTetesSecurite(avec, "site.exemple");
  assert.equal(
    avec.get("content-security-policy"),
    "default-src 'self'; Frame-Ancestors https://parent.exemple",
  );
});

test("avecEnTetesSecurite : réponse HTML complétée, hôte lu dans la requête", async () => {
  const requete = new Request("https://site.exemple/compte?x=1");
  const reponse = avecEnTetesSecurite(html(), requete);
  assert.equal(reponse.status, 200);
  assert.equal(reponse.headers.get("x-content-type-options"), "nosniff");
  assert.equal(reponse.headers.get("content-security-policy"), "frame-ancestors 'self'");
  assert.equal(reponse.headers.get("x-frame-options"), "SAMEORIGIN");
  assert.equal(await reponse.text(), "<!doctype html>");

  const apercu = avecEnTetesSecurite(html(), new Request(`https://${UUID}.lovableproject.com/`));
  assert.match(apercu.headers.get("content-security-policy") ?? "", /https:\/\/lovable\.dev/);
  assert.equal(apercu.headers.get("x-frame-options"), null);

  const erreur = avecEnTetesSecurite(
    new Response("<!doctype html>", {
      status: 500,
      headers: { "content-type": "text/html; charset=utf-8" },
    }),
    requete,
  );
  assert.equal(erreur.status, 500);
  assert.equal(
    erreur.headers.get("strict-transport-security"),
    "max-age=31536000; includeSubDomains",
  );
});

test("avecEnTetesSecurite : les réponses non HTML restent telles quelles", () => {
  const requete = new Request("https://site.exemple/api");
  for (const reponse of [
    new Response("{}", { headers: { "content-type": "application/json" } }),
    new Response("body { }", { headers: { "content-type": "text/css" } }),
    new Response(null, { status: 204 }),
  ]) {
    const resultat = avecEnTetesSecurite(reponse, requete);
    assert.equal(resultat, reponse);
    assert.equal(resultat.headers.get("x-content-type-options"), null);
    assert.equal(resultat.headers.get("content-security-policy"), null);
  }
});

test("avecEnTetesSecurite : une réponse aux en-têtes figés est recopiée", async () => {
  const figee = html({ "x-exemple": "1" });
  Object.defineProperty(figee, "headers", {
    value: new Proxy(figee.headers, {
      get(cible, prop, recepteur) {
        if (prop === "set" || prop === "append" || prop === "delete") {
          return () => {
            throw new TypeError("immutable");
          };
        }
        const valeur = Reflect.get(cible, prop, recepteur);
        return typeof valeur === "function" ? valeur.bind(cible) : valeur;
      },
    }),
  });
  const reponse = avecEnTetesSecurite(figee, new Request("https://site.exemple/"));
  assert.notEqual(reponse, figee);
  assert.equal(reponse.status, 200);
  assert.equal(reponse.headers.get("x-exemple"), "1");
  assert.equal(reponse.headers.get("content-type"), "text/html; charset=utf-8");
  assert.equal(reponse.headers.get("x-frame-options"), "SAMEORIGIN");
  assert.equal(await reponse.text(), "<!doctype html>");
});

test("src/server.ts passe toute réponse HTML par avecEnTetesSecurite", () => {
  const texte = readFileSync(join(SRC, "server.ts"), "utf8");
  assert.match(texte, /import \{ avecEnTetesSecurite \} from "\.\/lib\/en-tetes-securite"/);
  // Le chemin normal et la page d'erreur en cas d'exception.
  assert.equal((texte.match(/avecEnTetesSecurite\(/g) ?? []).length, 2);
  assert.match(
    texte,
    /avecEnTetesSecurite\(await normalizeCatastrophicSsrResponse\(response\), request\)/,
  );
  assert.match(
    texte,
    /catch \(error\) \{[^}]*avecEnTetesSecurite\(\s*new Response\(renderErrorPage\(\)/,
  );
});

test("les zones d'aperçu et les origines de l'éditeur suivent le fichier généré par Lovable", () => {
  const genere = readFileSync(
    join(SRC, "integrations", "supabase", "previewAuthStorage.ts"),
    "utf8",
  );
  const zones = genere.match(/PREVIEW_ZONES = \[([^\]]*)\]/)?.[1] ?? "";
  for (const zone of [
    "lovableproject.com",
    "lovableproject-dev.com",
    "lovable.app",
    "gpt-eng.com",
    "gptengineer.run",
  ]) {
    assert.ok(zones.includes(`'${zone}'`), zone);
    assert.equal(estZoneApercuLovable(`x.${zone}`), true, zone);
  }
  assert.match(genere, /lovable\\\.dev\|gptengineer\\\.app/);
});
