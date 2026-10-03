/**
 * Identité neutre : le socle n'embarque ni adresse e-mail personnelle, ni marque visible à l'écran.
 * Chaque projet règle son identité (nom, couleurs, logo, icônes, image de partage, accueil) dans
 * l'administration.
 * Lancer : node --test tests/unit/*.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const REPO = join(import.meta.dirname, "..", "..");

// Messageries grand public : une adresse chez elles est personnelle. Les tests emploient des
// domaines fictifs (test.fr, example.invalid…).
const MESSAGERIES =
  /[a-z0-9._%+-]+@(gmail|googlemail|yahoo|hotmail|outlook|live|msn|icloud|me|aol|gmx|proton|protonmail|orange|wanadoo|free|sfr|neuf|laposte|bbox|numericable)\.[a-z.]+/i;

const TEXTE = /\.(ts|tsx|js|mjs|json|sql|md|toml|yml|yaml|css|html|txt|sh)$/;

function fichiersSuivis(): string[] {
  return execFileSync("git", ["ls-files"], { cwd: REPO, encoding: "utf8" })
    .split("\n")
    .filter((f) => f && TEXTE.test(f) && f !== "bun.lock" && existsSync(join(REPO, f)));
}

test("aucune adresse e-mail personnelle dans le dépôt", () => {
  const trouvees: string[] = [];
  for (const fichier of fichiersSuivis()) {
    const lignes = readFileSync(join(REPO, fichier), "utf8").split("\n");
    lignes.forEach((ligne, i) => {
      if (MESSAGERIES.test(ligne)) trouvees.push(`${fichier}:${i + 1}`);
    });
  }
  assert.deepEqual(trouvees, []);
});

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((nom) => {
    const chemin = join(dir, nom);
    if (statSync(chemin).isDirectory()) return sources(chemin);
    return /\.(ts|tsx)$/.test(nom) && nom !== "routeTree.gen.ts" ? [chemin] : [];
  });
}

/** Retire les commentaires : seules comptent les chaînes et le texte affiché. */
function sansCommentaires(code: string) {
  return code.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

test("aucune marque du socle visible à l'écran", () => {
  const src = join(REPO, "src");
  const trouvees: string[] = [];
  for (const fichier of sources(src)) {
    const code = sansCommentaires(readFileSync(fichier, "utf8"));
    if (/\bCDS\b|Consensus Design System/.test(code)) trouvees.push(fichier.slice(src.length + 1));
  }
  assert.deepEqual(trouvees, []);
});

test("logo, icônes et image de partage par défaut sont neutres et remplaçables", () => {
  assert.equal(existsSync(join(REPO, "public", "og-cds.jpg")), false);
  const seo = readFileSync(join(REPO, "src", "lib", "seo.ts"), "utf8");
  assert.doesNotMatch(seo, /og-cds/);
  const racine = readFileSync(join(REPO, "src", "routes", "__root.tsx"), "utf8");
  assert.match(racine, /apparence\.favicon/);
});
