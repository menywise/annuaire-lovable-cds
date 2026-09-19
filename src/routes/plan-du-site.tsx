import { createFileRoute, Link } from "@tanstack/react-router";
import { PageShell } from "@/components/cds/SiteHeader";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/plan-du-site")({
  head: () =>
    seo({
      title: "Plan du site",
      description:
        "Toutes les pages du Consensus Design System réunies : découverte, offres, contenus, compte, documents légaux et administration.",
      path: "/plan-du-site",
      type: "website",
    }),
  component: PlanDuSitePage,
});

const groupes = [
  {
    title: "Découvrir",
    links: [
      { to: "/", label: "Accueil", title: "Fondations, couleurs et gabarits du design system" },
      { to: "/a-propos", label: "À propos", title: "Qui édite le site et selon quels engagements" },
      {
        to: "/demarrer",
        label: "Démarrer",
        title: "Parcours en trois étapes jusqu'à la création de compte",
      },
      { to: "/tarifs", label: "Tarifs", title: "Comparer les offres et leurs contenus" },
      { to: "/composants", label: "Composants", title: "Bibliothèque de composants d'interface" },
      {
        to: "/guide",
        label: "Guide de réutilisation",
        title: "Réutiliser CDS sur un nouveau projet",
      },
    ],
  },
  {
    title: "Échanger",
    links: [
      { to: "/blog", label: "Blog", title: "Articles et méthodes" },
      { to: "/faq", label: "Questions fréquentes", title: "Réponses aux questions courantes" },
      { to: "/forum", label: "Forum", title: "Poser une question à la communauté" },
      {
        to: "/membres",
        label: "Annuaire des membres",
        title: "Découvrir les membres de la communauté",
      },
      { to: "/temoignages", label: "Témoignages", title: "Lire ce que la communauté a obtenu" },
      { to: "/avis", label: "Avis", title: "Retours d'expérience des utilisateurs" },
      { to: "/contact", label: "Contact", title: "Formulaire de contact protégé" },
    ],
  },
  {
    title: "Mon compte",
    links: [
      { to: "/login", label: "Connexion", title: "Accéder à son espace personnel" },
      { to: "/signup", label: "Créer un compte", title: "Ouvrir un compte en une minute" },
      {
        to: "/verification-email",
        label: "Vérification de l'adresse e-mail",
        title: "Renvoyer le lien de confirmation",
      },
      {
        to: "/forgot-password",
        label: "Mot de passe oublié",
        title: "Recevoir un lien de réinitialisation",
      },
      { to: "/tableau-de-bord", label: "Tableau de bord", title: "Chiffres clés et raccourcis" },
      {
        to: "/decouvrir",
        label: "Découvrir",
        title: "Faire le tour des fonctionnalités actives de votre espace",
      },
      { to: "/messagerie", label: "Messagerie", title: "Vos échanges privés entre membres" },
      { to: "/profil", label: "Mon profil", title: "Nom affiché, profil public et mot de passe" },
      { to: "/compte", label: "Mon compte", title: "Rôle, session et messages reçus" },
    ],
  },
  {
    title: "Documents légaux",
    links: [
      {
        to: "/legal/mentions-legales",
        label: "Mentions légales",
        title: "Éditeur, hébergeur et propriété intellectuelle",
      },
      {
        to: "/legal/confidentialite",
        label: "Politique de confidentialité",
        title: "Données personnelles et droits RGPD",
      },
      {
        to: "/legal/cgu",
        label: "Conditions générales d'utilisation",
        title: "Règles d'usage du service",
      },
      {
        to: "/legal/cgv",
        label: "Conditions générales de vente",
        title: "Offres payantes, paiement et rétractation",
      },
      { to: "/legal/cookies", label: "Politique de cookies", title: "Traceurs et consentement" },
    ],
  },
] as const;

function PlanDuSitePage() {
  return (
    <PageShell>
      <div className="mx-auto max-w-[900px]">
        <p className="text-xs font-medium uppercase tracking-wide text-primary-text">Navigation</p>
        <h1 className="mt-2 text-3xl font-bold text-foreground">Plan du site</h1>
        <p className="mt-2 max-w-[620px] text-sm text-muted-foreground">
          Toutes les pages, réunies au même endroit. Vous trouvez en un coup d'œil ce que vous
          cherchez, sans passer par le menu.
        </p>

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {groupes.map((groupe) => (
            <section key={groupe.title} className="rounded-xl border border-border bg-card p-5">
              <h2 className="text-base font-semibold text-foreground">{groupe.title}</h2>
              <ul className="mt-3 space-y-1.5 text-sm">
                {groupe.links.map((link) => (
                  <li key={link.to}>
                    <Link
                      to={link.to}
                      title={link.title}
                      className="text-primary-text hover:underline"
                    >
                      {link.label}
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
