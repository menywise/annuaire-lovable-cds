import { createFileRoute, Link } from "@tanstack/react-router";
import { Sparkles } from "lucide-react";
import { PageShell } from "@/components/cds/SiteHeader";
import { erreurChargement } from "@/components/cds/ErreurChargement";
import { ReportButton } from "@/components/cds/ReportButton";
import { requireFeature } from "@/config/features";
import { listImprovements } from "@/lib/reports.functions";
import { reportContentTypeLabel, reportReasonLabel } from "@/lib/reports";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/ameliorations")({
  beforeLoad: () => requireFeature("reports"),
  loader: () => listImprovements(),
  head: () =>
    seo({
      title: "Le site s'améliore grâce à vous",
      description:
        "Les erreurs corrigées, les oublis comblés et les corrections appliquées grâce aux signalements des visiteurs et des membres.",
      path: "/ameliorations",
      type: "website",
    }),
  errorComponent: erreurChargement("Les améliorations n'ont pas pu être chargées."),
  component: ImprovementsPage,
});

function ImprovementsPage() {
  const items = Route.useLoaderData();
  return (
    <PageShell>
      <div className="mx-auto max-w-[760px]">
        <h1 className="text-3xl font-bold text-foreground">Le site s'améliore grâce à vous</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Chaque page peut être améliorée par ses lecteurs. Vous repérez une erreur, un oubli, une
          information à mettre à jour ? Le bouton « Signaler » l'envoie à l'équipe, avec ou sans
          compte. Voici les corrections apportées grâce à ces retours.
        </p>
        <div className="mt-4">
          <ReportButton contentType="page" label="Je signale une erreur sur le site" />
        </div>

        {items.length === 0 ? (
          <p className="mt-8 rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
            Les premières corrections apparaîtront ici dès qu'un signalement aura été traité.
          </p>
        ) : (
          <ol className="mt-8 space-y-3">
            {items.map((item) => (
              <li key={item.id} className="rounded-xl border border-border bg-card p-5">
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <Sparkles className="size-3.5 text-primary" aria-hidden="true" />
                  <span>{reportReasonLabel(item.reason)}</span>
                  <span aria-hidden="true">·</span>
                  <span>{reportContentTypeLabel(item.content_type)}</span>
                  <span aria-hidden="true">·</span>
                  <time dateTime={item.handled_at}>
                    {new Date(item.handled_at).toLocaleDateString("fr-FR")}
                  </time>
                </div>
                <p className="mt-2 whitespace-pre-line text-sm text-foreground">
                  {item.public_note}
                </p>
                {item.reported_url ? (
                  <a
                    href={item.reported_url}
                    className="mt-1 inline-flex min-h-11 items-center text-xs font-medium text-muted-foreground underline hover:text-foreground"
                  >
                    Voir la page
                  </a>
                ) : null}
              </li>
            ))}
          </ol>
        )}
        <p className="mt-8 text-sm text-muted-foreground">
          Vous avez reçu un code de suivi ?{" "}
          <Link to="/signalement" className="font-medium text-foreground underline">
            Suivre mon signalement
          </Link>
        </p>
      </div>
    </PageShell>
  );
}
