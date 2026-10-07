/**
 * CDS — Géographie (lot 11) : import depuis geo.api.gouv.fr (serveur seulement).
 * Écrit avec le client de l'admin connecté (règles d'accès : admin seul), jamais la clé de service.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import {
  DEPARTEMENT_CODE,
  FRANCE,
  GEO_API,
  GEO_ENDPOINTS,
  toCommunes,
  toDepartements,
  toEpcis,
  toGeoAnnonces,
  toRegions,
  type GeoPlaceRow,
} from "@/lib/geo-import";

type Client = SupabaseClient<Database>;
const TIMEOUT_MS = 20_000;
const BATCH = 500;

async function apiGet(path: string): Promise<unknown> {
  const res = await fetch(`${GEO_API}${path}`, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`geo.api.gouv.fr a répondu ${res.status}`);
  return res.json();
}

async function upsert(client: Client, rows: GeoPlaceRow[]) {
  for (let i = 0; i < rows.length; i += BATCH) {
    const { error } = await client
      .from("geo_places")
      .upsert(rows.slice(i, i + BATCH) as never, { onConflict: "country_code,kind,code" });
    if (error) throw new Error(`Enregistrement impossible : ${error.message}`);
  }
  return rows.length;
}

/** France, régions, départements, EPCI (dans cet ordre : chaque lieu retrouve son parent). */
export async function importSocle(client: Client) {
  const [regions, departements, epcis] = await Promise.all([
    apiGet(GEO_ENDPOINTS.regions).then(toRegions),
    apiGet(GEO_ENDPOINTS.departements).then(toDepartements),
    apiGet(GEO_ENDPOINTS.epcis).then(toEpcis),
  ]);
  await upsert(client, [FRANCE]);
  return {
    regions: await upsert(client, regions),
    departements: await upsert(client, departements),
    epcis: await upsert(client, epcis),
  };
}

/** Communes de quelques départements pas encore importés ; reprend où il s'était arrêté. */
export async function importCommunes(client: Client, lots: number) {
  const { data: status, error } = await client.rpc("geo_status");
  if (error) throw new Error("État du référentiel illisible.");
  const pending = (
    (status as { departements_sans_communes?: string[] })?.departements_sans_communes ?? []
  )
    .filter((code) => DEPARTEMENT_CODE.test(code))
    .slice(0, lots);
  let communes = 0;
  for (const code of pending) {
    communes += await upsert(client, toCommunes(await apiGet(GEO_ENDPOINTS.communes(code))));
  }
  return { departements: pending, communes };
}

// --- Référentiel du Studio (GeoAnnonces), socle 1.5.0 ------------------------------------------
// Adresse et clé dans les secrets du projet (jamais dans le code) : CDS_GEO_URL, CDS_GEO_CLE.

const PAGE = 1000;

function studio() {
  const url = process.env["CDS_GEO_URL"]?.trim().replace(/\/+$/, "");
  const cle = process.env["CDS_GEO_CLE"]?.trim();
  if (!url || !cle) {
    throw new Error(
      "Référentiel du Studio non relié : renseigner les secrets CDS_GEO_URL et CDS_GEO_CLE (Lovable → Cloud → Secrets).",
    );
  }
  return { url, cle };
}

async function studioGet(path: string): Promise<Record<string, unknown>> {
  const { url, cle } = studio();
  const res = await fetch(`${url}/api/geo/v1${path}`, {
    headers: { Accept: "application/json", "X-Api-Key": cle },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const body = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  if (!res.ok || !body) {
    const erreur = typeof body?.["erreur"] === "string" ? body["erreur"] : `réponse ${res.status}`;
    throw new Error(`Référentiel du Studio : ${erreur}`);
  }
  return body;
}

/** Pays proposés par le référentiel du Studio. */
export async function studioPays(): Promise<{ code: string; name: string }[]> {
  const body = await studioGet("/pays");
  const pays = Array.isArray(body["pays"]) ? (body["pays"] as Record<string, unknown>[]) : [];
  return pays
    .map((p) => ({ code: String(p["code"] ?? ""), name: String(p["name"] ?? "") }))
    .filter((p) => /^[A-Z]{2}$/.test(p.code) && p.name);
}

/** Un niveau d'un pays, quelques paquets à la fois ; `suivant` dit où reprendre (null : terminé). */
export async function importStudio(
  client: Client,
  pays: string,
  niveau: string,
  apres: string | null,
  paquets: number,
) {
  let suivant = apres;
  let lieux = 0;
  for (let i = 0; i < paquets; i++) {
    const query = new URLSearchParams({ pays, niveau, limite: String(PAGE) });
    if (suivant) query.set("apres", suivant);
    const body = await studioGet(`/lieux?${query.toString()}`);
    const rows = toGeoAnnonces(body["lieux"], pays);
    if (rows.length) {
      const { error } = await client.rpc("geo_importer", { _lignes: rows as never });
      if (error) throw new Error(`Enregistrement impossible : ${error.message}`);
      lieux += rows.length;
    }
    suivant = typeof body["suivant"] === "string" && body["suivant"] ? body["suivant"] : null;
    if (!suivant) break;
  }
  return { pays, niveau, lieux, suivant };
}
