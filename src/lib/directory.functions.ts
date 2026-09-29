import { createServerFn } from "@tanstack/react-start";
import { publicClient } from "@/lib/supabase-public";

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
  const { data } = await publicClient()
    .from("directory_categories")
    .select("id, name, slug, description, icon, position")
    .order("position", { ascending: true });
  return data ?? [];
});

/** Fiches publiées, mises en avant d'abord. */
export const listDirectoryListings = createServerFn({ method: "GET" }).handler(async () => {
  const client = publicClient();
  const [{ data: listings }, { data: categories }, { data: departements }, { data: reviews }] =
    await Promise.all([
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
    listings: listings ?? [],
    categories: categories ?? [],
    departements: departements ?? [],
    ratings: reviews ?? [],
  };
});

/** Détail d'une fiche publiée, avec ses avis validés et des fiches proches. */
export const getDirectoryListing = createServerFn({ method: "GET" })
  .inputValidator((input: { slug: string }) => input)
  .handler(async ({ data: input }) => {
    const client = publicClient();
    const { data: listing } = await client
      .from("directory_listings")
      .select(LISTING_FIELDS)
      .eq("status", "published")
      .eq("slug", input.slug)
      .maybeSingle();
    if (!listing) return null;

    const [{ data: reviews }, { data: category }, { data: departement }] = await Promise.all([
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
        : Promise.resolve({ data: null }),
      listing.departement
        ? client
            .from("geo_departements")
            .select("code, nom, slug")
            .eq("code", listing.departement)
            .maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

    let nearbyQuery = client
      .from("directory_listings")
      .select("id, name, slug, excerpt, city, plan, verified")
      .eq("status", "published")
      .neq("id", listing.id)
      .limit(6);
    if (listing.category_id) nearbyQuery = nearbyQuery.eq("category_id", listing.category_id);
    const { data: nearby } = await nearbyQuery;

    return {
      listing,
      reviews: reviews ?? [],
      category: category ?? null,
      departement: departement ?? null,
      nearby: nearby ?? [],
    };
  });

/** Liste des départements avec le nombre de fiches publiées dans chacun. */
export const listDepartements = createServerFn({ method: "GET" }).handler(async () => {
  const client = publicClient();
  const [{ data: departements }, { data: listings }] = await Promise.all([
    client.from("geo_departements").select("code, nom, region, slug, population").order("code"),
    client.from("directory_listings").select("departement").eq("status", "published"),
  ]);
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
    const { data: departement } = await client
      .from("geo_departements")
      .select("code, nom, region, slug, population")
      .eq("slug", input.slug)
      .maybeSingle();
    if (!departement) return null;
    const [{ data: listings }, { data: neighbours }] = await Promise.all([
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
    ]);
    return { departement, listings: listings ?? [], neighbours: neighbours ?? [] };
  });
