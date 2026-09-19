import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AdminShell, useIsAdmin } from "@/components/cds/AdminShell";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/_authenticated/admin/abonnes")({
  head: () =>
    seo({
      title: "Abonnés",
      description: "Liste des inscrits à la lettre d'information et export.",
      path: "/admin/abonnes",
      noindex: true,
    }),
  component: AdminAbonnesPage,
});

type Subscriber = {
  id: string;
  email: string;
  first_name: string | null;
  source: string;
  created_at: string;
  unsubscribed_at: string | null;
};

function AdminAbonnesPage() {
  const isAdmin = useIsAdmin();
  const [rows, setRows] = useState<Subscriber[]>([]);

  useEffect(() => {
    if (!isAdmin) return;
    supabase
      .from("newsletter_subscribers")
      .select("id, email, first_name, source, created_at, unsubscribed_at")
      .order("created_at", { ascending: false })
      .then(({ data }) => setRows((data ?? []) as Subscriber[]));
  }, [isAdmin]);

  function exportCsv() {
    const header = "email;prenom;origine;inscription\n";
    const body = rows
      .filter((row) => !row.unsubscribed_at)
      .map((row) => `${row.email};${row.first_name ?? ""};${row.source};${row.created_at}`)
      .join("\n");
    const blob = new Blob([header + body], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "abonnes.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <AdminShell
      title="Abonnés"
      intro="Les personnes qui souhaitent avoir de vos nouvelles. Exportez la liste quand vous voulez, elle vous appartient."
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {rows.length} inscription{rows.length > 1 ? "s" : ""} enregistrée
          {rows.length > 1 ? "s" : ""}.
        </p>
        <Button
          variant="outline"
          onClick={exportCsv}
          disabled={rows.length === 0}
          title="Télécharger la liste des abonnés au format CSV"
        >
          Exporter en CSV
        </Button>
      </div>

      {rows.length === 0 ? (
        <p className="mt-6 rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          Aucun abonné pour le moment.
        </p>
      ) : (
        <div className="mt-6 rounded-xl border border-border bg-card p-2">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Adresse e-mail</TableHead>
                <TableHead>Prénom</TableHead>
                <TableHead>Origine</TableHead>
                <TableHead className="text-right">Inscription</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-medium">{row.email}</TableCell>
                  <TableCell>{row.first_name ?? "—"}</TableCell>
                  <TableCell>{row.source}</TableCell>
                  <TableCell className="text-right">
                    {new Date(row.created_at).toLocaleDateString("fr-FR")}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </AdminShell>
  );
}
