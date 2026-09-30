import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * CDS — Veille de sites : actions de l'écran d'administration et proposition d'un site par un
 * membre. Le travail réseau est dans watch.server.ts (clé de service), appelé après contrôle.
 */

type Ctx = {
  supabase: import("@supabase/supabase-js").SupabaseClient<
    import("@/integrations/supabase/types").Database
  >;
  userId: string;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function assertAdmin(context: Ctx) {
  const { data: isAdmin } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (!isAdmin) throw new Error("Réservé aux administrateurs.");
}

/** Configuration (jamais les secrets eux-mêmes). */
export const watchConfig = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { firecrawlMode } = await import("@/lib/firecrawl.server");
    return {
      firecrawl: firecrawlMode(),
      hooksSecret: (process.env["WATCH_HOOKS_SECRET"] ?? "").length >= 24,
      cronSecret: Boolean(process.env["LOVABLE_CRON_SECRET"]),
    };
  });

/** Analyse d'une à cinq adresses ; « force » retient le site malgré les portiers. */
export const analyzeUrls = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { urls: string[]; force?: boolean }) => {
    const urls = (Array.isArray(input?.urls) ? input.urls : [])
      .map((u) => String(u).trim())
      .filter((u) => u.length >= 3 && u.length <= 300);
    if (urls.length === 0 || urls.length > 5) throw new Error("Indiquez de 1 à 5 adresses.");
    return { urls, force: input?.force === true };
  })
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { analyzeMany } = await import("@/lib/watch.server");
    return analyzeMany(data.urls, { source: "manuel", force: data.force });
  });

/** Recherche immédiate : une source enregistrée ou une requête libre. */
export const runDiscovery = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { sourceId?: string; query?: string; limit?: number }) => {
    const sourceId = input?.sourceId && UUID.test(input.sourceId) ? input.sourceId : undefined;
    const query = String(input?.query ?? "")
      .trim()
      .slice(0, 300);
    if (!sourceId && query.length < 3) throw new Error("Requête trop courte.");
    const limit = Math.min(20, Math.max(1, Math.floor(Number(input?.limit) || 8)));
    return { sourceId, query, limit };
  })
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { discover } = await import("@/lib/watch.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let query = data.query;
    if (data.sourceId) {
      const { data: source } = await supabaseAdmin
        .from("watch_sources")
        .select("query")
        .eq("id", data.sourceId)
        .maybeSingle();
      if (!source) throw new Error("Source introuvable.");
      query = source.query;
    }
    return discover({
      query,
      limit: data.limit,
      ...(data.sourceId ? { sourceId: data.sourceId } : {}),
    });
  });

/** Contrôle de disponibilité immédiat. */
export const runChecks = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { limit?: number }) => ({
    limit: Math.min(60, Math.max(1, Math.floor(Number(input?.limit) || 25))),
  }))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { checkSites } = await import("@/lib/watch.server");
    return checkSites(data.limit);
  });

/** Traite la file des propositions des membres. */
export const runSubmissions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { processSubmissions } = await import("@/lib/watch.server");
    return processSubmissions(10);
  });

/** Crée la fiche de l'annuaire en brouillon (droits vérifiés en base). */
export const publishWatchSite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { siteId: string }) => {
    if (!UUID.test(String(input?.siteId ?? ""))) throw new Error("Site inconnu.");
    return { siteId: String(input.siteId) };
  })
  .handler(async ({ data, context }) => {
    const { data: listingId, error } = await context.supabase.rpc("watch_publish", {
      _site_id: data.siteId,
    });
    if (error || !listingId) throw new Error(error?.message ?? "Publication impossible.");
    return { listingId };
  });

/** Proposition d'un site par un membre : contrôle d'adresse ici, limites et file en base. */
export const submitSite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { url: string; note?: string }) => ({
    url: String(input?.url ?? "")
      .trim()
      .slice(0, 300),
    note: String(input?.note ?? "")
      .trim()
      .slice(0, 500),
  }))
  .handler(async ({ data, context }) => {
    const { normalizeSiteUrl } = await import("@/lib/watch");
    const { assertPublicUrl } = await import("@/lib/url-guard");
    let url: string;
    try {
      const normalized = normalizeSiteUrl(data.url);
      assertPublicUrl(normalized.parsed);
      url = normalized.url;
    } catch {
      throw new Error("Adresse invalide : indiquez un site public, par exemple exemple.fr.");
    }
    const host = new URL(url).hostname;
    const { error } = await context.supabase.from("watch_submissions").insert({
      url,
      host,
      note: data.note,
      submitted_by: context.userId,
    });
    if (error) {
      if (error.code === "23505")
        throw new Error("Vous avez déjà proposé ce site : il est en attente.");
      if (error.code === "54000")
        throw new Error("Cinq propositions par jour au plus : réessayez demain.");
      throw new Error("Proposition non enregistrée. Réessayez dans un instant.");
    }
    return { host };
  });
