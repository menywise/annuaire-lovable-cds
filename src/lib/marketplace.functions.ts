import { createServerFn } from "@tanstack/react-start";
import { publicClient } from "@/lib/supabase-public";
import { check } from "@/lib/check";

const LISTING_FIELDS =
  "id, title, slug, description, price_cents, currency, negotiable, city, departement, photos, tags, category_id, seller_id, seller_name, created_at, views";

/** Catégories d'annonces. */
export const listMarketplaceCategories = createServerFn({ method: "GET" }).handler(async () => {
  const data = check(
    await publicClient()
      .from("marketplace_categories")
      .select("id, name, slug, icon, position")
      .order("position", { ascending: true }),
    { contexte: "marketplace_categories" },
  );
  return data ?? [];
});

/** Annonces actives et validées. */
export const listMarketplaceListings = createServerFn({ method: "GET" }).handler(async () => {
  const client = publicClient();
  const [listingsRes, categoriesRes] = await Promise.all([
    client
      .from("marketplace_listings")
      .select(LISTING_FIELDS)
      .eq("status", "active")
      .eq("approved", true)
      .order("created_at", { ascending: false })
      .limit(300),
    client
      .from("marketplace_categories")
      .select("id, name, slug, icon, position")
      .order("position", { ascending: true }),
  ]);
  return {
    listings: check(listingsRes, { contexte: "marketplace_listings" }) ?? [],
    categories: check(categoriesRes, { contexte: "marketplace_categories" }) ?? [],
  };
});

/** Détail d'une annonce active, avec des annonces similaires. */
export const getMarketplaceListing = createServerFn({ method: "GET" })
  .inputValidator((input: { slug: string }) => input)
  .handler(async ({ data: input }) => {
    const client = publicClient();
    const listing = check(
      await client
        .from("marketplace_listings")
        .select(LISTING_FIELDS)
        .eq("status", "active")
        .eq("approved", true)
        .eq("slug", input.slug)
        .maybeSingle(),
      { contexte: "marketplace_listings" },
    );
    if (!listing) return null;
    let similarQuery = client
      .from("marketplace_listings")
      .select("id, title, slug, price_cents, currency, city, photos")
      .eq("status", "active")
      .eq("approved", true)
      .neq("id", listing.id)
      .limit(4);
    if (listing.category_id) similarQuery = similarQuery.eq("category_id", listing.category_id);
    const [similarRes, categoryRes] = await Promise.all([
      similarQuery,
      listing.category_id
        ? client
            .from("marketplace_categories")
            .select("id, name, slug")
            .eq("id", listing.category_id)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
    ]);
    return {
      listing,
      similar: check(similarRes, { contexte: "marketplace_listings" }) ?? [],
      category: check(categoryRes, { contexte: "marketplace_categories" }) ?? null,
    };
  });
