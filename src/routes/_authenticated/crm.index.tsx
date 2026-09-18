import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CrmShell, CRM_STAGES } from "@/components/cds/CrmShell";
import { Skeleton } from "@/components/ui/skeleton";
import { requireFeature } from "@/config/features";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { seo } from "@/lib/seo";
import { formatDate } from "@/lib/format";

type Overview = {
  total: number;
  actifs: number;
  interactions: number;
  stages: Record<string, number>;
  late: Array<{ id: string; title: string; due_date: string | null; prospect_id: string | null }>;
};

export const Route = createFileRoute("/_authenticated/crm/")({
  beforeLoad: () => requireFeature("crm"),
  head: () =>
    seo({
      title: "Suivi de relation",
      description: "Vos contacts, leur étape et les actions à ne pas laisser passer.",
      path: "/crm",
      noindex: true,
    }),
  component: CrmHomePage,
});

function CrmHomePage() {
  const { user } = useAuth();
  const [data, setData] = useState<Overview | null>(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    void (async () => {
      const today = new Date().toISOString().slice(0, 10);
      const [{ data: prospects }, { count: interactions }, { data: late }] = await Promise.all([
        supabase.from("crm_prospects").select("stage, active").eq("owner_id", user.id),
        supabase
          .from("crm_interactions")
          .select("id", { count: "exact", head: true })
          .eq("owner_id", user.id),
        supabase
          .from("crm_actions")
          .select("id, title, due_date, prospect_id")
          .eq("owner_id", user.id)
          .eq("done", false)
          .not("due_date", "is", null)
          .lte("due_date", today)
          .order("due_date", { ascending: true })
          .limit(10),
      ]);
      if (cancelled) return;
      const stages: Record<string, number> = {};
      for (const row of prospects ?? []) {
        stages[row.stage] = (stages[row.stage] ?? 0) + 1;
      }
      setData({
        total: (prospects ?? []).length,
        actifs: (prospects ?? []).filter((row) => row.active).length,
        interactions: interactions ?? 0,
        stages,
        late: late ?? [],
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  return (
    <CrmShell
      title="Là où en sont vos relations"
      intro="Un coup d'œil suffit : qui avance, qui attend de vos nouvelles, et ce que vous aviez prévu."
    >
      {data === null ? (
        <div className="space-y-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      ) : (
        <>
          <ul className="grid gap-4 sm:grid-cols-3">
            {[
              { label: "Contacts suivis", value: data.total },
              { label: "Contacts actifs", value: data.actifs },
              { label: "Échanges enregistrés", value: data.interactions },
            ].map((card) => (
              <li key={card.label} className="rounded-xl border border-border bg-card p-5">
                <p className="text-2xl font-bold text-foreground">{card.value}</p>
                <p className="mt-1 text-xs text-muted-foreground">{card.label}</p>
              </li>
            ))}
          </ul>

          <section className="mt-8">
            <h2 className="text-base font-semibold text-foreground">Par étape</h2>
            <ul className="mt-3 grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
              {CRM_STAGES.map((stage) => (
                <li key={stage.value} className="rounded-lg border border-border bg-card p-4">
                  <p className="text-lg font-semibold text-foreground">
                    {data.stages[stage.value] ?? 0}
                  </p>
                  <p className="text-xs text-muted-foreground">{stage.label}</p>
                </li>
              ))}
            </ul>
          </section>

          <section className="mt-8">
            <h2 className="text-base font-semibold text-foreground">Actions en retard</h2>
            {data.late.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">
                Rien en retard. Profitez-en pour prendre de l'avance.
              </p>
            ) : (
              <ul className="mt-3 space-y-2">
                {data.late.map((action) => (
                  <li
                    key={action.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-card p-4 text-sm"
                  >
                    <span className="text-foreground">{action.title}</span>
                    <span className="text-xs text-warning-text">
                      échéance {formatDate(action.due_date)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <Link
              to="/crm/actions"
              title="Voir toutes les actions prévues"
              className="mt-3 inline-flex min-h-11 items-center text-sm text-primary-text hover:underline"
            >
              Voir toutes les actions
            </Link>
          </section>
        </>
      )}
    </CrmShell>
  );
}
