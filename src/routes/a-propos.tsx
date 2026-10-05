import { createFileRoute, Link } from "@tanstack/react-router";
import { PageShell } from "@/components/cds/SiteHeader";
import { Button } from "@/components/ui/button";
import { seo } from "@/lib/seo";
import { isFeatureOn } from "@/config/features";
import { editorName } from "@/components/cds/LegalPage";
import { useBrandSettings } from "@/hooks/useSiteSettings";
import { getSiteConfig } from "@/lib/site-config";

export const Route = createFileRoute("/a-propos")({
  head: () =>
    seo({
      title: "À propos",
      description: `Qui édite ${getSiteConfig().brand.name} et selon quels engagements : accessibilité, respect de vos données et informations claires.`,
      path: "/a-propos",
      type: "article",
    }),
  component: AProposPage,
});

/** Engagements tenus par le socle lui-même, valables quel que soit le site et ses modules. */
const engagements = [
  {
    title: "Un site accessible",
    body: "Contrastes conformes au niveau AA, navigation complète au clavier, textes lisibles : chaque visiteur est accueilli, handicap compris.",
  },
  {
    title: "Vos données respectées",
    body: "Aucun cookie de mesure d'audience ou de publicité n'est déposé sans votre accord. Vos droits sur vos données s'exercent simplement.",
  },
  {
    title: "Des informations claires",
    body: "Qui édite le site, comment vos données sont traitées et quelles règles s'appliquent : tout est écrit en français, accessible depuis chaque page.",
  },
];

function AProposPage() {
  const { settings } = useBrandSettings();
  const { legal } = settings;
  const editorLine = [
    editorName(settings),
    legal.form ? legal.form : "",
    legal.address ? `siège : ${legal.address}` : "",
  ]
    .filter(Boolean)
    .join(", ");
  return (
    <PageShell>
      <article className="mx-auto max-w-[760px]">
        <p className="text-xs font-medium uppercase tracking-wide text-primary-text">À propos</p>
        <h1 className="mt-2 text-3xl font-bold text-foreground">{settings.name}</h1>
        {settings.tagline ? (
          <p className="mt-3 text-base text-foreground">{settings.tagline}</p>
        ) : null}
        <p className="mt-3 text-sm text-muted-foreground">
          Cette page présente l'éditeur du site et les engagements qu'il prend envers ses visiteurs.
        </p>

        <h2 className="mt-10 text-lg font-semibold text-foreground">Qui édite ce site</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {settings.name} est édité par {editorLine}
          {legal.publisher ? `, sous la direction de ${legal.publisher}` : ""}. Les informations
          complètes figurent dans les{" "}
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

        <div className="mt-6 flex flex-wrap gap-3">
          {isFeatureOn("onboarding") ? (
            <Button asChild>
              <Link to="/demarrer" title="Découvrir le parcours en trois étapes">
                Voir comment démarrer
              </Link>
            </Button>
          ) : null}
          {isFeatureOn("contact") ? (
            <Button asChild variant="outline">
              <Link to="/contact" title="Poser une question via le formulaire de contact">
                Poser une question
              </Link>
            </Button>
          ) : null}
        </div>
      </article>
    </PageShell>
  );
}
