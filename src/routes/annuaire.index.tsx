import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { BadgeCheck, MapPin, Star } from "lucide-react";
import { PageShell } from "@/components/cds/SiteHeader";
import { AdSlot } from "@/components/cds/AdSlot";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { requireFeature, isFeatureOn } from "@/config/features";
import { listDirectoryListings } from "@/lib/directory.functions";
import { seo } from "@/lib/seo";

const PAGE_SIZE = 20;

export const Route = createFileRoute("/annuaire/")({
  beforeLoad: () => requireFeature("directory"),
  loader: () => listDirectoryListings(),
  head: () =>
    seo({
      title: "Annuaire des professionnels",
      description:
        "Trouvez le professionnel qu'il vous faut : filtrez par activité, par département et par mot-clé, puis contactez-le directement.",
      path: "/annuaire",
    }),
  errorComponent: () => (
    <PageShell>
      <p className="text-sm text-muted-foreground">L'annuaire n'a pas pu être chargé.</p>
    </PageShell>
  ),
  notFoundComponent: () => (
    <PageShell>
      <p className="text-sm text-muted-foreground">Cette page n'existe pas.</p>
    </PageShell>
  ),
  component: DirectoryIndex,
});

function DirectoryIndex() {
  const { listings, categories, departements, ratings } = Route.useLoaderData();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [departement, setDepartement] = useState("");
  const [sort, setSort] = useState("pertinence");
  const [page, setPage] = useState(1);

  const averages = useMemo(() => {
    const sums = new Map<string, { total: number; count: number }>();
    for (const row of ratings) {
      const current = sums.get(row.listing_id) ?? { total: 0, count: 0 };
      sums.set(row.listing_id, { total: current.total + row.rating, count: current.count + 1 });
    }
    return sums;
  }, [ratings]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const result = listings.filter((item) => {
      if (category && item.category_id !== category) return false;
      if (departement && item.departement !== departement) return false;
      if (!needle) return true;
      return `${item.name} ${item.excerpt} ${item.city} ${(item.tags ?? []).join(" ")}`
        .toLowerCase()
        .includes(needle);
    });
    const score = (id: string) => {
      const entry = averages.get(id);
      return entry ? entry.total / entry.count : 0;
    };
    if (sort === "note") return [...result].sort((a, b) => score(b.id) - score(a.id));
    if (sort === "nom") return [...result].sort((a, b) => a.name.localeCompare(b.name, "fr"));
    if (sort === "recent")
      return [...result].sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
    return result;
  }, [listings, query, category, departement, sort, averages]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(page, pageCount);
  const visible = filtered.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);

  return (
    <PageShell>
      <div className="mx-auto max-w-[1000px]">
        <p className="text-xs font-medium uppercase tracking-wide text-primary-text">Annuaire</p>
        <h1 className="mt-2 text-3xl font-bold text-foreground">
          Le bon professionnel, près de chez vous
        </h1>
        <p className="mt-2 max-w-[70ch] text-sm text-muted-foreground">
          Chaque fiche dit qui fait quoi, où, et comment le joindre. Vous comparez calmement, vous
          contactez quand vous êtes prêt.
        </p>

        <div className="mt-6 grid gap-3 rounded-xl border border-border bg-card p-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1.5">
            <Label htmlFor="ann-q">Rechercher</Label>
            <Input
              id="ann-q"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(1);
              }}
              placeholder="Nom, activité, ville…"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ann-cat">Activité</Label>
            <select
              id="ann-cat"
              value={category}
              onChange={(e) => {
                setCategory(e.target.value);
                setPage(1);
              }}
              className="h-11 w-full rounded-md border border-border bg-card px-3 text-sm text-foreground"
            >
              <option value="">Toutes les activités</option>
              {categories.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </div>
          {isFeatureOn("geo") ? (
            <div className="space-y-1.5">
              <Label htmlFor="ann-dep">Département</Label>
              <select
                id="ann-dep"
                value={departement}
                onChange={(e) => {
                  setDepartement(e.target.value);
                  setPage(1);
                }}
                className="h-11 w-full rounded-md border border-border bg-card px-3 text-sm text-foreground"
              >
                <option value="">Toute la France</option>
                {departements.map((dep) => (
                  <option key={dep.code} value={dep.code}>
                    {dep.code} — {dep.nom}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
          <div className="space-y-1.5">
            <Label htmlFor="ann-sort">Trier</Label>
            <select
              id="ann-sort"
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              className="h-11 w-full rounded-md border border-border bg-card px-3 text-sm text-foreground"
            >
              <option value="pertinence">Pertinence</option>
              <option value="note">Meilleures notes</option>
              <option value="nom">Nom</option>
              <option value="recent">Plus récentes</option>
            </select>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            {filtered.length} fiche{filtered.length > 1 ? "s" : ""} correspondent à votre recherche.
          </p>
          <div className="flex flex-wrap gap-2">
            {isFeatureOn("geo") ? (
              <Link
                to="/annuaire/departements"
                title="Parcourir l'annuaire département par département"
                className="inline-flex min-h-11 items-center rounded-md border border-border px-3 text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                Par département
              </Link>
            ) : null}
            <Link
              to="/annuaire/soumettre"
              title="Proposer votre fiche dans l'annuaire"
              className="inline-flex min-h-11 items-center rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:opacity-90"
            >
              Ajouter ma fiche
            </Link>
          </div>
        </div>

        <AdSlot placement="annuaire" className="mt-6" />

        {visible.length === 0 ? (
          <p className="mt-8 rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
            Aucune fiche pour ces critères. Élargissez la recherche, ou proposez la première fiche.
          </p>
        ) : (
          <ul className="mt-6 grid gap-4 md:grid-cols-2">
            {visible.map((item) => {
              const entry = averages.get(item.id);
              const avg = entry ? entry.total / entry.count : null;
              return (
                <li
                  key={item.id}
                  className={`rounded-xl border bg-card p-5 ${
                    item.featured ? "border-primary" : "border-border"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {item.logo_url ? (
                      <img
                        src={item.logo_url}
                        alt={`Logo de ${item.name}`}
                        loading="lazy"
                        className="size-12 shrink-0 rounded-md border border-border object-cover"
                      />
                    ) : null}
                    <div className="min-w-0">
                      <h2 className="truncate text-base font-semibold text-foreground">
                        <Link
                          to="/annuaire/$slug"
                          params={{ slug: item.slug }}
                          title={`Voir la fiche de ${item.name}`}
                          className="hover:underline"
                        >
                          {item.name}
                        </Link>
                      </h2>
                      <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        {item.city ? (
                          <span className="inline-flex items-center gap-1">
                            <MapPin className="size-3.5" aria-hidden="true" />
                            {item.city}
                          </span>
                        ) : null}
                        {avg ? (
                          <span className="inline-flex items-center gap-1 text-warning-text">
                            <Star className="size-3.5 fill-warning-text" aria-hidden="true" />
                            {avg.toFixed(1)} / 5
                          </span>
                        ) : null}
                        {item.verified ? (
                          <span className="inline-flex items-center gap-1 text-success-text">
                            <BadgeCheck className="size-3.5" aria-hidden="true" />
                            Vérifié
                          </span>
                        ) : null}
                        {item.plan === "premium" ? (
                          <span className="rounded bg-muted px-1.5 py-0.5 font-medium text-primary-text">
                            Premium
                          </span>
                        ) : null}
                      </p>
                    </div>
                  </div>
                  {item.excerpt ? (
                    <p className="mt-3 text-sm text-muted-foreground">{item.excerpt}</p>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}

        {pageCount > 1 ? (
          <nav aria-label="Pagination" className="mt-8 flex items-center justify-center gap-3">
            <Button
              variant="outline"
              disabled={current === 1}
              onClick={() => setPage(current - 1)}
              title="Page précédente"
            >
              Précédent
            </Button>
            <span className="text-sm text-muted-foreground">
              Page {current} sur {pageCount}
            </span>
            <Button
              variant="outline"
              disabled={current === pageCount}
              onClick={() => setPage(current + 1)}
              title="Page suivante"
            >
              Suivant
            </Button>
          </nav>
        ) : null}
      </div>
    </PageShell>
  );
}
