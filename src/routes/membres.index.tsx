import { createFileRoute, Link } from "@tanstack/react-router";
import { PageShell } from "@/components/cds/SiteHeader";
import { listMembers } from "@/lib/community.functions";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/membres/")({
  loader: () => listMembers(),
  head: () =>
    seo({
      title: "Annuaire des membres",
      description:
        "Découvrez les indépendants, artisans et solopreneurs qui font vivre la communauté : leur métier, leurs contributions, et comment les contacter.",
      path: "/membres",
      type: "website",
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
  component: MembersPage,
});

function MembersPage() {
  const members = Route.useLoaderData();

  return (
    <PageShell>
      <div className="mx-auto max-w-[1000px]">
        <p className="text-xs font-medium uppercase tracking-wide text-primary-text">Annuaire</p>
        <h1 className="mt-2 text-3xl font-bold text-foreground">Les visages de la communauté</h1>
        <p className="mt-2 max-w-[70ch] text-sm text-muted-foreground">
          Derrière chaque réponse du forum, il y a quelqu'un qui construit son activité. Parcourez
          les profils, repérez celles et ceux qui avancent sur les mêmes sujets que vous, et engagez
          la conversation.
        </p>

        {members.length === 0 ? (
          <p className="mt-8 rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
            Aucun membre ne figure encore dans l'annuaire. Activez votre visibilité depuis votre
            profil.
          </p>
        ) : (
          <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {members.map((member) => (
              <li key={member.user_id} className="rounded-xl border border-border bg-card p-5">
                <div className="flex items-center gap-3">
                  <span className="grid size-10 shrink-0 place-items-center rounded-full bg-muted text-sm font-semibold text-foreground">
                    {member.display_name.slice(0, 1).toUpperCase()}
                  </span>
                  <div className="min-w-0">
                    <h2 className="truncate text-sm font-semibold text-foreground">
                      <Link
                        to="/membres/$memberId"
                        params={{ memberId: member.user_id }}
                        title={`Voir le profil de ${member.display_name}`}
                        className="hover:text-primary-text"
                      >
                        {member.display_name}
                      </Link>
                    </h2>
                    {member.job_title ? (
                      <p className="truncate text-xs text-muted-foreground">{member.job_title}</p>
                    ) : null}
                  </div>
                </div>
                {member.bio ? (
                  <p className="mt-3 line-clamp-3 text-sm text-muted-foreground">{member.bio}</p>
                ) : null}
                <p className="mt-3 text-xs text-muted-foreground">
                  {member.score} points de contribution
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </PageShell>
  );
}
