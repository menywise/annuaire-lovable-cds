import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { MapPin } from "lucide-react";
import { PageShell } from "@/components/cds/SiteHeader";
import { AdSlot } from "@/components/cds/AdSlot";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { requireFeature } from "@/config/features";
import { listMarketplaceListings } from "@/lib/marketplace.functions";
import { seo } from "@/lib/seo";
import { formatDate, formatPrice } from "@/lib/format";

export const Route = createFileRoute("/marketplace/")({
  beforeLoad: () => requireFeature("marketplace"),
  loader: () => listMarketplaceListings(),
  head: () =>
    seo({
      title: "Petites annonces",
      description:
        "Les annonces publiées par les membres : matériel, services et opportunités. Vous contactez le vendeur directement par messagerie privée.",
      path: "/marketplace",
    }),
  errorComponent: () => (
    <PageShell>
      <p className="text-sm text-muted-foreground">Les annonces n'ont pas pu être chargées.</p>
    </PageShell>
  ),
  notFoundComponent: () => (
    <PageShell>
      <p className="text-sm text-muted-foreground">Cette page n'existe pas.</p>
    </PageShell>
  ),
  component: MarketplacePage,
});

function MarketplacePage() {
  const { listings, categories } = Route.useLoaderData();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [sort, setSort] = useState("recent");

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const rows = listings.filter((item) => {
      if (category && item.category_id !== category) return false;
      if (!needle) return true;
      return `${item.title} ${item.description ?? ""} ${item.city ?? ""}`
        .toLowerCase()
        .includes(needle);
    });
    const sorted = [...rows];
    if (sort === "prix-croissant") sorted.sort((a, b) => a.price_cents - b.price_cents);
    if (sort === "prix-decroissant") sorted.sort((a, b) => b.price_cents - a.price_cents);
    return sorted;
  }, [listings, query, category, sort]);

  return (
    <PageShell>
      <div className="mx-auto max-w-[1000px]">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-primary-text">
              Petites annonces
            </p>
            <h1 className="mt-2 text-3xl font-bold text-foreground">
              Ce que les membres cèdent, prêtent ou proposent
            </h1>
            <p className="mt-2 max-w-[65ch] text-sm text-muted-foreground">
              Pas d'intermédiaire, pas de commission : vous contactez la personne directement par
              messagerie privée et vous convenez ensemble.
            </p>
          </div>
          <Button asChild title="Publier une annonce">
            <Link to="/marketplace/publier">Publier une annonce</Link>
          </Button>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="m-search">Rechercher</Label>
            <Input
              id="m-search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Un mot-clé, une ville…"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="m-cat">Catégorie</Label>
            <select
              id="m-cat"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="h-11 w-full rounded-md border border-border bg-card px-3 text-sm text-foreground"
            >
              <option value="">Toutes</option>
              {categories.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="m-sort">Trier</Label>
            <select
              id="m-sort"
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              className="h-11 w-full rounded-md border border-border bg-card px-3 text-sm text-foreground"
            >
              <option value="recent">Les plus récentes</option>
              <option value="prix-croissant">Prix croissant</option>
              <option value="prix-decroissant">Prix décroissant</option>
            </select>
          </div>
        </div>

        <p className="mt-4 text-xs text-muted-foreground" aria-live="polite">
          {visible.length} annonce{visible.length > 1 ? "s" : ""} en ligne.
        </p>

        {visible.length === 0 ? (
          <p className="mt-6 rounded-lg border border-border bg-card p-6 text-sm text-muted-foreground">
            Aucune annonce pour l'instant. La première publiée sera la plus vue.
          </p>
        ) : (
          <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {visible.map((item) => (
              <li key={item.id} className="flex flex-col rounded-xl border border-border bg-card p-5 shadow-sm">
                {(item.photos ?? [])[0] ? (
                  <img
                    src={(item.photos ?? [])[0]}
                    alt={`Photo de l'annonce ${item.title}`}
                    loading="lazy"
                    className="mb-3 aspect-video w-full rounded-lg object-cover"
                  />
                ) : null}
                <h2 className="text-base font-semibold text-foreground">
                  <Link
                    to="/marketplace/$slug"
                    params={{ slug: item.slug }}
                    title={`Voir l'annonce ${item.title}`}
                    className="hover:underline"
                  >
                    {item.title}
                  </Link>
                </h2>
                <p className="mt-2 text-sm font-semibold text-primary-text">
                  {formatPrice(item.price_cents, item.currency ?? "EUR")}
                  {item.negotiable ? (
                    <span className="ml-2 text-xs font-normal text-muted-foreground">
                      à débattre
                    </span>
                  ) : null}
                </p>
                <p className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  {item.city ? (
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="size-3.5" aria-hidden="true" />
                      {item.city}
                    </span>
                  ) : null}
                  <span>{formatDate(item.created_at)}</span>
                </p>
              </li>
            ))}
          </ul>
        )}

        <AdSlot placement="marketplace" className="mt-10" />
      </div>
    </PageShell>
  );
}
