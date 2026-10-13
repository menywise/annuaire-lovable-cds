/**
 * Adresse de retour après connexion : jamais vers un autre site.
 * Lancer : node --test tests/unit/*.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { cheminInterne } from "../../src/lib/redirection.ts";

const ORIGINE = "https://site.exemple";
const SRC = join(import.meta.dirname, "..", "..", "src");

test("les adresses vers un autre site sont refusées", () => {
  for (const valeur of [
    "//evil.example",
    "/\\evil.example",
    "/\t/evil.example",
    "/\n/evil.example",
    "/\r/evil.example",
    "\\\\evil.example",
    "https://evil.example/tableau-de-bord",
    "http://site.exemple/tableau-de-bord",
    "javascript:alert(1)",
    "/.//evil.example",
    "/a/..//evil.example",
    " //evil.example",
    "",
    null,
    42,
  ]) {
    assert.equal(cheminInterne(valeur, ORIGINE), undefined, JSON.stringify(valeur));
  }
});

test("les pages du site sont acceptées, avec paramètres et ancre", () => {
  assert.equal(cheminInterne("/tableau-de-bord", ORIGINE), "/tableau-de-bord");
  assert.equal(cheminInterne("/forum/123?x=1#y", ORIGINE), "/forum/123?x=1#y");
  assert.equal(cheminInterne("https://site.exemple/compte?a=b", ORIGINE), "/compte?a=b");
});

test("connexion, Google et consentement passent par cheminInterne", () => {
  for (const fichier of [
    "routes/login.tsx",
    "components/cds/GoogleSignInButton.tsx",
    "routes/[.]lovable.oauth.consent.tsx",
  ]) {
    const texte = readFileSync(join(SRC, fichier), "utf8");
    assert.match(texte, /cheminInterne\(/, fichier);
    assert.doesNotMatch(texte, /startsWith\("\/\/"\)|\(\?!\[\/\\\\\]\)/, fichier);
  }
});
