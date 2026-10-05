/**
 * Réglages de l'annuaire (clé `annuaire` de `site_settings`) : valeurs par défaut et nettoyage.
 * Lancer : node --test tests/unit/*.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildSiteConfig, defaultAnnuaireSettings } from "../../src/lib/site-config.ts";

test("sans clé annuaire en base, la configuration prend les valeurs par défaut", () => {
  const { annuaire } = buildSiteConfig([]);
  assert.deepEqual(annuaire, defaultAnnuaireSettings);
  assert.equal(annuaire.titre, "Annuaire");
  assert.equal(annuaire.type_fiche, "LocalBusiness");
  assert.ok(annuaire.description.length > 0);
});

test("les valeurs saisies remplacent les défauts, champ par champ", () => {
  const { annuaire } = buildSiteConfig([
    { key: "annuaire", value: { titre: "  Nos adresses ", type_fiche: "Organization" } },
  ]);
  assert.equal(annuaire.titre, "Nos adresses");
  assert.equal(annuaire.type_fiche, "Organization");
  assert.equal(annuaire.description, defaultAnnuaireSettings.description);
});

test("valeurs vides ou mal typées : retour aux défauts", () => {
  for (const value of [null, "texte", 42, { titre: "", description: 3, type_fiche: "Person" }]) {
    assert.deepEqual(
      buildSiteConfig([{ key: "annuaire", value }]).annuaire,
      defaultAnnuaireSettings,
    );
  }
});
