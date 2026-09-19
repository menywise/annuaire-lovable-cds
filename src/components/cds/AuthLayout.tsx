import { Link } from "@tanstack/react-router";

export function AuthLayout({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-12">
      <Link
        to="/"
        title="Revenir à la page d'accueil"
        className="mb-6 flex items-center gap-2 text-sm font-semibold text-foreground"
      >
        <span className="grid size-7 place-items-center rounded bg-primary text-xs font-bold text-primary-foreground">
          C
        </span>
        CDS
      </Link>

      <div className="w-full max-w-[400px] rounded-xl border border-border bg-card p-8 shadow-[0_4px_12px_rgba(0,0,0,0.08),0_2px_4px_rgba(0,0,0,0.04)]">
        <h1 className="text-xl font-semibold text-foreground">{title}</h1>
        {subtitle && <p className="mt-1.5 text-sm text-muted-foreground">{subtitle}</p>}
        <div className="mt-6">{children}</div>
      </div>

      {footer && <div className="mt-5 text-sm text-muted-foreground">{footer}</div>}

      <div className="mt-8 flex gap-4 text-xs text-muted-foreground">
        <Link
          to="/legal/mentions-legales"
          title="Lire les mentions légales"
          className="hover:text-foreground"
        >
          Mentions légales
        </Link>
        <Link
          to="/legal/confidentialite"
          title="Lire la politique de confidentialité"
          className="hover:text-foreground"
        >
          Confidentialité
        </Link>
      </div>
    </div>
  );
}
