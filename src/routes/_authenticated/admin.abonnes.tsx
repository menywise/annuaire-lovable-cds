import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
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
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { downloadCsv } from "@/lib/csv";
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
  const [rows, setRows] = useState<Subscriber[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoadError(false);
    const { data, error } = await supabase
      .from("newsletter_subscribers")
      .select("id, email, first_name, source, created_at, unsubscribed_at")
      .order("created_at", { ascending: false });
    if (error) {
      setLoadError(true);
      setRows([]);
      return;
    }
    setRows((data ?? []) as Subscriber[]);
  }, []);

  useEffect(() => {
    if (isAdmin) void load();
  }, [isAdmin, load]);

  async function setSubscribed(row: Subscriber, subscribed: boolean) {
    setBusyId(row.id);
    const { error } = await supabase
      .from("newsletter_subscribers")
      .update({ unsubscribed_at: subscribed ? null : new Date().toISOString() })
      .eq("id", row.id);
    setBusyId(null);
    if (error) {
      toast.error("La modification n'a pas pu être enregistrée.");
      return;
    }
    toast.success(subscribed ? "Abonné réinscrit." : "Abonné désinscrit.");
    void load();
  }

  async function remove(row: Subscriber) {
    if (!window.confirm(`Supprimer définitivement ${row.email} ? Cette action est irréversible.`))
      return;
    setBusyId(row.id);
    const { error } = await supabase.from("newsletter_subscribers").delete().eq("id", row.id);
    setBusyId(null);
    if (error) {
      toast.error("La suppression a échoué.");
      return;
    }
    toast.success("Abonné supprimé.");
    void load();
  }

  const active = (rows ?? []).filter((row) => !row.unsubscribed_at);

  function exportCsv() {
    downloadCsv(
      "abonnes.csv",
      active.map((row) => ({
        email: row.email,
        prenom: row.first_name ?? "",
        origine: row.source,
        inscription: row.created_at,
      })),
    );
  }

  return (
    <AdminShell
      title="Abonnés"
      intro="Les personnes qui souhaitent avoir de vos nouvelles. Exportez la liste quand vous voulez, elle vous appartient."
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {rows === null
            ? "Chargement…"
            : `${active.length} abonné${active.length > 1 ? "s" : ""} actif${active.length > 1 ? "s" : ""} sur ${rows.length} inscription${rows.length > 1 ? "s" : ""}.`}
        </p>
        <Button
          variant="outline"
          onClick={exportCsv}
          disabled={active.length === 0}
          title="Télécharger la liste des abonnés actifs au format CSV"
        >
          Exporter en CSV
        </Button>
      </div>

      {rows === null ? (
        <Skeleton className="mt-6 h-40 w-full rounded-xl" />
      ) : loadError ? (
        <div className="mt-6 rounded-lg border border-destructive/40 p-6 text-sm">
          <p className="text-destructive">La liste des abonnés n'a pas pu être chargée.</p>
          <Button
            className="mt-3"
            variant="outline"
            onClick={() => void load()}
            title="Recharger la liste"
          >
            Réessayer
          </Button>
        </div>
      ) : rows.length === 0 ? (
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
                <TableHead>Inscription</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-medium">{row.email}</TableCell>
                  <TableCell>{row.first_name ?? "—"}</TableCell>
                  <TableCell>{row.source}</TableCell>
                  <TableCell>{new Date(row.created_at).toLocaleDateString("fr-FR")}</TableCell>
                  <TableCell>
                    {row.unsubscribed_at ? (
                      <Badge variant="secondary">Désinscrit</Badge>
                    ) : (
                      <Badge>Actif</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busyId === row.id}
                        onClick={() => void setSubscribed(row, Boolean(row.unsubscribed_at))}
                        title={
                          row.unsubscribed_at ? "Réinscrire cet abonné" : "Désinscrire cet abonné"
                        }
                      >
                        {row.unsubscribed_at ? "Réinscrire" : "Désinscrire"}
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        disabled={busyId === row.id}
                        onClick={() => void remove(row)}
                        title="Supprimer définitivement cet abonné"
                      >
                        Supprimer
                      </Button>
                    </div>
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
