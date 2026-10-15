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

test("les outils ne chargent une page que par fetchMemeOrigine", () => {
  for (const f of fichiers) {
    const texte = readFileSync(join(TOOLS, f), "utf8");
    assert.doesNotMatch(texte, /\bfetch\(/, f);
  }
  const supabase = readFileSync(join(TOOLS, "..", "supabase.ts"), "utf8");
  assert.match(supabase, /redirect: "manual"/);
  assert.doesNotMatch(supabase, /redirect: "follow"/);
});

test("une redirection n'est suivie que sur le même site", async () => {
  const { createServer } = await import("node:http");
  const { fetchMemeOrigine } = await import("../../src/lib/mcp/supabase.ts");
  const serveur = createServer((req, res) => {
    if (req.url === "/ancienne") res.writeHead(301, { location: "/nouvelle" }).end();
    else if (req.url === "/sortie")
      res.writeHead(302, { location: "http://169.254.169.254/" }).end();
    else if (req.url === "/boucle") res.writeHead(302, { location: "/boucle" }).end();
    else res.writeHead(200).end("ok");
  });
  await new Promise<void>((ok) => serveur.listen(0, "127.0.0.1", ok));
  const { port } = serveur.address() as { port: number };
  const base = `http://127.0.0.1:${port}`;
  try {
    const { res, url } = await fetchMemeOrigine(`${base}/ancienne`);
    assert.equal(res.status, 200);
    assert.equal(url, `${base}/nouvelle`);
    await assert.rejects(fetchMemeOrigine(`${base}/sortie`), /autre site refusée/);
    await assert.rejects(fetchMemeOrigine(`${base}/boucle`), /Trop de redirections/);
  } finally {
    serveur.close();
  }
});
