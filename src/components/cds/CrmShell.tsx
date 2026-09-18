import { Link } from "@tanstack/react-router";
import { PageShell } from "@/components/cds/SiteHeader";

/** Étapes de la relation, du premier contact à l'ambassadeur. */
export const CRM_STAGES = [
  { value: "inconnu", label: "Inconnu" },
  { value: "curieux", label: "Curieux" },
  { value: "abonne", label: "Abonné" },
  { value: "ami", label: "Ami" },
  { value: "client", label: "Client" },
  { value: "ambassadeur", label: "Ambassadeur" },
] as const;

export const CRM_STAGE_LABEL: Record<string, string> = Object.fromEntries(
  CRM_STAGES.map((stage) => [stage.value, stage.label]),
);

export const CRM_INTERACTION_TYPES = [
  { value: "note", label: "Note" },
  { value: "appel", label: "Appel" },
  { value: "email", label: "E-mail" },
  { value: "message", label: "Message" },
  { value: "rencontre", label: "Rencontre" },
  { value: "autre", label: "Autre" },
] as const;

const crmNav = [
  { to: "/crm", label: "Vue d'ensemble", title: "Compteurs, étapes et actions en retard" },
  { to: "/crm/prospects", label: "Contacts", title: "Tous vos contacts et leur étape" },
  { to: "/crm/actions", label: "Actions", title: "Ce que vous avez prévu de faire" },
] as const;

/** Cadre commun des pages de suivi de relation. */
export function CrmShell({
  title,
  intro,
  children,
}: {
  title: string;
  intro: string;
  children: React.ReactNode;
}) {
  return (
    <PageShell>
      <div className="mx-auto max-w-[1000px]">
        <p className="text-xs font-medium uppercase tracking-wide text-primary-text">
          Suivi de relation
        </p>
        <h1 className="mt-2 text-3xl font-bold text-foreground">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{intro}</p>

        <nav aria-label="Sections du suivi de relation" className="mt-6 flex flex-wrap gap-2">
          {crmNav.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              title={item.title}
              className="inline-flex min-h-11 items-center rounded-md border border-border px-3 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              activeProps={{ className: "border-primary bg-accent text-foreground" }}
              activeOptions={{ exact: true }}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="mt-8">{children}</div>
      </div>
    </PageShell>
  );
}
