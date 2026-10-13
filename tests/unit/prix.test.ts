/**
 * Prix négatifs refusés : les formulaires (annonce, formation, offre, éditeur générique de
 * l'administration) lisent le prix par lirePrix(), qui refuse un montant négatif avec un message
 * clair. La base porte la même règle (contraintes *_price_check, tests/db/test_27).
 * Lancer : node --test tests/unit/*.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PRIX_INVALIDE, PRIX_NEGATIF, lirePrix } from "../../src/lib/prix.ts";

const REPO = join(import.meta.dirname, "..", "..");
const lire = (chemin: string) => readFileSync(join(REPO, chemin), "utf8");

test("lirePrix : euros en centimes, virgule ou point, vide = 0", () => {
  assert.deepEqual(lirePrix("19,90"), { cents: 1990, erreur: null });
  assert.deepEqual(lirePrix("19.90"), { cents: 1990, erreur: null });
  assert.deepEqual(lirePrix(" 25 "), { cents: 2500, erreur: null });
  assert.deepEqual(lirePrix("1 250,5"), { cents: 125050, erreur: null });
  assert.deepEqual(lirePrix(""), { cents: 0, erreur: null });
  assert.deepEqual(lirePrix("0"), { cents: 0, erreur: null });
  assert.deepEqual(lirePrix("-0"), { cents: 0, erreur: null });
  assert.deepEqual(lirePrix("0,004"), { cents: 0, erreur: null });
});

test("lirePrix : un montant négatif est refusé avec un message clair", () => {
  for (const saisie of ["-5", "-500", "-0,01", "-19,90"]) {
    const prix = lirePrix(saisie);
    assert.equal(prix.cents, null, saisie);
    assert.equal(prix.erreur, PRIX_NEGATIF, saisie);
  }
});

test("lirePrix : un texte illisible est refusé avec un exemple", () => {
  for (const saisie of ["abc", "19,90 €", "1e999", "NaN", "--5"]) {
    const prix = lirePrix(saisie);
    assert.equal(prix.cents, null, saisie);
    assert.equal(prix.erreur, PRIX_INVALIDE, saisie);
    assert.ok(prix.cents === null && prix.detail, saisie);
  }
});

test("garde : les formulaires de prix passent par lirePrix, sans conversion maison", () => {
  const ecrans = [
    "src/routes/marketplace.publier.tsx",
    "src/routes/_authenticated/admin.formations.tsx",
    "src/routes/_authenticated/admin.contenus.tsx",
    "src/components/cds/RecordEditor.tsx",
  ];
  for (const chemin of ecrans) {
    const source = lire(chemin);
    assert.match(source, /from "@\/lib\/prix"/, `${chemin} importe lirePrix`);
    assert.doesNotMatch(
      source,
      /Math\.round\(Number\([^)]*price/,
      `${chemin} convertit encore le prix à la main`,
    );
    assert.doesNotMatch(source, /Math\.max\(0,/, `${chemin} écrase un prix négatif en silence`);
  }
});
