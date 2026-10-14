import { createServerFn } from "@tanstack/react-start";
import { publicClient } from "@/lib/supabase-public";
import { check } from "@/lib/check";
import { laterOf } from "@/lib/sitemap";

const LISTING_FIELDS =
  "id, name, slug, excerpt, description, city, postal_code, address, departement, phone, email, website, logo_url, cover_url, photos, hours, plan, featured, verified, tags, category_id, claimed_by, latitude, longitude, created_at";

export type DirectoryCategory = {
  id: string;
  name: string;
  slug: string;
  description: string;
  icon: string;
  position: number;
};

/** Catégories de l'annuaire métier, dans l'ordre choisi en administration. */
export const listDirectoryCategories = createServerFn({ method: "GET" }).handler(async () => {
  const data = check(
    await publicClient()
      .from("directory_categories")
      .select("id, name, slug, description, icon, position")
      .order("position", { ascending: true }),
  );
  return data ?? [];
});

/** Fiches publiées, mises en avant d'abord. */
export const listDirectoryListings = createServerFn({ method: "GET" }).handler(async () => {
  const client = publicClient();
  const [listingsRes, categoriesRes, departementsRes, reviewsRes] = await Promise.all([
    client
      .from("directory_listings")
      .select(LISTING_FIELDS)
      .eq("status", "published")
      .order("featured", { ascending: false })
      .order("name", { ascending: true })
      .limit(500),
    client
      .from("directory_categories")
      .select("id, name, slug, description, icon, position")
      .order("position", { ascending: true }),
    client
      .from("geo_departements")
      .select("code, nom, region, slug")
      .order("code", { ascending: true }),
    client.from("directory_reviews").select("listing_id, rating").eq("approved", true),
  ]);
  return {
    listings: check(listingsRes) ?? [],
    categories: check(categoriesRes) ?? [],
    departements: check(departementsRes) ?? [],
    ratings: check(reviewsRes) ?? [],
  };
});

/** Colonnes d'une fiche dans une liste (page d'une catégorie) : jamais la fiche complète. */
const CARD_FIELDS = "id, name, slug, excerpt, city, plan, verified, featured, category_id";

/** Fiches d'une liste au plus (page d'une catégorie). */
const CATEGORY_LIMIT = 500;

/** Page d'une catégorie : la catégorie et ses fiches publiées, filtrées en base. */
export const getDirectoryCategory = createServerFn({ method: "GET" })
  .inputValidator((input: { slug: string }) => ({ slug: String(input?.slug ?? "").slice(0, 120) }))
  .handler(async ({ data: input }) => {
    const client = publicClient();
    const category = check(
      await client
        .from("directory_categories")
        .select("id, name, slug, description, icon, position")
        .eq("slug", input.slug)
        .maybeSingle(),
    );
    if (!category) return null;
    const listings = check(
      await client
        .from("directory_listings")
        .select(CARD_FIELDS)
        .eq("status", "published")
        .eq("category_id", category.id)
        .order("featured", { ascending: false })
        .order("name", { ascending: true })
        .limit(CATEGORY_LIMIT),
    );
    return { category, listings: listings ?? [] };
  });

/**
 * Listes du formulaire de dépôt d'une fiche : les catégories et, si `geo` est demandé, les
 * départements. Aucune fiche n'est chargée.
 */
export const listDirectoryFormOptions = createServerFn({ method: "GET" })
  .inputValidator((input: { geo: boolean }) => ({ geo: Boolean(input?.geo) }))
  .handler(async ({ data: input }) => {
    const client = publicClient();
    const [categoriesRes, departementsRes] = await Promise.all([
      client
        .from("directory_categories")
        .select("id, name, slug, description, icon, position")
        .order("position", { ascending: true }),
      input.geo
        ? client
            .from("geo_departements")
            .select("code, nom, region, slug")
            .order("code", { ascending: true })
        : Promise.resolve({ data: [], error: null }),
    ]);
    return {
      categories: check(categoriesRes) ?? [],
      departements: check(departementsRes) ?? [],
    };
  });

