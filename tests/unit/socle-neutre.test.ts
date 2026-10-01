/**
 * Lot 13 a : le socle ne contient rien de propre à un projet. Chaque clone règle son nom, son
 * adresse et son domaine d'envoi dans l'administration ; le code n'en garde aucune trace.
 * Lancer : node --test tests/unit/*.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dirname, "..", "..", "src");
// Domaines et noms propres à un projet du studio : jamais dans le code du socle.
const FORBIDDEN = [/manuelrohaut\.fr/i, /cds-mac97000\.lovable\.app/i];

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return files(path);
    return /\.(ts|tsx)$/.test(name) && name !== "routeTree.gen.ts" ? [path] : [];
  });
}

test("aucun domaine de projet écrit en dur dans src/", () => {
  const hits: string[] = [];
  for (const file of files(ROOT)) {
    const text = readFileSync(file, "utf8");
    for (const pattern of FORBIDDEN) {
      if (pattern.test(text)) hits.push(`${file.slice(ROOT.length + 1)} : ${pattern}`);
    }
  }
  assert.deepEqual(hits, []);
});

test("les e-mails lisent leur identité dans les réglages", () => {
  for (const file of [
    "routes/lovable/email/auth/webhook.ts",
    "lib/email-templates/send-email.ts",
  ]) {
    const text = readFileSync(join(ROOT, file), "utf8");
    assert.match(text, /emailIdentity\(/, file);
    assert.doesNotMatch(text, /const SENDER_DOMAIN\s*=/, file);
  }
});
