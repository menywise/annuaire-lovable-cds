import { createFileRoute, Link } from "@tanstack/react-router";
import { PageShell } from "@/components/cds/SiteHeader";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/guide")({
  head: () =>
    seo({
      title: "Guide de réutilisation",
      description:
        "Comment réutiliser le Consensus Design System sur un nouveau site : fichiers à copier, configuration de marque à modifier, pages fournies (connexion, mot de passe, mentions légales, contact).",
      path: "/guide",
      type: "article",
    }),
  component: GuidePage,
});

const steps = [
  {
    title: "1. Copier le socle",
    body: "Reprendre src/styles.css (tokens de couleur, typographie, rayons), src/lib/cds-tokens.ts, src/lib/seo.ts et le dossier src/components/cds.",
  },
  {
    title: "2. Régler la marque depuis l'administration",
    body: "Aucun fichier à modifier : l'espace Administration (réservé aux comptes administrateurs) permet de changer le nom du site, l'adresse publique, les coordonnées légales et l'hébergeur. Les modifications s'appliquent immédiatement sur l'en-tête, le pied de page et les pages légales.",
  },
  {
    title: "3. Reprendre les pages fournies",
    body: "Connexion, création de compte, mot de passe oublié, nouveau mot de passe, profil, contact protégé anti-spam, mentions légales, confidentialité, CGU, cookies, page introuvable et page de maintenance.",
  },
  {
    title: "4. Vérifier le référencement",
    body: "Chaque page appelle seo() : titre unique, description, adresse canonique et aperçu de partage. Ajouter la nouvelle page dans le plan du site (sitemap.xml) et lui donner un titre de lien explicite.",
  },
  {
    title: "5. Garder les règles CDS",
    body: "Thème clair uniquement, police Inter, fond #f8fafc, texte #1e293b, bleu #0d6efd, rayon 6 px pour les boutons et 12 px pour les cartes.",
  },
];

const shipped = [
  { to: "/", label: "Tokens et fondations", title: "Couleurs, typographie, rayons et ombres" },
  { to: "/admin", label: "Espace d'administration", title: "Régler le nom du site, les coordonnées légales et l'hébergeur" },
  { to: "/composants", label: "Bibliothèque de composants", title: "Boutons, champs, tableaux, fenêtres, pagination" },
  { to: "/login", label: "Écrans de connexion", title: "Connexion à un compte existant" },
  { to: "/contact", label: "Formulaire de contact", title: "Formulaire protégé anti-spam" },
  { to: "/legal/mentions-legales", label: "Pages légales", title: "Mentions légales, confidentialité, CGU, cookies" },
  { to: "/maintenance", label: "Page de maintenance", title: "Écran affiché pendant une interruption de service" },
] as const;

function GuidePage() {
  return (
    <PageShell>
      <article className="mx-auto max-w-[760px]">
        <p className="text-xs font-medium uppercase tracking-wide text-primary">Documentation</p>
        <h1 className="mt-2 text-3xl font-bold text-foreground">Réutiliser CDS sur un nouveau projet</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          CDS est un modèle complet : fondations visuelles, composants, pages de compte et pages
          légales prêtes à l'emploi. Voici la marche à suivre.
        </p>

        <div className="mt-8 space-y-4">
          {steps.map((step) => (
            <section key={step.title} className="rounded-xl border border-border bg-card p-5">
              <h2 className="text-base font-semibold text-foreground">{step.title}</h2>
              <p className="mt-1.5 text-sm text-muted-foreground">{step.body}</p>
            </section>
          ))}
        </div>

        <h2 className="mt-12 text-lg font-semibold text-foreground">Ce qui est déjà livré</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {shipped.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              title={item.title}
              className="rounded-xl border border-border bg-card p-4 text-sm font-medium text-foreground transition-shadow hover:shadow-[0_4px_12px_rgba(0,0,0,0.08)]"
            >
              {item.label}
              <span className="mt-1 block text-xs font-normal text-muted-foreground">{item.title}</span>
            </Link>
          ))}
        </div>
      </article>
    </PageShell>
  );
}