/** Détail d'une fiche publiée, avec ses avis validés et des fiches proches. */
export const getDirectoryListing = createServerFn({ method: "GET" })
  .inputValidator((input: { slug: string }) => input)
  .handler(async ({ data: input }) => {
    const client = publicClient();
    const listing = check(
      await client
        .from("directory_listings")
        .select(LISTING_FIELDS)
        .eq("status", "published")
        .eq("slug", input.slug)
        .maybeSingle(),
    );
    if (!listing) return null;

    const [reviewsRes, categoryRes, departementRes] = await Promise.all([
      client
        .from("directory_reviews")
        .select("id, author_name, rating, content, created_at, moderation_note, moderated_at")
        .eq("listing_id", listing.id)
        .eq("approved", true)
        .order("created_at", { ascending: false }),
      listing.category_id
        ? client
            .from("directory_categories")
            .select("id, name, slug")
            .eq("id", listing.category_id)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      listing.departement
        ? client
            .from("geo_departements")
            .select("code, nom, slug")
            .eq("code", listing.departement)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
    ]);

    let nearbyQuery = client
      .from("directory_listings")
      .select("id, name, slug, excerpt, city, plan, verified")
      .eq("status", "published")
      .neq("id", listing.id)
      .limit(6);
    if (listing.category_id) nearbyQuery = nearbyQuery.eq("category_id", listing.category_id);
    const nearby = check(await nearbyQuery);

    return {
      listing,
      reviews: check(reviewsRes) ?? [],
      category: check(categoryRes) ?? null,
      departement: check(departementRes) ?? null,
      nearby: nearby ?? [],
    };
  });

/** Liste des départements avec le nombre de fiches publiées dans chacun. */
export const listDepartements = createServerFn({ method: "GET" }).handler(async () => {
  const client = publicClient();
  const [departementsRes, listingsRes] = await Promise.all([
    client.from("geo_departements").select("code, nom, region, slug, population").order("code"),
    client.from("directory_listings").select("departement").eq("status", "published"),
  ]);
  const departements = check(departementsRes);
  const listings = check(listingsRes);
  const counts = new Map<string, number>();
  for (const row of listings ?? []) {
    if (!row.departement) continue;
    counts.set(row.departement, (counts.get(row.departement) ?? 0) + 1);
  }
  return (departements ?? []).map((dep) => ({ ...dep, listings: counts.get(dep.code) ?? 0 }));
});

/** Page d'un département : ses fiches et les départements voisins de sa région. */
export const getDepartement = createServerFn({ method: "GET" })
  .inputValidator((input: { slug: string }) => input)
  .handler(async ({ data: input }) => {
    const client = publicClient();
    const departement = check(
      await client
        .from("geo_departements")
        .select("code, nom, region, slug, population")
        .eq("slug", input.slug)
        .maybeSingle(),
    );
    if (!departement) return null;
    const [listingsRes, neighboursRes, communesRes] = await Promise.all([
      client
        .from("directory_listings")
        .select("id, name, slug, excerpt, city, plan, verified, featured, category_id")
        .eq("status", "published")
        .eq("departement", departement.code)
        .order("featured", { ascending: false })
        .order("name", { ascending: true }),
      client
        .from("geo_departements")
        .select("code, nom, slug")
        .eq("region", departement.region)
        .neq("code", departement.code)
        .order("code"),
      // Principales communes (référentiel géographique, lot 11). Lecture par fonction depuis 1.5.0 :
      // la table n'est plus lisible directement par un visiteur (pas d'export en masse).
      client.rpc("geo_communes_principales", { _departement: departement.code, _limit: 48 }),
    ]);
    return {
      departement,
      listings: check(listingsRes) ?? [],
      neighbours: check(neighboursRes) ?? [],
      communes: check(communesRes) ?? [],
    };
  });

const INSEE = /^[0-9][0-9AB][0-9]{3}$/;

