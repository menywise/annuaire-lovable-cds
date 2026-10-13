/**
 * Données structurées (JSON-LD) : un texte saisi par un visiteur ne ferme jamais la balise script.
 * Le routeur injecte `children` tel quel ; seule `jsonLdScript` (src/lib/seo.ts) l'écrit.
 * Lancer : node --test tests/unit/*.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { breadcrumbJsonLd, jsonLdScript } from "../../src/lib/seo.ts";

const ROOT = join(import.meta.dirname, "..", "..", "src");
const PIEGE = "</script><script>alert(1)</script> & <!-- \u2028\u2029 fin";

test("un titre contenant </script> ne ferme pas la balise", () => {
  const data = { "@type": "Thing", name: PIEGE, nested: [{ text: PIEGE }] };
  const { type, children } = jsonLdScript(data);
  assert.equal(type, "application/ld+json");
  assert.doesNotMatch(children, /<\/script/i);
  assert.doesNotMatch(children, /[<>&\u2028\u2029]/);
  assert.deepEqual(JSON.parse(children), data);
});

test("le fil d'Ariane passe par la même protection", () => {
  const { children } = breadcrumbJsonLd([{ name: PIEGE, path: "/forum/1" }]);
  assert.doesNotMatch(children, /<\/script/i);
  assert.equal(JSON.parse(children).itemListElement[0].name, PIEGE);
});

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return files(path);
    return /\.(ts|tsx)$/.test(name) && name !== "routeTree.gen.ts" ? [path] : [];
  });
}

test("aucune sortie application/ld+json hors de jsonLdScript", () => {
  const hits: string[] = [];
  for (const file of files(ROOT)) {
    let text = readFileSync(file, "utf8");
    if (file === join(ROOT, "lib", "seo.ts")) {
      // Retire le corps de la fonction unique : le reste du fichier suit la règle commune.
      const debut = text.indexOf("export function jsonLdScript(");
      assert.ok(debut >= 0, "jsonLdScript absente de src/lib/seo.ts");
      const fin = text.indexOf("\n}\n", debut);
      text = text.slice(0, debut) + text.slice(fin);
      text = text.replace(/\/\*\*[\s\S]*?\*\//g, "");
    }
    if (/application\/ld\+json[\s\S]*?JSON\.stringify/.test(text)) {
      hits.push(file.slice(ROOT.length + 1));
    } else if (/["'`]application\/ld\+json["'`]/.test(text)) {
      hits.push(`${file.slice(ROOT.length + 1)} : balise écrite sans jsonLdScript`);
    }
  }
  assert.deepEqual(hits, []);
});
