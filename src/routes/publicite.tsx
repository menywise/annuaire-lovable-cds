import { createFileRoute, Link } from "@tanstack/react-router";
import { PageShell } from "@/components/cds/SiteHeader";
import { requireFeature } from "@/config/features";
import { seo } from "@/lib/seo";

const FORMATS = [
  {
    title: "Bandeau en tête de page",
    body: "Vu dès l'arrivée, sur toutes les pages : l'emplacement le plus mémorisé.",
  },
  {
    title: "Encart dans la colonne",
    body: "À côté des articles, au moment où la personne lit vraiment.",
  },
  {
    title: "Insertion dans le contenu",
    body: "Intégrée au fil de l'article : discrète, et la plus cliquée.",
  },
  {
    title: "Partenariat ou affiliation",
    body: "Vous ne payez qu'au résultat, avec un code de suivi dédié.",
  },
] as const;

export const Route = createFileRoute("/publicite")({
  beforeLoad: () => requireFeature("adNetwork"),
  head: () =>
    seo({
      title: "Annoncer sur le site",
      description:
        "Touchez une audience qualifiée et engagée : formats disponibles, suivi des impressions et des clics, facturation simple.",
      path: "/publicite",
    }),
  errorComponent: () => (
    <PageShell>
      <p className="text-sm text-muted-foreground">Cette page n'a pas pu être chargée.</p>
    </PageShell>
  ),
  notFoundComponent: () => (
    <PageShell>
      <p className="text-sm text-muted-foreground">Cette page n'existe pas.</p>
    </PageShell>
  ),
  component: AdvertisePage,
});

function AdvertisePage() {
  return (
    <PageShell>
      <div className="mx-auto max-w-[820px]">
        <p className="text-xs font-medium uppercase tracking-wide text-primary-text">Annonceurs</p>
        <h1 className="mt-2 text-3xl font-bold text-foreground">
          Parlez à des gens qui cherchent déjà ce que vous faites
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Nos visiteurs viennent chercher des réponses concrètes. Une annonce bien placée n'est pas
          une interruption : c'est la suite logique de leur lecture. Vous savez exactement combien
          de personnes l'ont vue et combien ont cliqué.
        </p>

        <ul className="mt-8 grid gap-4 sm:grid-cols-2">
          {FORMATS.map((format) => (
            <li key={format.title} className="rounded-xl border border-border bg-card p-5">
              <h2 className="text-sm font-semibold text-foreground">{format.title}</h2>
              <p className="mt-2 text-sm text-muted-foreground">{format.body}</p>
            </li>
          ))}
        </ul>

        <div className="mt-10 rounded-xl border border-border bg-card p-6">
          <h2 className="text-base font-semibold text-foreground">Comment on démarre</h2>
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
            <li>Vous nous écrivez en décrivant votre activité et votre objectif.</li>
            <li>Nous vous proposons l'emplacement et la durée qui correspondent.</li>
            <li>Vous envoyez votre visuel et votre lien, nous mettons en ligne.</li>
            <li>Vous recevez le relevé des impressions et des clics, et la facture.</li>
          </ol>
          <Link
            to="/contact"
            title="Nous écrire pour réserver un emplacement"
            className="mt-5 inline-flex min-h-11 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            Réserver un emplacement
          </Link>
        </div>
      </div>
    </PageShell>
  );
}
