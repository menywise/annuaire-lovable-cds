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

type Prospect = {
  id: string;
  name: string;
  company: string;
  email: string;
  stage: string;
  source: string;
  owner_id: string;
  created_at: string;
};

function AdminCrmPage() {
  const [rows, setRows] = useState<Prospect[] | null>(null);
  const [lateActions, setLateActions] = useState(0);

  useEffect(() => {
    void (async () => {
      const [prospects, actions] = await Promise.all([
        supabase
          .from("crm_prospects")
          .select("id, name, company, email, stage, source, owner_id, created_at")
          .order("created_at", { ascending: false }),
        supabase
          .from("crm_actions")
          .select("id", { count: "exact", head: true })
          .eq("done", false)
          .lt("due_date", new Date().toISOString().slice(0, 10)),
      ]);
      setRows(prospects.data ?? []);
      setLateActions(actions.count ?? 0);
    })();
  }, []);

  const byStage = CRM_STAGES.map((stage) => ({
    value: stage.value,
    label: stage.label,
    count: (rows ?? []).filter((row) => row.stage === stage.value).length,
  }));

  return (
    <AdminShell
      title="Suivi des contacts"
      intro="Les chiffres consolidés de tous les membres. Le détail de chaque fiche reste privé à son propriétaire."
    >
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

          <div className="mt-6 flex items-center gap-3">
            <h2 className="text-sm font-semibold text-foreground">Derniers contacts ajoutés</h2>
            <Button
              variant="outline"
              className="ml-auto"
              title="Télécharger la liste au format tableur"
              onClick={() => downloadCsv("contacts.csv", rows)}
            >
              Export CSV
            </Button>
          </div>
          <ul className="mt-3 space-y-2">
            {rows.slice(0, 50).map((row) => (
              <li
                key={row.id}
                className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card px-4 py-3 text-sm"
              >
                <span className="font-medium text-foreground">{row.name}</span>
                <span className="text-xs text-muted-foreground">{row.company}</span>
                <span className="ml-auto rounded-full bg-muted px-2.5 py-0.5 text-xs text-muted-foreground">
                  {CRM_STAGE_LABEL[row.stage] ?? row.stage}
                </span>
                <span className="text-xs text-muted-foreground">{formatDate(row.created_at)}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </AdminShell>
  );
}
