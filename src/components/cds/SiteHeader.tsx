import { Link } from "@tanstack/react-router";

const nav = [
  { to: "/", label: "Tokens" },
  { to: "/composants", label: "Composants" },
  { to: "/login", label: "Connexion" },
  { to: "/legal/mentions-legales", label: "Légal" },
  { to: "/contact", label: "Contact" },
] as const;

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 h-14 border-b border-border bg-card/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-[1200px] items-center gap-6 px-6">
        <Link to="/" className="flex items-center gap-2 font-semibold text-foreground">
          <span className="grid size-6 place-items-center rounded bg-primary text-[11px] font-bold text-primary-foreground">
            C
          </span>
          CDS
        </Link>
        <nav className="flex items-center gap-1 text-sm">
          {nav.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="rounded px-3 py-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              activeProps={{ className: "bg-accent text-foreground" }}
              activeOptions={{ exact: item.to === "/" }}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-card">
      <div className="mx-auto flex max-w-[1200px] flex-wrap items-center justify-between gap-3 px-6 py-6 text-xs text-muted-foreground">
        <span>Consensus Design System — GNOSIA</span>
        <nav className="flex flex-wrap gap-4">
          <Link to="/legal/mentions-legales" className="hover:text-foreground">Mentions légales</Link>
          <Link to="/legal/confidentialite" className="hover:text-foreground">Confidentialité</Link>
          <Link to="/legal/cgu" className="hover:text-foreground">CGU</Link>
          <Link to="/legal/cookies" className="hover:text-foreground">Cookies</Link>
          <Link to="/contact" className="hover:text-foreground">Contact</Link>
        </nav>
      </div>
    </footer>
  );
}

export function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />
      <main className="mx-auto w-full max-w-[1200px] flex-1 px-6 py-10">{children}</main>
      <SiteFooter />
    </div>
  );
}
