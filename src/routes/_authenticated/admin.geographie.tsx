import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AdminShell } from "@/components/cds/AdminShell";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { requireFeature } from "@/config/features";
import { downloadCsv } from "@/lib/csv";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/_authenticated/admin/geographie")({
  beforeLoad: () => requireFeature("geo"),
  head: () =>
    seo({
      title: "Administration — Géographie",
      description: "Les départements couverts et le nombre de fiches rattachées à chacun.",
      path: "/admin/geographie",
      noindex: true,
    }),
  component: AdminGeoPage,
});

type Row = { code: string; nom: string; region: string; slug: string; population: number; listings: number };

function AdminGeoPage() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    void (async () => {
      const [deps, listings] = await Promise.all([
        supabase.from("geo_departements").select("code, nom, region, slug, population").order("code"),
        supabase.from("directory_listings").select("departement").eq("status", "published"),
      ]);
      if (deps.error || listings.error) {
        setFailed(true);
        return;
      }
      const counts = new Map<string, number>();
      for (const item of listings.data ?? []) {
        if (item.departement) counts.set(item.departement, (counts.get(item.departement) ?? 0) + 1);
      }
      setRows((deps.data ?? []).map((dep) => ({ ...dep, listings: counts.get(dep.code) ?? 0 })));
    })();
  }, []);

  return (
    <AdminShell
      title="Géographie"
      intro="Les pages départementales se génèrent automatiquement à partir de cette liste : rien à créer à la main."
    >
      {failed ? (
        <p role="alert" className="rounded-lg border border-destructive/40 p-4 text-sm text-destructive">
          Les départements n'ont pas pu être chargés. Rechargez la page.
        </p>
      ) : rows === null ? (
        <p className="text-sm text-muted-foreground">Chargement…</p>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-sm text-muted-foreground">
              {rows.length} départements · {rows.reduce((sum, row) => sum + row.listings, 0)} fiches rattachées
            </p>
            <Button
              variant="outline"
              className="ml-auto"
              title="Télécharger la liste au format tableur"
              onClick={() => downloadCsv("departements.csv", rows)}
            >
              Export CSV
            </Button>
          </div>
          <div className="mt-4 overflow-x-auto rounded-xl border border-border bg-card">
            <table className="w-full text-sm">
              <thead className="border-b border-border text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Code</th>
                  <th className="px-4 py-3">Département</th>
                  <th className="px-4 py-3">Région</th>
                  <th className="px-4 py-3">Fiches</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.code} className="border-b border-border last:border-0">
                    <td className="px-4 py-2.5 text-muted-foreground">{row.code}</td>
                    <td className="px-4 py-2.5 text-foreground">{row.nom}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{row.region}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{row.listings}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </AdminShell>
  );
}
