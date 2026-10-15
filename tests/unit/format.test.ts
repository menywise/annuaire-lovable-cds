/**
 * Utilitaires partagés de src/lib/format.ts : une seule règle d'adresse (slugify) et un seul
 * affichage des prix (formatPrice) pour tout le socle. slugify fabrique des adresses déjà publiées
 * (blog, boutique, annuaire, annonces, ancres de la FAQ) : les accents, apostrophes et espaces
 * doivent être traités toujours de la même façon, et une adresse déjà propre doit rester identique.
 * Lancer : node --test tests/unit/*.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { formatPrice, slugify } from "../../src/lib/format.ts";

/** Espaces insécables (fines ou non) de l'affichage monétaire ramenées à une espace simple. */
const espaces = (v: string) => v.replace(/[\u00a0\u202f]/g, " ");

test("slugify : accents retirés, minuscules, espaces et apostrophes en tirets", () => {
  assert.equal(slugify("Référencement naturel"), "referencement-naturel");
  assert.equal(slugify("Délais & tarifs"), "delais-tarifs");
  assert.equal(slugify("L'école à Nîmes"), "l-ecole-a-nimes");
  assert.equal(slugify("Qu’est-ce que ça coûte ?"), "qu-est-ce-que-ca-coute");
  assert.equal(slugify("  Ça   marche  "), "ca-marche");
  assert.equal(slugify("snake_case_titre"), "snake-case-titre");
  assert.equal(slugify("ÉÈÊËÀÂÄÎÏÔÖÙÛÜÇ"), "eeeeaaaiioouuuc");
});

test("slugify : une adresse déjà publiée reste identique", () => {
  for (const slug of ["mon-premier-article", "v1-2", "formation-seo-2026", "a"]) {
    assert.equal(slugify(slug), slug);
  }
  assert.equal(slugify(""), "");
  assert.equal(slugify("---"), "");
});

test("formatPrice : gratuit, entiers sans décimales, centimes affichés", () => {
  assert.equal(formatPrice(0), "Gratuit");
  assert.equal(espaces(formatPrice(1000)), "10 €");
  assert.equal(espaces(formatPrice(1990)), "19,90 €");
  assert.equal(espaces(formatPrice(1000, "USD")), "10 $US");
});
