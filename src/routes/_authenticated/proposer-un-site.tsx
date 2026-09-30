import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { PageShell } from "@/components/cds/SiteHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { requireFeature } from "@/config/features";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { formatDate } from "@/lib/format";
import { seo } from "@/lib/seo";
import { WATCH_SUBMISSION_LABEL } from "@/lib/watch";
import { submitSite } from "@/lib/watch.functions";

export const Route = createFileRoute("/_authenticated/proposer-un-site")({
  beforeLoad: () => requireFeature("watch"),
  head: () =>
    seo({
      title: "Proposer un site",
      description: "Signalez un site à la veille : il est analysé puis examiné par l'équipe.",
      path: "/proposer-un-site",
      noindex: true,
    }),
  component: ProposeSitePage,
});

type Submission = {
  id: string;
  host: string;
  status: string;
  created_at: string;
  result: { message?: string } | null;
};

function ProposeSitePage() {
  const { user } = useAuth();
  const [url, setUrl] = useState("");
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);
  const [rows, setRows] = useState<Submission[] | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("watch_submissions")
      .select("id, host, status, created_at, result")
      .eq("submitted_by", user.id)
      .order("created_at", { ascending: false })
      .limit(30);
    setRows((data ?? []) as Submission[]);
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  async function send(event: React.FormEvent) {
    event.preventDefault();
    if (!url.trim()) return;
    setSending(true);
    try {
      const { host } = await submitSite({ data: { url, note } });
      toast.success("Merci, site proposé.", {
        description: `${host} sera analysé automatiquement, puis examiné par l'équipe.`,
      });
      setUrl("");
      setNote("");
      void load();
    } catch (err) {
      toast.error("Proposition non enregistrée.", {
        description: err instanceof Error ? err.message : "Réessayez dans un instant.",
      });
    } finally {
      setSending(false);
    }
  }

  return (
    <PageShell>
      <div className="mx-auto max-w-[720px]">
        <h1 className="text-3xl font-bold text-foreground">Proposer un site</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Vous connaissez un site qui mérite d'être suivi ? Indiquez son adresse : il est analysé
          automatiquement (technologies, disponibilité), puis l'équipe décide de sa place. Cinq
          propositions par jour au plus.
        </p>

        <form
          onSubmit={send}
          className="mt-6 space-y-4 rounded-xl border border-border bg-card p-5"
        >
          <div className="space-y-1.5">
            <Label htmlFor="propose-url">Adresse du site</Label>
            <Input
              id="propose-url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="exemple.fr"
              inputMode="url"
              autoComplete="url"
              maxLength={300}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="propose-note">Pourquoi ce site ? (facultatif)</Label>
            <Textarea
              id="propose-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              maxLength={500}
            />
          </div>
          <Button
            type="submit"
            disabled={sending || !url.trim()}
            title="Envoyer ce site à la veille"
          >
            {sending ? "Envoi…" : "Proposer ce site"}
          </Button>
        </form>

        <section className="mt-8">
          <h2 className="text-base font-semibold text-foreground">Mes propositions</h2>
          {rows === null ? (
            <p className="mt-2 text-sm text-muted-foreground">Chargement…</p>
          ) : rows.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">Aucune proposition pour le moment.</p>
          ) : (
            <ul className="mt-3 divide-y divide-border rounded-xl border border-border bg-card">
              {rows.map((row) => (
                <li key={row.id} className="flex flex-wrap items-center gap-2 p-4 text-sm">
                  <span className="font-medium text-foreground">{row.host}</span>
                  <Badge variant={row.status === "acceptee" ? "default" : "secondary"}>
                    {WATCH_SUBMISSION_LABEL[row.status] ?? row.status}
                  </Badge>
                  <span className="ml-auto text-xs text-muted-foreground">
                    {formatDate(row.created_at)}
                  </span>
                  {row.result?.message && row.status !== "en_attente" ? (
                    <p className="w-full text-xs text-muted-foreground">{row.result.message}</p>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </PageShell>
  );
}
