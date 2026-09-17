import { createFileRoute, Link } from "@tanstack/react-router";
import { PageShell } from "@/components/cds/SiteHeader";
import { cds } from "@/lib/cds-tokens";

import { seo } from "@/lib/seo";

export const Route = createFileRoute("/")({
  head: () =>
    seo({
      title: "CDS — Consensus Design System",
      description:
        "Design system réutilisable : tokens, composants et gabarits prêts à l'emploi (connexion, mot de passe oublié, contact, pages légales) pour les sites et applications GNOSIA.",
      path: "/",
      type: "website",
    }),
  component: Index,
});

function Swatch({ name, value }: { name: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="h-12 w-full rounded" style={{ backgroundColor: value }} />
      <p className="mt-2 text-xs font-medium text-foreground">{name}</p>
      <p className="font-mono text-[11px] text-muted-foreground">{value}</p>
    </div>
  );
}

function Block({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-12">
      <h2 className="text-lg font-semibold text-foreground">{title}</h2>
      {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

const templates = [
  { to: "/login", label: "Connexion", desc: "E-mail + mot de passe, lien d'inscription" },
  { to: "/signup", label: "Créer un compte", desc: "Inscription avec acceptation des CGU" },
  { to: "/forgot-password", label: "Mot de passe oublié", desc: "Demande de lien de réinitialisation" },
  { to: "/reset-password", label: "Nouveau mot de passe", desc: "Définition du nouveau mot de passe" },
  { to: "/legal/mentions-legales", label: "Mentions légales", desc: "Éditeur, hébergeur, propriété" },
  { to: "/legal/confidentialite", label: "Confidentialité", desc: "RGPD, données, droits" },
  { to: "/legal/cgu", label: "CGU", desc: "Conditions générales d'utilisation" },
  { to: "/legal/cookies", label: "Cookies", desc: "Traceurs et consentement" },
  { to: "/contact", label: "Contact", desc: "Formulaire protégé anti-spam" },
  { to: "/guide", label: "Guide de réutilisation", desc: "Quoi copier, quoi modifier" },
  { to: "/composants", label: "Composants", desc: "Tableaux, onglets, fenêtres, états" },
  { to: "/maintenance", label: "Maintenance", desc: "Écran d'interruption de service" },
  { to: "/merci", label: "Confirmation", desc: "Page de remerciement après envoi" },
] as const;

function Index() {
  return (
    <PageShell>
      <p className="text-xs font-medium uppercase tracking-wide text-primary">Design System</p>
      <h1 className="mt-2 text-3xl font-bold text-foreground">Consensus Design System</h1>
      <p className="mt-2 max-w-[640px] text-sm text-muted-foreground">
        Base réutilisable pour tous les projets du workspace : tokens de couleur, typographie,
        rayons, ombres — et des gabarits prêts à copier pour la connexion, la récupération de mot
        de passe et les pages légales.
      </p>

      <Block title="Gabarits de pages" description="Cliquez pour voir chaque écran en taille réelle.">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {templates.map((t) => (
            <Link
              key={t.to}
              to={t.to}
              title={`${t.label} — ${t.desc}`}
              className="rounded-xl border border-border bg-card p-4 transition-shadow hover:shadow-[0_4px_12px_rgba(0,0,0,0.08)]"
            >
              <p className="text-sm font-semibold text-foreground">{t.label}</p>
              <p className="mt-1 text-xs text-muted-foreground">{t.desc}</p>
            </Link>
          ))}
        </div>
      </Block>

      <Block title="Couleurs">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
          {Object.entries(cds.colors).map(([name, value]) => (
            <Swatch key={name} name={name} value={value} />
          ))}
        </div>
      </Block>

      <Block title="Surfaces subtiles" description="Fonds et textes associés pour les statuts.">
        <div className="flex flex-wrap gap-2">
          {Object.entries(cds.subtle).map(([name, v]) => (
            <span
              key={name}
              className="rounded-full px-3 py-1 text-xs font-medium"
              style={{ backgroundColor: v.bg, color: v.text }}
            >
              {name}
            </span>
          ))}
        </div>
      </Block>

      <Block title="Typographie">
        <div className="space-y-2 rounded-xl border border-border bg-card p-6">
          <p className="text-[2rem] font-bold leading-tight text-foreground">Titre 2rem / 700</p>
          <p className="text-[1.5rem] font-semibold leading-tight text-foreground">Titre 1.5rem / 600</p>
          <p className="text-[1.15rem] font-semibold text-foreground">Sous-titre 1.15rem / 600</p>
          <p className="text-[0.88rem] text-foreground">Corps de texte 0.88rem — Inter</p>
          <p className="text-[0.78rem] text-muted-foreground">Texte secondaire 0.78rem</p>
        </div>
      </Block>

      <Block title="Rayons et ombres">
        <div className="grid gap-3 sm:grid-cols-4">
          {Object.entries(cds.shadow).map(([name, value]) => (
            <div key={name} className="rounded-xl bg-card p-5 text-xs" style={{ boxShadow: value }}>
              <p className="font-medium text-foreground">shadow {name}</p>
              <p className="mt-1 text-muted-foreground">
                radius {cds.radius[name as keyof typeof cds.radius] ?? "0.75rem"}
              </p>
            </div>
          ))}
        </div>
      </Block>
    </PageShell>
  );
}
