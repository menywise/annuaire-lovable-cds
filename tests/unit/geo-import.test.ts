/**
 * Conversion des réponses geo.api.gouv.fr (formats réels, extraits) en lignes geo_places.
 * Lancer : node --test tests/unit/*.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DEPARTEMENT_CODE,
  GEO_ENDPOINTS,
  geoSlug,
  toCommunes,
  toDepartements,
  toEpcis,
  toGeoAnnonces,
  toRegions,
} from "../../src/lib/geo-import.ts";

test("slug : accents, apostrophes, tirets", () => {
  assert.equal(geoSlug("Auvergne-Rhône-Alpes"), "auvergne-rhone-alpes");
  assert.equal(geoSlug("L'Isle-d'Abeau"), "l-isle-d-abeau");
  assert.equal(geoSlug("Saint-Étienne"), "saint-etienne");
  assert.equal(geoSlug("  Œuilly  "), "uilly");
});

test("régions et départements : parent par code", () => {
  const [r] = toRegions([{ nom: "Auvergne-Rhône-Alpes", code: "84" }]);
  assert.equal(r!.kind, "region");
  assert.equal(r!.parent_code, "FR");
  const deps = toDepartements([
    { nom: "Rhône", code: "69", codeRegion: "84" },
    { nom: "Corse-du-Sud", code: "2A", codeRegion: "94" },
    { nom: "", code: "00" },
  ]);
  assert.equal(deps.length, 2);
  assert.deepEqual(
    deps.map((d) => [d.code, d.slug, d.parent_code]),
    [
      ["69", "rhone", "84"],
      ["2A", "corse-du-sud", "94"],
    ],
  );
});

test("EPCI : premier département comme parent, liste gardée", () => {
  const [e] = toEpcis([
    { nom: "CC Test", code: "200000001", population: 12345.4, codesDepartements: ["01", "69"] },
  ]);
  assert.equal(e!.parent_code, "01");
  assert.equal(e!.population, 12345);
  assert.deepEqual(e!.attributes, { departements: ["01", "69"] });
});

test("communes : centre [longitude, latitude], codes postaux dédoublonnés", () => {
  const [c, sansCentre] = toCommunes([
    {
      nom: "Lyon",
      code: "69123",
      codesPostaux: ["69003", "69001", "69001"],
      population: 522250,
      codeEpci: "200046977",
      codeDepartement: "69",
      centre: { type: "Point", coordinates: [4.8351, 45.758] },
    },
    { nom: "Sans centre", code: "69999", codeDepartement: "69" },
  ]);
  assert.equal(c!.latitude, 45.758);
  assert.equal(c!.longitude, 4.8351);
  assert.deepEqual(c!.postal_codes, ["69001", "69003"]);
  assert.equal(c!.epci_code, "200046977");
  assert.equal(c!.parent_code, "69");
  assert.equal(sansCentre!.latitude, null);
  assert.deepEqual(sansCentre!.postal_codes, []);
});

test("réponses inattendues : aucune ligne, aucune erreur", () => {
  assert.deepEqual(toCommunes(null), []);
  assert.deepEqual(toRegions({ message: "erreur" }), []);
  assert.deepEqual(toEpcis([null, 3, "x"]), []);
});

test("adresse des communes d'un département échappée", () => {
  assert.equal(GEO_ENDPOINTS.communes("2A").startsWith("/departements/2A/communes?"), true);
  assert.equal(GEO_ENDPOINTS.communes("a/b").includes("a%2Fb"), true);
});

test("codes de département acceptés pour l'import", () => {
  for (const ok of ["01", "69", "2A", "2B", "95", "971", "976"])
    assert.ok(DEPARTEMENT_CODE.test(ok), ok);
  for (const ko of ["20", "00", "96", "977", "../x", "69 ", ""])
    assert.ok(!DEPARTEMENT_CODE.test(ko), ko);
});

test("référentiel du Studio (1.5.0) : lignes contrôlées, pays imposé, lignes fausses écartées", () => {
  const rows = toGeoAnnonces(
    [
      {
        country_code: "BE",
        kind: "commune",
        code: "21001",
        name: "Anderlecht",
        slug: "be-anderlecht",
        parent_code: "BRU",
        postal_codes: ["1070", "1070", ""],
        population: 126581.4,
        latitude: null,
        attributes: { nuts3: "BE100" },
        source: "Eurostat, LAU 2024",
      },
      { country_code: "BE", kind: "quartier", code: "x", name: "Type inconnu" },
      { country_code: "FR", kind: "commune", code: "75056", name: "Autre pays" },
      { country_code: "BE", kind: "commune", code: "", name: "Sans code" },
      { country_code: "BE", kind: "region", code: "BE-WAL", name: "Wallonie", attributes: [1, 2] },
    ],
    "BE",
  );
  assert.equal(rows.length, 2);
  const [c, r] = rows;
  assert.equal(c!.country_code, "BE");
  assert.deepEqual(c!.postal_codes, ["1070"]);
  assert.equal(c!.population, 126581);
  assert.equal(c!.latitude, null);
  assert.deepEqual(c!.attributes, { nuts3: "BE100" });
  assert.equal(r!.slug, "wallonie");
  assert.deepEqual(r!.attributes, {});
  assert.equal(r!.source, "GeoAnnonces");
  assert.deepEqual(toGeoAnnonces(null, "BE"), []);
});
