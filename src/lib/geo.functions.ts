import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { GEO_NIVEAUX, PAYS_CODE } from "@/lib/geo-import";

type Ctx = {
  supabase: import("@supabase/supabase-js").SupabaseClient<
    import("@/integrations/supabase/types").Database
  >;
  userId: string;
};

async function assertAdmin(context: Ctx) {
  const { data: isAdmin } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (!isAdmin) throw new Error("Réservé aux administrateurs.");
}

export type GeoStatus = {
  lieux: Partial<Record<"pays" | "region" | "departement" | "epci" | "commune", number>>;
  departements_sans_communes: string[];
  voisins_a_calculer: number;
  voisinages: number;
};

/** État du référentiel (lecture publique, calculé en base). */
export const geoStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<GeoStatus> => {
    const { data, error } = await context.supabase.rpc("geo_status");
    if (error) throw new Error("État du référentiel illisible.");
    return data as unknown as GeoStatus;
  });

/** Étape 1 : France, régions, départements, intercommunalités. */
export const importGeoSocle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { importSocle } = await import("@/lib/geo.server");
    return importSocle(context.supabase);
  });

/** Étape 2 : communes, quelques départements à la fois (à relancer jusqu'à 0). */
export const importGeoCommunes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { lots?: number }) => ({
    lots: Math.min(Math.max(Math.round(Number(input?.lots) || 3), 1), 10),
  }))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { importCommunes } = await import("@/lib/geo.server");
    return importCommunes(context.supabase, data.lots);
  });

/** Étape 3 : voisines de chaque commune (25 km, 8 au plus), par paquets. */
export const computeGeoNeighbours = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { limit?: number }) => ({
    limit: Math.min(Math.max(Math.round(Number(input?.limit) || 300), 10), 2000),
  }))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { data: n, error } = await context.supabase.rpc("geo_compute_neighbours", {
      _rayon_km: 25,
      _max: 8,
      _limit: data.limit,
    });
    if (error) throw new Error(`Calcul impossible : ${error.message}`);
    return { communes: n ?? 0 };
  });

/** Référentiel du Studio (GeoAnnonces, socle 1.5.0) : pays disponibles. */
export const geoStudioPays = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { studioPays } = await import("@/lib/geo.server");
    return studioPays();
  });

/** Référentiel du Studio : un niveau d'un pays, par paquets (à relancer tant que `suivant` existe). */
export const importGeoStudio = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { pays?: string; niveau?: string; apres?: string | null }) => {
    const pays = String(input?.pays ?? "").toUpperCase();
    const niveau = String(input?.niveau ?? "");
    if (!PAYS_CODE.test(pays)) throw new Error("Pays : code ISO à deux lettres.");
    if (!(GEO_NIVEAUX as readonly string[]).includes(niveau)) throw new Error("Niveau inconnu.");
    const apres = input?.apres ? String(input.apres).slice(0, 40) : null;
    return { pays, niveau, apres };
  })
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { importStudio } = await import("@/lib/geo.server");
    return importStudio(context.supabase, data.pays, data.niveau, data.apres, 3);
  });
