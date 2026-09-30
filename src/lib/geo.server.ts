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
