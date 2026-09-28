import { Link } from "@tanstack/react-router";
import { PageShell } from "./SiteHeader";
import { useBrandSettings } from "@/hooks/useSiteSettings";
import { isFeatureOn } from "@/config/features";
import type { BrandSettings } from "@/lib/site-config";

/** Nom de l'éditeur : raison sociale saisie en admin, sinon nom du site. */
export function editorName(brand: BrandSettings) {
  return brand.legal.company || brand.name;
}

/**
 * Moyen de contact cité dans les documents légaux : le formulaire si le module
 * Contact est actif, sinon un courrier au siège social saisi en admin.
 */
export function ContactChannel({ title = "Nous écrire via le formulaire de contact protégé" }: { title?: string }) {
  const { settings } = useBrandSettings();
  if (isFeatureOn("contact")) {
    return (
      <>
        le{" "}
        <Link to="/contact" title={title} className="font-medium text-primary-text hover:underline">
          formulaire de contact
        </Link>
      </>
    );
  }
  return (
    <>
      un courrier adressé au siège social
      {settings.legal.address ? ` (${settings.legal.address})` : ""}
    </>
  );
}

export function LegalPage({
  title,
  updatedAt,
  children,
}: {
  title: string;
  updatedAt: string;
  children: React.ReactNode;
}) {
  const { settings } = useBrandSettings();

  return (
    <PageShell>
      <article className="mx-auto max-w-[760px]">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Document légal
        </p>
        <h1 className="mt-2 text-3xl font-bold text-foreground">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">Dernière mise à jour : {updatedAt}</p>
        <div className="mt-8 space-y-6 text-sm leading-relaxed text-foreground [&_h2]:text-base [&_h2]:font-semibold [&_li]:ml-5 [&_li]:list-disc [&_p]:text-muted-foreground [&_ul]:space-y-1.5 [&_ul]:text-muted-foreground">
          {children}
        </div>
        <p className="mt-10 rounded-lg border border-border bg-muted p-4 text-xs text-muted-foreground">
          {[
            editorName(settings),
            settings.legal.form && settings.legal.capital
              ? `${settings.legal.form} au capital de ${settings.legal.capital}`
              : settings.legal.form,
            settings.legal.address,
          ]
            .filter(Boolean)
            .join(" — ")}
          .{settings.host.name ? ` Site hébergé par ${settings.host.name}.` : ""}
        </p>
      </article>
    </PageShell>
  );
}

export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2>{title}</h2>
      {children}
    </section>
  );
}
