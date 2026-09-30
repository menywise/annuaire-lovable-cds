/**
 * CDS — Géographie (lot 11) : conversion des réponses de geo.api.gouv.fr en lignes `geo_places`.
 * Fichier sans dépendance (testé par tests/unit/geo-import.test.ts). Même modèle que l'annuaire
 * (annuaire-mac97000, src/lib/geo.server.ts) pour que ses données se reprennent telles quelles.
 */

export const GEO_API = "https://geo.api.gouv.fr";

/** Adresses appelées : un seul endroit, lisible par l'admin. */
export const GEO_ENDPOINTS = {
  regions: "/regions?fields=nom,code",
  departements: "/departements?fields=nom,code,codeRegion",
  epcis: "/epcis?fields=nom,code,population,codesDepartements",
  communes: (departement: string) =>
    `/departements/${encodeURIComponent(departement)}/communes?fields=nom,code,codesPostaux,population,codeEpci,codeDepartement,centre`,
};

/** Code de département valide (01 à 95, 2A, 2B, 971 à 976). */
export const DEPARTEMENT_CODE = /^(0[1-9]|1[0-9]|2[1-9]|[3-8][0-9]|9[0-5]|2A|2B|97[1-6])$/;

export type GeoKind = "pays" | "region" | "departement" | "epci" | "commune";

export type GeoPlaceRow = {
  country_code: "FR";
  kind: GeoKind;
  code: string;
  name: string;
  slug: string;
  parent_code: string | null;
  epci_code: string | null;
  postal_codes: string[];
  population: number | null;
  latitude: number | null;
  longitude: number | null;
  attributes: Record<string, unknown>;
  source: string;
};

export function geoSlug(name: string) {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/['’]/g, "-")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const text = (v: unknown) => (typeof v === "string" ? v.trim() : "");
const int = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? Math.round(v) : null);

function row(
  kind: GeoKind,
  code: string,
  name: string,
  extra: Partial<GeoPlaceRow> = {},
): GeoPlaceRow {
  return {
    country_code: "FR",
    kind,
    code,
    name,
    slug: geoSlug(name),
    parent_code: null,
    epci_code: null,
    postal_codes: [],
    population: null,
    latitude: null,
    longitude: null,
    attributes: {},
    source: "geo.api.gouv.fr",
    ...extra,
  };
}

/** Racine de l'arbre : la France. */
export const FRANCE = row("pays", "FR", "France");

type Api = Record<string, unknown>;
const list = (data: unknown): Api[] =>
  Array.isArray(data) ? data.filter((x): x is Api => !!x && typeof x === "object") : [];

export function toRegions(data: unknown): GeoPlaceRow[] {
  return list(data)
    .filter((r) => text(r["code"]) && text(r["nom"]))
    .map((r) => row("region", text(r["code"]), text(r["nom"]), { parent_code: "FR" }));
}

export function toDepartements(data: unknown): GeoPlaceRow[] {
  return list(data)
    .filter((d) => text(d["code"]) && text(d["nom"]))
    .map((d) =>
      row("departement", text(d["code"]), text(d["nom"]), {
        parent_code: text(d["codeRegion"]) || null,
      }),
    );
}

/** EPCI : parent = premier département ; la liste complète reste dans `attributes`. */
export function toEpcis(data: unknown): GeoPlaceRow[] {
  return list(data)
    .filter((e) => text(e["code"]) && text(e["nom"]))
    .map((e) => {
      const deps = Array.isArray(e["codesDepartements"])
        ? (e["codesDepartements"] as unknown[]).map(text).filter(Boolean)
        : [];
      return row("epci", text(e["code"]), text(e["nom"]), {
        parent_code: deps[0] ?? null,
        population: int(e["population"]),
        attributes: { departements: deps },
      });
    });
}

/** Communes d'un département ; centre GeoJSON [longitude, latitude]. */
export function toCommunes(data: unknown): GeoPlaceRow[] {
  return list(data)
    .filter((c) => text(c["code"]) && text(c["nom"]))
    .map((c) => {
      const centre = c["centre"] as { coordinates?: unknown } | undefined;
      const coords = Array.isArray(centre?.coordinates) ? (centre.coordinates as unknown[]) : [];
      const lon = typeof coords[0] === "number" ? coords[0] : null;
      const lat = typeof coords[1] === "number" ? coords[1] : null;
      const postal = Array.isArray(c["codesPostaux"])
        ? [...new Set((c["codesPostaux"] as unknown[]).map(text).filter(Boolean))].sort()
        : [];
      return row("commune", text(c["code"]), text(c["nom"]), {
        parent_code: text(c["codeDepartement"]) || null,
        epci_code: text(c["codeEpci"]) || null,
        postal_codes: postal,
        population: int(c["population"]),
        latitude: lat,
        longitude: lon,
      });
    });
}
