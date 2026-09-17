import { PageShell } from "./SiteHeader";

export function LegalPage({
  title,
  updatedAt,
  children,
}: {
  title: string;
  updatedAt: string;
  children: React.ReactNode;
}) {
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
          PMM RDS — SAS au capital de 1 000 €, Rue du Champfour, 87000 Limoges. Site hébergé par
          OVH.
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
