/**
 * Chaque page de l'espace connecté rattachée à un module (requireFeature dans beforeLoad) doit
 * figurer dans PROTECTED_PATH_MODULES, avec les mêmes modules : sinon, module éteint, la
 * redirection se fait pendant l'hydratation (erreur React) au lieu du serveur.
 * Lancer : node --test tests/unit/*.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { PROTECTED_PATH_MODULES } from "../../src/config/modules.ts";

const ROUTES = join(import.meta.dirname, "..", "..", "src", "routes");
const DIR = join(ROUTES, "_authenticated");
// Pages d'une greffe (socle 1.3.0) : src/routes/(greffe)/, sous-dossiers compris.
const GREFFE_DIR = join(ROUTES, "(greffe)");

function routeFiles(): string[] {
  const files = readdirSync(DIR)
    .filter((f) => f.endsWith(".tsx"))
    .map((f) => join(DIR, f));
  if (existsSync(GREFFE_DIR)) {
    for (const f of readdirSync(GREFFE_DIR, { recursive: true }) as string[]) {
      if (f.endsWith(".tsx")) files.push(join(GREFFE_DIR, f));
    }
  }
  return files;
}

function guardedRoutes() {
  const out: Array<{ file: string; path: string; modules: string[] }> = [];
  for (const full of routeFiles()) {
    const file = full.slice(ROUTES.length + 1);
    const src = readFileSync(full, "utf8");
    // « /_authenticated/admin/x » ou « /(greffe)/_connecte/admin/x » → « /admin/x ».
    const id = /createFileRoute\("([^"]*)"\)/.exec(src)?.[1];
    // Pages connectées seulement (rendues dans le navigateur) : une page publique est protégée
    // par son beforeLoad, exécuté côté serveur.
    if (!id || !(id.startsWith("/_authenticated/") || /^\/\(greffe\)(\/\([^)]*\))*\/_/.test(id)))
      continue;
    const route = id.replace(/\/\([^)]*\)/g, "").replace(/\/_[^/]+/g, "");
    const guard = /beforeLoad:\s*\(\)\s*=>\s*require(?:Any)?Feature\(([^)]*)\)/.exec(src)?.[1];
    if (!route || !guard) continue;
    const modules = [...guard.matchAll(/"([A-Za-z_0-9]+)"/g)].map((m) => m[1]!).sort();
    // « /crm/prospect/$prospectId » → « /crm/prospect » : la règle porte sur le préfixe.
    const path = route.replace(/\/\$[^/]+/g, "").replace(/\/$/, "") || "/";
    out.push({ file, path, modules });
  }
  return out;
}

test("toutes les pages protégées d'un module sont déclarées pour la redirection serveur", () => {
  const routes = guardedRoutes();
  assert.ok(routes.length > 20, `trop peu de pages trouvées (${routes.length}) : lecture à revoir`);
  for (const r of routes) {
    const rule = PROTECTED_PATH_MODULES.find(
      (p) => r.path === p.prefix || r.path.startsWith(`${p.prefix}/`),
    );
    assert.ok(rule, `${r.file} (${r.path}) absent de PROTECTED_PATH_MODULES`);
    assert.deepEqual([...rule.anyOf].sort(), r.modules, `${r.file} : modules différents`);
  }
});

test("chaque règle correspond à au moins une page réelle", () => {
  const routes = guardedRoutes();
  for (const rule of PROTECTED_PATH_MODULES) {
    assert.ok(
      routes.some((r) => r.path === rule.prefix || r.path.startsWith(`${rule.prefix}/`)),
      `${rule.prefix} ne correspond à aucune page`,
    );
  }
});
