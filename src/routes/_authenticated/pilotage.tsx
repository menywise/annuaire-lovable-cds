import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PageShell } from "@/components/cds/SiteHeader";
import {
  CheckStatusBadge,
  ConformitySummary,
  groupByArea,
  type TemplateCheck,
} from "@/components/cds/ConformityBoard";
import { supabase } from "@/integrations/supabase/client";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/_authenticated/pilotage")({
  head: () =>
    seo({
      title: "Feuille de route et plan directeur",
      description: "Où en est le projet, ce qui arrive ensuite, et ce que les audits ont relevé.",
      path: "/pilotage",
      noindex: true,
    }),
  component: PilotagePage,
});

const statusLabel: Record<string, string> = {
  a_faire: "À faire",
  en_cours: "En cours",
  fait: "Fait",
};

type Item = { id: string; title: string; description: string; lot: string; status: string };
type Section = { id: string; title: string; content: string };
type Audit = { id: string; label: string; score: number; max_score: number; summary: string; performed_at: string };

function PilotagePage() {
  const [items, setItems] = useState<Item[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [audits, setAudits] = useState<Audit[]>([]);
  const [checks, setChecks] = useState<TemplateCheck[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      const [roadmap, masterplan, auditList, checkList] = await Promise.all([
        supabase
          .from("roadmap_items")
          .select("id, title, description, lot, status")
          .eq("public_visible", true)
          .order("position", { ascending: true }),
        supabase.from("masterplan_sections").select("id, title, content").order("position", { ascending: true }),
        supabase
          .from("audits")
          .select("id, label, score, max_score, summary, performed_at")
          .order("performed_at", { ascending: false })
          .limit(5),
        supabase
          .from("template_checks")
          .select("id, code, area, label, requirement, status, severity, evidence, position")
          .order("position", { ascending: true }),
      ]);
      if (!active) return;
      setItems(roadmap.data ?? []);
      setSections(masterplan.data ?? []);
      setAudits(auditList.data ?? []);
      setChecks(checkList.data ?? []);
      setReady(true);
    })();
    return () => {
      active = false;
    };
  }, []);

  const groups = ["en_cours", "a_faire", "fait"] as const;

  return (
    <PageShell>
      <div className="mx-auto max-w-[900px]">
        <nav aria-label="Fil d'Ariane" className="text-xs text-muted-foreground">
          <Link to="/tableau-de-bord" title="Revenir au tableau de bord" className="hover:text-foreground">
            Tableau de bord
          </Link>
          <span aria-hidden="true"> / </span>
          <span className="text-foreground">Pilotage</span>
        </nav>

        <h1 className="mt-2 text-3xl font-bold text-foreground">Où en est le projet</h1>
        <p className="mt-2 max-w-[70ch] text-sm text-muted-foreground">
          Le cap, les étapes en cours, et la mémoire des audits : de quoi savoir à tout moment ce qui
          avance et ce qui reste à faire.
        </p>

        <section className="mt-10">
          <h2 className="text-lg font-semibold text-foreground">Complétude du modèle</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            La grille de recettage dit, point par point, ce qui est prêt à être réutilisé.
          </p>
          <div className="mt-4">
            <ConformitySummary checks={checks} />
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {groupByArea(checks).map((group) => (
              <div key={group.area} className="rounded-xl border border-border bg-card p-5">
                <h3 className="text-sm font-semibold text-foreground">{group.area}</h3>
                <ul className="mt-3 space-y-2">
                  {group.items.map((check) => (
                    <li key={check.id} className="flex flex-wrap items-center gap-2">
                      <span className="text-sm text-muted-foreground">{check.label}</span>
                      <span className="ml-auto">
                        <CheckStatusBadge status={check.status} />
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-10">
          <h2 className="text-lg font-semibold text-foreground">Plan directeur</h2>
          {sections.length === 0 && ready ? (
            <p className="mt-2 text-sm text-muted-foreground">Le plan directeur n'a pas encore été rempli.</p>
          ) : (
            <dl className="mt-4 grid gap-4 sm:grid-cols-2">
              {sections.map((section) => (
                <div key={section.id} className="rounded-xl border border-border bg-card p-5">
                  <dt className="text-sm font-semibold text-foreground">{section.title}</dt>
                  <dd className="mt-1.5 text-sm text-muted-foreground">{section.content}</dd>
                </div>
              ))}
            </dl>
          )}
        </section>

        <section className="mt-10">
          <h2 className="text-lg font-semibold text-foreground">Feuille de route</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            {groups.map((status) => (
              <div key={status} className="rounded-xl border border-border bg-card p-5">
                <h3 className="text-sm font-semibold text-foreground">{statusLabel[status]}</h3>
                <ul className="mt-3 space-y-3">
                  {items
                    .filter((item) => item.status === status)
                    .map((item) => (
                      <li key={item.id}>
                        <p className="text-sm font-medium text-foreground">{item.title}</p>
                        <p className="text-xs text-muted-foreground">{item.description}</p>
                      </li>
                    ))}
                  {items.filter((item) => item.status === status).length === 0 ? (
                    <li className="text-xs text-muted-foreground">Rien ici pour l'instant.</li>
                  ) : null}
                </ul>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-10">
          <h2 className="text-lg font-semibold text-foreground">Derniers audits</h2>
          {audits.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">Aucun audit enregistré pour l'instant.</p>
          ) : (
            <ul className="mt-4 space-y-3">
              {audits.map((audit) => (
                <li key={audit.id} className="rounded-xl border border-border bg-card p-5">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-foreground">{audit.label}</p>
                    <span className="ml-auto text-sm font-semibold text-primary-text">
                      {audit.score}/{audit.max_score}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {new Date(audit.performed_at).toLocaleDateString("fr-FR")}
                  </p>
                  <p className="mt-2 text-sm text-muted-foreground">{audit.summary}</p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </PageShell>
  );
}