/** Page d'une commune : fiches de la commune (code postal ou nom), communes voisines. */
export const getCommune = createServerFn({ method: "GET" })
  .inputValidator((input: { code: string }) => ({ code: String(input?.code ?? "").toUpperCase() }))
  .handler(async ({ data: input }) => {
    if (!INSEE.test(input.code)) return null;
    const client = publicClient();
    const commune = check(
      await client.rpc("geo_lieu", { _kind: "commune", _code: input.code }).maybeSingle(),
    );
    if (!commune) return null;
    const fields = "id, name, slug, excerpt, city, plan, verified, featured, category_id";
    const [departementRes, epciRes, neighboursRes, byPostalRes, byNameRes] = await Promise.all([
      client
        .from("geo_departements")
        .select("code, nom, slug, region")
        .eq("code", commune.parent_code ?? "")
        .maybeSingle(),
      commune.epci_code
        ? client.rpc("geo_lieu", { _kind: "epci", _code: commune.epci_code }).maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      client.rpc("geo_neighbours", { _code: commune.code, _limit: 12 }),
      commune.postal_codes.length
        ? client
            .from("directory_listings")
            .select(fields)
            .eq("status", "published")
            .in("postal_code", commune.postal_codes)
        : Promise.resolve({ data: [], error: null }),
      client
        .from("directory_listings")
        .select(fields)
        .eq("status", "published")
        .eq("departement", commune.parent_code ?? "")
        .ilike("city", commune.name.replace(/[%_\\]/g, "")),
    ]);
    const departement = check(departementRes);
    const epci = check(epciRes);
    const neighbours = check(neighboursRes);
    const seen = new Set<string>();
    const listings = [...(check(byPostalRes) ?? []), ...(check(byNameRes) ?? [])]
      .filter((l) => !seen.has(l.id) && seen.add(l.id))
      .sort((a, b) => Number(b.featured) - Number(a.featured) || a.name.localeCompare(b.name));
    return { commune, departement, epci, neighbours: neighbours ?? [], listings };
  });

/** Plafond d'adresses de fiches dans le plan du site. */
const SITEMAP_LIMIT = 5000;

/** Adresse d'un plan du site avec sa date réelle de modification (ISO) ou `null`. */
export type SitemapEntry = { slug: string; updated_at: string | null };

/**
 * Adresses publiques de l'annuaire pour le plan du site, chacune avec sa date réelle de
 * modification : fiches publiées, catégories (date de la catégorie ou de sa fiche la plus
 * récemment modifiée) et, si `geo` est demandé, départements qui ont au moins une fiche publiée
 * (date de la fiche la plus récemment modifiée du département).
 */
export const listDirectorySitemap = createServerFn({ method: "GET" })
  .inputValidator((input: { geo: boolean }) => ({ geo: Boolean(input?.geo) }))
  .handler(async ({ data: input }) => {
    const client = publicClient();
    const [listingsRes, categoriesRes] = await Promise.all([
      client
        .from("directory_listings")
        .select("slug, departement, category_id, updated_at")
        .eq("status", "published")
        .order("name", { ascending: true })
        .limit(SITEMAP_LIMIT),
      client
        .from("directory_categories")
        .select("id, slug, updated_at")
        .order("position")
        .limit(500),
    ]);
    const listings = check(listingsRes) ?? [];
    const categories = check(categoriesRes) ?? [];
    const byCategory = new Map<string, string | null>();
    const byDepartement = new Map<string, string | null>();
    for (const l of listings) {
      if (l.category_id) {
        byCategory.set(l.category_id, laterOf(byCategory.get(l.category_id), l.updated_at));
      }
      if (l.departement) {
        byDepartement.set(l.departement, laterOf(byDepartement.get(l.departement), l.updated_at));
      }
    }
    let departements: SitemapEntry[] = [];
    if (input.geo) {
      const codes = [...byDepartement.keys()];
      if (codes.length) {
        const rows = check(
          await client.from("geo_departements").select("code, slug").in("code", codes),
        );
        departements = (rows ?? []).map((d) => ({
          slug: d.slug,
          updated_at: byDepartement.get(d.code) ?? null,
        }));
      }
    }
    return {
      listings: listings.map((l) => ({ slug: l.slug, updated_at: l.updated_at })),
      categories: categories.map((c) => ({
        slug: c.slug,
        updated_at: laterOf(c.updated_at, byCategory.get(c.id)),
      })),
      departements,
    };
  });
