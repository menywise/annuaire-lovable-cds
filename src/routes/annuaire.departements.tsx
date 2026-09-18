import { createFileRoute, Link } from "@tanstack/react-router";
import { PageShell } from "@/components/cds/SiteHeader";
import { requireFeature } from "@/config/features";
import { listDepartements } from "@/lib/directory.functions";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/annuaire/departements")({
  beforeLoad: () => requireFeature("geo"),
  loader: () => listDepartements(),
  head: () =>
    seo({
      title: "L'annuaire département par département",
      description:
        "Les 101 départements français, avec le nombre de professionnels référencés dans chacun. Choisissez votre département et voyez qui est près de chez vous.",
      path: "/annuaire/departements",
    }),
  errorComponent: () => (
    <PageShell>
      <p className="text-sm text-muted-foreground">La liste n'a pas pu être chargée.</p>
    </PageShell>
  ),
  notFoundComponent: () => (
    <PageShell>
      <p className="text-sm text-muted-foreground">Cette page n'existe pas.</p>
    </PageShell>
  ),
  component: DepartementsPage,
});

function DepartementsPage() {
  const departements = Route.useLoaderData();
  const regions = new Map<string, typeof departements>();
  for (const dep of departements) {
    const list = regions.get(dep.region) ?? [];
    list.push(dep);
    regions.set(dep.region, list);
  }

  return (
    <PageShell>
      <div className="mx-auto max-w-[1000px]">
        <nav aria-label="Fil d'Ariane" className="text-xs text-muted-foreground">
          <Link to="/annuaire" title="Revenir à l'annuaire" className="hover:underline">
            Annuaire
          </Link>{" "}
          / Départements
        </nav>
        <h1 className="mt-2 text-3xl font-bold text-foreground">Choisissez votre département</h1>
        <p className="mt-2 max-w-[70ch] text-sm text-muted-foreground">
          Chaque département a sa page : les professionnels référencés, leur ville et le moyen de
          les joindre. Commencez par le vôtre.
        </p>

        <div className="mt-8 space-y-8">
          {[...regions.entries()].map(([region, list]) => (
            <section key={region}>
              <h2 className="text-base font-semibold text-foreground">{region}</h2>
              <ul className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {list.map((dep) => (
                  <li key={dep.code}>
                    <Link
                      to="/annuaire/departement/$slug"
                      params={{ slug: dep.slug }}
                      title={`Voir les professionnels en ${dep.nom} (${dep.code})`}
                      className="flex min-h-11 items-center justify-between gap-3 rounded-md border border-border px-3 text-sm text-foreground transition-colors hover:bg-accent"
                    >
                      <span>
                        <span className="text-muted-foreground">{dep.code}</span> {dep.nom}
                      </span>
                      <span className="text-xs text-muted-foreground">{dep.listings}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </div>
    </PageShell>
  );
}
