import { createFileRoute, Link } from "@tanstack/react-router";
import { PageShell } from "@/components/cds/SiteHeader";
import { Button } from "@/components/ui/button";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/a-propos")({
  head: () =>
    seo({
      title: "À propos",
      description:
        "Qui édite le Consensus Design System, pour qui il est conçu — indépendants, artisans et solopreneurs — et selon quels engagements : clarté, accessibilité et propriété de vos données.",
      path: "/a-propos",
      type: "article",
    }),
  component: AProposPage,
});

const engagements = [
  {
    title: "Vous restez propriétaire",
    body: "Vos contenus, vos membres et vos réglages vous appartiennent. Rien n'est revendu, rien n'est cédé à un tiers publicitaire.",
  },
  {
    title: "Vous comprenez ce que vous utilisez",
    body: "Chaque écran est documenté en français, sans jargon. Vous savez où régler quoi, sans dépendre de quelqu'un d'autre.",
  },
  {
    title: "Vous êtes accessible à tous vos visiteurs",
    body: "Contrastes conformes au niveau AA, navigation au clavier, textes lisibles : votre site accueille tout le monde, y compris les personnes en situation de handicap.",
  },
];

function AProposPage() {
  return (
    <PageShell>
      <article className="mx-auto max-w-[760px]">
        <p className="text-xs font-medium uppercase tracking-wide text-primary-text">À propos</p>
        <h1 className="mt-2 text-3xl font-bold text-foreground">
          Un socle solide pour celles et ceux qui travaillent seuls
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Le Consensus Design System est né d'un constat simple : un indépendant, un artisan ou un
          solopreneur n'a ni le temps ni le budget de reconstruire à chaque projet un site sérieux,
          conforme et trouvable. CDS assemble une fois pour toutes ce socle, pour que vous
          consacriez votre énergie à votre métier.
        </p>

        <h2 className="mt-10 text-lg font-semibold text-foreground">Qui édite ce site</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          CDS est édité par PMM RDS, société par actions simplifiée établie à Limoges, sous la
          direction de Manuel ROHAUT. Les informations complètes figurent dans les{" "}
          <Link
            to="/legal/mentions-legales"
            title="Consulter les mentions légales du site"
            className="font-medium text-primary-text hover:underline"
          >
            mentions légales
          </Link>
          .
        </p>

        <h2 className="mt-10 text-lg font-semibold text-foreground">Nos engagements</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {engagements.map((item) => (
            <section key={item.title} className="rounded-xl border border-border bg-card p-5">
              <h3 className="text-sm font-semibold text-foreground">{item.title}</h3>
              <p className="mt-1.5 text-sm text-muted-foreground">{item.body}</p>
            </section>
          ))}
        </div>

        <h2 className="mt-10 text-lg font-semibold text-foreground">Et concrètement ?</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Vous obtenez un site complet : comptes, pages légales, blog, forum, avis, FAQ, offres et
          espace d'administration. Vous réglez tout depuis votre back-office, sans toucher à une
          seule ligne de code.
        </p>

        <div className="mt-6 flex flex-wrap gap-3">
          <Button asChild>
            <Link to="/demarrer" title="Découvrir le parcours en trois étapes">Voir comment démarrer</Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/contact" title="Poser une question via le formulaire de contact">
              Poser une question
            </Link>
          </Button>
        </div>
      </article>
    </PageShell>
  );
}
