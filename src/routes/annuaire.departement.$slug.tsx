import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { BadgeCheck, MapPin } from "lucide-react";
import { PageShell } from "@/components/cds/SiteHeader";
import { AdSlot } from "@/components/cds/AdSlot";
import { requireFeature } from "@/config/features";
import { getDepartement } from "@/lib/directory.functions";
import { breadcrumbJsonLd, seo } from "@/lib/seo";

export const Route = createFileRoute("/annuaire/departement/$slug")({
  beforeLoad: () => requireFeature("geo"),
  loader: async ({ params }) => {
    const data = await getDepartement({ data: { slug: params.slug } });
    if (!data) throw notFound();
    return data;
  },
  head: ({ loaderData }) => {
    if (!loaderData) {
      return {
        meta: [{ title: "Département introuvable" }, { name: "robots", content: "noindex" }],
      };
    }
    const { departement, listings } = loaderData;
    const base = seo({
      title: `Professionnels en ${departement.nom} (${departement.code})`,
      description: `Trouvez les professionnels référencés en ${departement.nom}. ${listings.length} fiche${listings.length > 1 ? "s" : ""} disponible${listings.length > 1 ? "s" : ""}.`,
      path: `/annuaire/departement/${departement.slug}`,
    });
    return {
      ...base,
      scripts: [
        breadcrumbJsonLd([
          { name: "Annuaire", path: "/annuaire" },
          { name: "Départements", path: "/annuaire/departements" },
          { name: departement.nom, path: `/annuaire/departement/${departement.slug}` },
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
        Ce département n'existe pas.{" "}
        <Link to="/annuaire/departements" title="Voir tous les départements" className="underline">
          Voir tous les départements
        </Link>
      </p>
    </PageShell>
  ),
  component: DepartementPage,
});

function DepartementPage() {
  const { departement, listings, neighbours } = Route.useLoaderData();

  return (
    <PageShell>
      <div className="mx-auto max-w-[1000px]">
        <nav aria-label="Fil d'Ariane" className="text-xs text-muted-foreground">
          <Link to="/annuaire" title="Revenir à l'annuaire" className="hover:underline">
            Annuaire
          </Link>{" "}
          /{" "}
          <Link
            to="/annuaire/departements"
            title="Voir tous les départements"
            className="hover:underline"
          >
            Départements
          </Link>{" "}
          / {departement.nom}
        </nav>
        <h1 className="mt-2 text-3xl font-bold text-foreground">
          Les professionnels en {departement.nom} ({departement.code})
        </h1>
        <p className="mt-2 max-w-[70ch] text-sm text-muted-foreground">
          {listings.length} fiche{listings.length > 1 ? "s" : ""} en {departement.nom}, région{" "}
          {departement.region}. Chacune indique la ville, l'activité et le moyen de contact.
        </p>

        <AdSlot placement="annuaire" className="mt-6" />

        {listings.length === 0 ? (
          <div className="mt-8 rounded-lg border border-dashed border-border p-10 text-center">
            <p className="text-sm text-muted-foreground">
              Aucune fiche pour l'instant en {departement.nom}. La première place est libre.
            </p>
            <Link
              to="/annuaire/soumettre"
              title={`Ajouter votre fiche en ${departement.nom}`}
              className="mt-4 inline-flex min-h-11 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:opacity-90"
            >
              Ajouter votre fiche en {departement.nom}
            </Link>
          </div>
        ) : (
          <ul className="mt-6 grid gap-4 md:grid-cols-2">
            {listings.map((item) => (
              <li
                key={item.id}
                className={`rounded-xl border bg-card p-5 ${
                  item.featured ? "border-primary" : "border-border"
                }`}
              >
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
                <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  {item.city ? (
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="size-3.5" aria-hidden="true" />
                      {item.city}
                    </span>
                  ) : null}
                  {item.verified ? (
                    <span className="inline-flex items-center gap-1 text-success-text">
                      <BadgeCheck className="size-3.5" aria-hidden="true" />
                      Vérifié
                    </span>
                  ) : null}
                </p>
                {item.excerpt ? (
                  <p className="mt-3 text-sm text-muted-foreground">{item.excerpt}</p>
                ) : null}
              </li>
            ))}
          </ul>
        )}

        {neighbours.length > 0 ? (
          <section className="mt-12">
            <h2 className="text-base font-semibold text-foreground">
              Les départements voisins en {departement.region}
            </h2>
            <ul className="mt-3 flex flex-wrap gap-2">
              {neighbours.map((dep) => (
                <li key={dep.code}>
                  <Link
                    to="/annuaire/departement/$slug"
                    params={{ slug: dep.slug }}
                    title={`Voir les professionnels en ${dep.nom}`}
                    className="inline-flex min-h-11 items-center rounded-md border border-border px-3 text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
                  >
                    {dep.code} — {dep.nom}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </PageShell>
  );
}
