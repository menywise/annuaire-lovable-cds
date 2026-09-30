import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AdminShell } from "@/components/cds/AdminShell";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { requireFeature } from "@/config/features";
import { CRM_STAGES, CRM_STAGE_LABEL } from "@/components/cds/CrmShell";
import { downloadCsv } from "@/lib/csv";
import { formatDate } from "@/lib/format";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/_authenticated/admin/crm")({
  beforeLoad: () => requireFeature("crm"),
  head: () =>
    seo({
      title: "Administration — Suivi des contacts",
      description: "Vue d'ensemble des contacts suivis par l'ensemble des membres.",
      path: "/admin/crm",
      noindex: true,
    }),
  component: AdminCrmPage,
});

/** Seules des données non nominatives sont lues : le détail des fiches reste privé à chaque membre. */
type Prospect = {
  id: string;
  stage: string;
  source: string;
  owner_id: string;
  created_at: string;
};

function AdminCrmPage() {
  const [rows, setRows] = useState<Prospect[] | null>(null);
  const [lateActions, setLateActions] = useState(0);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    void (async () => {
      const [prospects, actions] = await Promise.all([
        supabase
          .from("crm_prospects")
          .select("id, stage, source, owner_id, created_at")
          .order("created_at", { ascending: false }),
        supabase
          .from("crm_actions")
          .select("id", { count: "exact", head: true })
          .eq("done", false)
          .lt("due_date", new Date().toISOString().slice(0, 10)),
      ]);
      setFailed(Boolean(prospects.error || actions.error));
      setRows(prospects.data ?? []);
      setLateActions(actions.count ?? 0);
    })();
  }, []);

  const byStage = CRM_STAGES.map((stage) => ({
    value: stage.value,
    label: stage.label,
    count: (rows ?? []).filter((row) => row.stage === stage.value).length,
  }));

  const bySource = Object.entries(
    (rows ?? []).reduce<Record<string, number>>((acc, row) => {
      const key = row.source || "Non précisée";
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    }, {}),
  ).sort((a, b) => b[1] - a[1]);

  const byMonth = Object.entries(
    (rows ?? []).reduce<Record<string, number>>((acc, row) => {
      const key = row.created_at.slice(0, 7);
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    }, {}),
  ).sort((a, b) => b[0].localeCompare(a[0]));

  return (
    <AdminShell
      title="Suivi des contacts"
      intro="Les chiffres consolidés de tous les membres. Le détail de chaque fiche reste privé à son propriétaire."
    >
      {failed ? (
        <p role="alert" className="mb-4 rounded-lg border border-destructive/40 p-4 text-sm text-destructive-text">
          Une partie des chiffres n'a pas pu être chargée. Rechargez la page.
        </p>
      ) : null}
      {rows === null ? (
        <p className="text-sm text-muted-foreground">Chargement…</p>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-border bg-card p-5">
              <p className="text-xs uppercase text-muted-foreground">Contacts suivis</p>
              <p className="mt-1 text-2xl font-bold text-foreground">{rows.length}</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-5">
              <p className="text-xs uppercase text-muted-foreground">Membres utilisateurs</p>
              <p className="mt-1 text-2xl font-bold text-foreground">
                {new Set(rows.map((row) => row.owner_id)).size}
              </p>
            </div>
            <div className="rounded-xl border border-border bg-card p-5">
              <p className="text-xs uppercase text-muted-foreground">Actions en retard</p>
              <p className="mt-1 text-2xl font-bold text-warning-text">{lateActions}</p>
            </div>
          </div>

          <div className="mt-6 rounded-xl border border-border bg-card p-5">
            <h2 className="text-sm font-semibold text-foreground">Répartition par étape</h2>
            <ul className="mt-3 grid gap-2 sm:grid-cols-3">
              {byStage.map((item) => (
                <li key={item.value} className="flex items-center justify-between rounded-lg bg-muted px-3 py-2 text-sm">
                  <span className="text-muted-foreground">{item.label}</span>
                  <span className="font-semibold text-foreground">{item.count}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-border bg-card p-5">
              <h2 className="text-sm font-semibold text-foreground">Par source</h2>
              {bySource.length === 0 ? (
                <p className="mt-3 text-sm text-muted-foreground">Aucun contact pour l'instant.</p>
              ) : (
                <ul className="mt-3 space-y-1.5 text-sm">
                  {bySource.map(([source, count]) => (
                    <li key={source} className="flex justify-between">
                      <span className="text-muted-foreground">{source}</span>
                      <span className="font-semibold text-foreground">{count}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="rounded-xl border border-border bg-card p-5">
              <h2 className="text-sm font-semibold text-foreground">Nouveaux contacts par mois</h2>
              {byMonth.length === 0 ? (
                <p className="mt-3 text-sm text-muted-foreground">Aucun contact pour l'instant.</p>
              ) : (
                <ul className="mt-3 space-y-1.5 text-sm">
                  {byMonth.slice(0, 12).map(([month, count]) => (
                    <li key={month} className="flex justify-between">
                      <span className="text-muted-foreground">{month}</span>
                      <span className="font-semibold text-foreground">{count}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <div className="mt-6 flex justify-end">
            <Button
              variant="outline"
              title="Télécharger les chiffres (sans nom ni coordonnée) au format tableur"
              onClick={() =>
                downloadCsv(
                  "contacts-chiffres.csv",
                  byStage.map((item) => ({ etape: item.label, contacts: item.count })),
                )
              }
            >
              Export CSV des chiffres
            </Button>
          </div>
        </>
      )}
    </AdminShell>
  );
}
