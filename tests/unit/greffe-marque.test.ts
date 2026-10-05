/**
 * Socle 1.3.0 — marque réservée « greffe ». Ce qui appartient à un projet porte la marque ; le socle
 * ne l'emploie jamais pour ses propres objets. La prise `src/greffe/index.ts` est lue par le socle.
 * Lancer : node --test tests/unit/*.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import {
  ALL_MODULES,
  isGreffeKey,
  normalizeModules,
  isModuleOn,
} from "../../src/config/modules.ts";
import { GREFFE } from "../../src/greffe/index.ts";

const ROOT = join(import.meta.dirname, "..", "..");
// Espaces du projet, et fichiers du socle qui décrivent le mécanisme lui-même.
const ESPACES_GREFFE = ["src/greffe/", "src/routes/(greffe)/"];
const MECANISME = [
  "src/config/greffe.ts",
  "src/config/modules.ts",
  "src/components/cds/EspaceConnecte.tsx",
];

function sources(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...sources(full));
    else if (/\.(ts|tsx)$/.test(name)) out.push(full);
  }
  return out;
}

test("le code du socle ne crée aucun objet marqué greffe_", () => {
  for (const full of sources(join(ROOT, "src"))) {
    const rel = relative(ROOT, full).replaceAll("\\", "/");
    if (ESPACES_GREFFE.some((p) => rel.startsWith(p)) || MECANISME.includes(rel)) continue;
    if (rel === "src/integrations/supabase/types.ts" || rel === "src/routeTree.gen.ts") continue;
    assert.doesNotMatch(
      readFileSync(full, "utf8"),
      /greffe_[a-z0-9]/,
      `${rel} emploie la marque greffe_`,
    );
  }
});

test("clé de module de greffe : greffe_ puis minuscules, chiffres, soulignés", () => {
  assert.ok(isGreffeKey("greffe_veille"));
  assert.ok(isGreffeKey("greffe_veille_2"));
  for (const k of [
    "veille",
    "greffe_",
    "greffe_Veille",
    "greffe-veille",
    "greffe_" + "x".repeat(41),
  ]) {
    assert.ok(!isGreffeKey(k), k);
  }
});

test("chaque module déclaré par le projet a une clé valide et une définition", () => {
  for (const m of GREFFE.modules ?? []) {
    assert.ok(isGreffeKey(m.key), `${m.key} : clé invalide`);
    assert.ok(m.definition.trim().length >= 20, `${m.key} : définition manquante`);
  }
  const keys = ALL_MODULES.map((m) => m.key);
  assert.equal(new Set(keys).size, keys.length, "clé de module en double");
});

test("module de greffe : éteint par défaut, lu en base s'il est déclaré, ignoré sinon", () => {
  const states = normalizeModules({ greffe_inconnu: true, blog: true });
  assert.equal(isModuleOn(states, "greffe_inconnu"), false);
  assert.equal(isModuleOn(states, "blog"), true);
});
