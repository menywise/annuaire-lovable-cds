import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { BadgeCheck, MapPin } from "lucide-react";
import { PageShell } from "@/components/cds/SiteHeader";
import { requireFeature } from "@/config/features";
import { getCommune } from "@/lib/directory.functions";
import { breadcrumbJsonLd, seo } from "@/lib/seo";

const formatNumber = (n: number) => new Intl.NumberFormat("fr-FR").format(n);

export const Route = createFileRoute("/annuaire/commune/$code")({
  beforeLoad: () => requireFeature("geo"),
  loader: async ({ params }) => {
    const data = await getCommune({ data: { code: params.code } });
    if (!data) throw notFound();
    return data;
  },
  head: ({ loaderData }) => {
    if (!loaderData) {
      return { meta: [{ title: "Commune introuvable" }, { name: "robots", content: "noindex" }] };
    }
    const { commune, departement, listings } = loaderData;
    const cp = commune.postal_codes[0] ? ` (${commune.postal_codes[0]})` : "";
    const base = seo({
      title: `Professionnels à ${commune.name}${cp}`,
      description: `Trouvez les professionnels référencés à ${commune.name}${
        departement ? `, ${departement.nom}` : ""
      }. ${listings.length} fiche${listings.length > 1 ? "s" : ""}, communes voisines.`,
      path: `/annuaire/commune/${commune.code}`,
      // Commune sans fiche : page utile à la navigation, pas à l'index des moteurs.
      noindex: listings.length === 0,
    });
    return {
      ...base,
      scripts: [
        breadcrumbJsonLd([
          { name: "Annuaire", path: "/annuaire" },
          ...(departement
            ? [{ name: departement.nom, path: `/annuaire/departement/${departement.slug}` }]
            : []),
          { name: commune.name, path: `/annuaire/commune/${commune.code}` },
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
        Cette commune n'existe pas.{" "}
        <Link to="/annuaire/departements" title="Voir tous les départements" className="underline">
          Voir tous les départements
        </Link>
      </p>
    </PageShell>
  ),
  component: CommunePage,
});

function CommunePage() {
  const { commune, departement, epci, neighbours, listings } = Route.useLoaderData();

  return (
    <PageShell>
      <div className="mx-auto max-w-[1000px]">
        <nav aria-label="Fil d'Ariane" className="text-xs text-muted-foreground">
          <Link to="/annuaire" title="Revenir à l'annuaire" className="hover:underline">
            Annuaire
          </Link>
          {departement ? (
            <>
              {" / "}
              <Link
                to="/annuaire/departement/$slug"
                params={{ slug: departement.slug }}
                title={`Voir les professionnels en ${departement.nom}`}
                className="hover:underline"
              >
                {departement.nom}
              </Link>
            </>
          ) : null}
          {" / "}
          {commune.name}
        </nav>
        <h1 className="mt-2 text-3xl font-bold text-foreground">
          Les professionnels à {commune.name}
        </h1>
        <p className="mt-2 max-w-[70ch] text-sm text-muted-foreground">
          {commune.postal_codes.length ? `Code postal ${commune.postal_codes.join(", ")}. ` : ""}
          {commune.population ? `${formatNumber(commune.population)} habitants. ` : ""}
          {epci ? `${epci.name}. ` : ""}
          {departement ? `${departement.nom}, ${departement.region}.` : ""}
        </p>

        {listings.length === 0 ? (
          <div className="mt-8 rounded-lg border border-dashed border-border p-10 text-center">
            <p className="text-sm text-muted-foreground">
              Aucune fiche pour l'instant à {commune.name}. La première place est libre.
            </p>
            <Link
              to="/annuaire/soumettre"
              title={`Ajouter votre fiche à ${commune.name}`}
              className="mt-4 inline-flex min-h-11 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:opacity-90"
            >
              Ajouter votre fiche à {commune.name}
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
              Les communes voisines de {commune.name}
            </h2>
            <ul className="mt-3 flex flex-wrap gap-2">
              {neighbours.map((n) => (
                <li key={n.code}>
                  <Link
                    to="/annuaire/commune/$code"
                    params={{ code: n.code }}
                    title={`Voir les professionnels à ${n.name}`}
                    className="inline-flex min-h-11 items-center rounded-md border border-border px-3 text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
                  >
                    {n.name}
                    {n.distance_km !== null ? ` · ${Math.round(Number(n.distance_km))} km` : ""}
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
