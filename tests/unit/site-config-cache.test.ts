/**
 * Cache serveur de la configuration du site : une lecture par minute, une seule requête en vol,
 * dernière valeur connue servie en cas de panne de base.
 * Lancer : node --test tests/unit/*.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  DELAI_REPRISE_SITE_MS,
  DUREE_CACHE_SITE_MS,
  creerCacheSite,
} from "../../src/lib/site-config.cache.ts";
import { fallbackSiteConfig, type SiteConfig } from "../../src/lib/site-config.ts";

const REPO = join(import.meta.dirname, "..", "..");

/** Configuration reconnaissable par son nom court. */
function config(shortName: string): SiteConfig {
  return { ...fallbackSiteConfig, brand: { ...fallbackSiteConfig.brand, shortName } };
}

/** Horloge pilotée par le test et chargeur comptant ses appels, à réponse contrôlée. */
function banc(reponses: Array<SiteConfig | Error>) {
  let horloge = 1_000_000;
  let appels = 0;
  const cache = creerCacheSite({
    charger: async () => {
      const r = reponses[appels++] ?? new Error("réponse non prévue");
      if (r instanceof Error) throw r;
      return r;
    },
    maintenant: () => horloge,
  });
  return {
    cache,
    appels: () => appels,
    avancer: (ms: number) => {
      horloge += ms;
    },
  };
}

test("durée : une lecture sert toutes les demandes pendant 60 secondes, puis la base est relue", async () => {
  const b = banc([config("A"), config("B")]);
  assert.equal((await b.cache.lire()).brand.shortName, "A");
  b.avancer(DUREE_CACHE_SITE_MS - 1);
  assert.equal((await b.cache.lire()).brand.shortName, "A");
  assert.equal(b.appels(), 1);
  b.avancer(1);
  assert.equal((await b.cache.lire()).brand.shortName, "B");
  assert.equal(b.appels(), 2);
});

test("la durée par défaut est de 60 secondes", () => {
  assert.equal(DUREE_CACHE_SITE_MS, 60_000);
});

test("requête unique : dix demandes simultanées déclenchent une seule lecture", async () => {
  let resoudre: (c: SiteConfig) => void = () => {};
  let appels = 0;
  const cache = creerCacheSite({
    charger: () => {
      appels++;
      return new Promise<SiteConfig>((r) => {
        resoudre = r;
      });
    },
  });
  const demandes = Array.from({ length: 10 }, () => cache.lire());
  assert.equal(appels, 1);
  resoudre(config("A"));
  const resultats = await Promise.all(demandes);
  assert.ok(resultats.every((c) => c.brand.shortName === "A"));
  assert.equal(appels, 1);
  // Lecture suivante dans la minute : toujours aucune nouvelle requête.
  assert.equal((await cache.lire()).brand.shortName, "A");
  assert.equal(appels, 1);
});

test("erreur de base : la dernière valeur connue est servie, nouvelle tentative après le délai de reprise", async () => {
  const b = banc([config("A"), new Error("panne"), new Error("panne"), config("B")]);
  assert.equal((await b.cache.lire()).brand.shortName, "A");
  b.avancer(DUREE_CACHE_SITE_MS);
  // Panne : A reste servie, une seule lecture tentée.
  assert.equal((await b.cache.lire()).brand.shortName, "A");
  assert.equal(b.appels(), 2);
  // Juste après la panne : pas de nouvelle tentative.
  b.avancer(DELAI_REPRISE_SITE_MS - 1);
  assert.equal((await b.cache.lire()).brand.shortName, "A");
  assert.equal(b.appels(), 2);
  // Délai écoulé : nouvelle tentative, encore en panne, A toujours servie.
  b.avancer(1);
  assert.equal((await b.cache.lire()).brand.shortName, "A");
  assert.equal(b.appels(), 3);
  // La base revient : B servie.
  b.avancer(DELAI_REPRISE_SITE_MS);
  assert.equal((await b.cache.lire()).brand.shortName, "B");
  assert.equal(b.appels(), 4);
});

test("erreur de base sans valeur connue : l'erreur remonte, la demande suivante réessaie", async () => {
  const b = banc([new Error("panne"), config("A")]);
  await assert.rejects(b.cache.lire(), /panne/);
  assert.equal((await b.cache.lire()).brand.shortName, "A");
  assert.equal(b.appels(), 2);
});

test("erreur de base pendant des demandes simultanées : une seule tentative, toutes servies", async () => {
  const b = banc([config("A"), new Error("panne")]);
  await b.cache.lire();
  b.avancer(DUREE_CACHE_SITE_MS);
  const resultats = await Promise.all([b.cache.lire(), b.cache.lire(), b.cache.lire()]);
  assert.ok(resultats.every((c) => c.brand.shortName === "A"));
  assert.equal(b.appels(), 2);
});

test("oublier : la lecture suivante interroge la base", async () => {
  const b = banc([config("A"), config("B")]);
  await b.cache.lire();
  b.cache.oublier();
  assert.equal((await b.cache.lire()).brand.shortName, "B");
  assert.equal(b.appels(), 2);
});

test("loadSiteConfig passe par le cache (src/lib/site-config.functions.ts)", () => {
  const source = readFileSync(join(REPO, "src", "lib", "site-config.functions.ts"), "utf8");
  assert.match(source, /creerCacheSite\(\{ charger: lireSiteConfig \}\)/);
  assert.match(source, /handler\(\(\) => cacheSite\.lire\(\)\)/);
});
