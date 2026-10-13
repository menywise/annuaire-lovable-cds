/**
 * Outils d'audit (MCP) : réservés à l'administrateur, et jamais d'adresse choisie librement.
 * Lancer : node --test tests/unit/*.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const TOOLS = join(import.meta.dirname, "..", "..", "src", "lib", "mcp", "tools");
const fichiers = readdirSync(TOOLS).filter((f) => /\.ts$/.test(f));

test("chaque outil de src/lib/mcp/tools/ appelle requireAdmin", () => {
  assert.ok(fichiers.length > 0);
  const sansGarde = fichiers.filter(
    (f) => !/await requireAdmin\(ctx\)/.test(readFileSync(join(TOOLS, f), "utf8")),
  );
  assert.deepEqual(sansGarde, []);
});

test("base_url passe toujours par siteBaseUrl, qui le limite aux adresses du site", () => {
  for (const f of fichiers) {
    const texte = readFileSync(join(TOOLS, f), "utf8");
    if (texte.includes("base_url")) assert.match(texte, /siteBaseUrl\(base_url\)/, f);
  }
  const supabase = readFileSync(join(TOOLS, "..", "supabase.ts"), "utf8");
  assert.match(supabase, /base_url refusée/);
});
