import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { MapPin } from "lucide-react";
import { PageShell } from "@/components/cds/SiteHeader";
import { requireFeature } from "@/config/features";
import { listDirectoryListings } from "@/lib/directory.functions";
import { breadcrumbJsonLd, seo } from "@/lib/seo";

export const Route = createFileRoute("/annuaire/categorie/$slug")({
  beforeLoad: () => requireFeature("directory"),
  loader: async ({ params }) => {
    const data = await listDirectoryListings();
    const category = data.categories.find((item) => item.slug === params.slug);
    if (!category) throw notFound();
    return {
      category,
      listings: data.listings.filter((item) => item.category_id === category.id),
    };
  },
  head: ({ loaderData }) => {
    if (!loaderData) {
      return { meta: [{ title: "Activité introuvable" }, { name: "robots", content: "noindex" }] };
    }
    const { category, listings } = loaderData;
    const base = seo({
      title: `${category.name} — annuaire`,
      description:
        category.description ||
        `Trouvez les professionnels de la catégorie ${category.name}. ${listings.length} fiche${listings.length > 1 ? "s" : ""} disponible${listings.length > 1 ? "s" : ""}.`,
      path: `/annuaire/categorie/${category.slug}`,
    });
    return {
      ...base,
      scripts: [
        breadcrumbJsonLd([
          { name: "Annuaire", path: "/annuaire" },
          { name: category.name, path: `/annuaire/categorie/${category.slug}` },
        ]),
      ],
    };
  },
  errorComponent: () => (
    <PageShell>
      <p className="text-sm text-muted-foreground">Cette page n'a pas pu être chargée.</p>
    </PageShell>
  ),
  notFoundComponent: () => (
    <PageShell>
      <p className="text-sm text-muted-foreground">
        Cette activité n'existe pas.{" "}
        <Link to="/annuaire" title="Revenir à l'annuaire" className="underline">
          Revenir à l'annuaire
        </Link>
      </p>
    </PageShell>
  ),
  component: CategoryPage,
});

function CategoryPage() {
  const { category, listings } = Route.useLoaderData();

  return (
    <PageShell>
      <div className="mx-auto max-w-[1000px]">
        <nav aria-label="Fil d'Ariane" className="text-xs text-muted-foreground">
          <Link to="/annuaire" title="Revenir à l'annuaire" className="hover:underline">
            Annuaire
          </Link>{" "}
          / {category.name}
        </nav>
        <h1 className="mt-2 text-3xl font-bold text-foreground">{category.name}</h1>
        <p className="mt-2 max-w-[70ch] text-sm text-muted-foreground">
          {category.description ||
            `${listings.length} professionnel${listings.length > 1 ? "s" : ""} référencé${listings.length > 1 ? "s" : ""} dans cette activité.`}
        </p>

        {listings.length === 0 ? (
          <p className="mt-8 rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
            Aucune fiche dans cette activité pour le moment.
          </p>
        ) : (
          <ul className="mt-6 grid gap-4 md:grid-cols-2">
            {listings.map((item) => (
              <li key={item.id} className="rounded-xl border border-border bg-card p-5">
                <h2 className="text-base font-semibold text-foreground">
                  <Link
                    to="/annuaire/$slug"
                    params={{ slug: item.slug }}
                    title={`Voir la fiche de ${item.name}`}
                    className="hover:underline"
                  >
                    {item.name}
                  </Link>
                </h2>
                {item.city ? (
                  <p className="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground">
                    <MapPin className="size-3.5" aria-hidden="true" />
                    {item.city}
                  </p>
                ) : null}
                {item.excerpt ? (
                  <p className="mt-3 text-sm text-muted-foreground">{item.excerpt}</p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    </PageShell>
  );
}
