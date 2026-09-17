import { Link } from "@tanstack/react-router";
import { Menu, X } from "lucide-react";
import { useState } from "react";
import { useBrandSettings } from "@/hooks/useSiteSettings";
import { CookieBanner } from "@/components/cds/CookieBanner";

const nav = [
  { to: "/", label: "Tokens", title: "Couleurs, typographie, rayons et ombres du design system" },
  { to: "/composants", label: "Composants", title: "Bibliothèque de composants d'interface CDS" },
  { to: "/guide", label: "Guide", title: "Comment réutiliser CDS sur un nouveau projet" },
  { to: "/login", label: "Connexion", title: "Se connecter à son espace personnel" },
  { to: "/legal/mentions-legales", label: "Légal", title: "Mentions légales de l'éditeur du site" },
  { to: "/contact", label: "Contact", title: "Écrire via le formulaire de contact protégé" },
] as const;

const legalNav = [
  { to: "/legal/mentions-legales", label: "Mentions légales", title: "Éditeur, hébergeur et propriété intellectuelle" },
  { to: "/legal/confidentialite", label: "Confidentialité", title: "Traitement des données personnelles et droits RGPD" },
  { to: "/legal/cgu", label: "CGU", title: "Conditions générales d'utilisation du site" },
  { to: "/legal/cookies", label: "Cookies", title: "Politique de gestion des cookies" },
  { to: "/contact", label: "Contact", title: "Formulaire de contact protégé anti-spam" },
] as const;

const linkClass =
  "rounded px-3 py-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const { settings } = useBrandSettings();

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-card/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-[1200px] items-center gap-6 px-6">
        <Link
          to="/"
          title={`${settings.name} — accueil`}
          className="flex items-center gap-2 font-semibold text-foreground"
        >
          <span className="grid size-6 place-items-center rounded bg-primary text-[11px] font-bold text-primary-foreground">
            {settings.shortName.slice(0, 1).toUpperCase()}
          </span>
          {settings.shortName}
        </Link>

        <nav aria-label="Navigation principale" className="hidden items-center gap-1 text-sm md:flex">
          {nav.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              title={item.title}
              className={linkClass}
              activeProps={{ className: "bg-accent text-foreground" }}
              activeOptions={{ exact: item.to === "/" }}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls="cds-mobile-nav"
          aria-label={open ? "Fermer le menu" : "Ouvrir le menu"}
          title={open ? "Fermer le menu de navigation" : "Ouvrir le menu de navigation"}
          className="ml-auto grid size-9 place-items-center rounded-md border border-border text-foreground md:hidden"
        >
          {open ? <X className="size-4" /> : <Menu className="size-4" />}
        </button>
      </div>

      {open && (
        <nav
          id="cds-mobile-nav"
          aria-label="Navigation mobile"
          className="border-t border-border bg-card px-6 py-3 md:hidden"
        >
          <ul className="flex flex-col gap-1 text-sm">
            {nav.map((item) => (
              <li key={item.to}>
                <Link
                  to={item.to}
                  title={item.title}
                  onClick={() => setOpen(false)}
                  className={`block ${linkClass}`}
                  activeProps={{ className: "bg-accent text-foreground" }}
                  activeOptions={{ exact: item.to === "/" }}
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </header>
  );
}

export function SiteFooter() {
  const { settings } = useBrandSettings();

  return (
    <footer className="border-t border-border bg-card">
      <div className="mx-auto flex max-w-[1200px] flex-wrap items-center justify-between gap-3 px-6 py-6 text-xs text-muted-foreground">
        <span>{settings.tagline}</span>
        <nav aria-label="Liens légaux" className="flex flex-wrap gap-4">
          {legalNav.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              title={item.title}
              className="rounded hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </footer>
  );
}

export function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <a
        href="#contenu"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-primary-foreground"
      >
        Aller au contenu principal
      </a>
      <SiteHeader />
      <main id="contenu" className="mx-auto w-full max-w-[1200px] flex-1 px-6 py-10">
        {children}
      </main>
      <SiteFooter />
      <CookieBanner />
    </div>
  );
}
