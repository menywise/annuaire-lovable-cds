import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PageShell } from "@/components/cds/SiteHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { requireFeature } from "@/config/features";
import { supabase } from "@/integrations/supabase/client";
import { reportPublicStatusLabel, reportReasonLabel } from "@/lib/reports";
import { seo } from "@/lib/seo";

type SearchParams = { code?: string };
type Suivi = {
  status: string;
  reason: string;
  created_at: string;
  handled_at: string | null;
  public_note: string | null;
};

/** Code de suivi : chiffres et lettres seulement, en majuscules (le code rendu par la base). */
const cleanCode = (v: unknown) =>
  typeof v === "string"
    ? v
        .replace(/[^0-9a-z]/gi, "")
        .toUpperCase()
        .slice(0, 20)
    : "";

export const Route = createFileRoute("/signalement")({
  validateSearch: (search: Record<string, unknown>): SearchParams => {
    const code = cleanCode(search["code"]);
    return code ? { code } : {};
  },
  beforeLoad: () => requireFeature("reports"),
  head: () =>
    seo({
      title: "Suivre mon signalement",
      description: "Retrouvez où en est votre signalement grâce au code reçu lors de l'envoi.",
      path: "/signalement",
      noindex: true,
    }),
  component: TrackingPage,
});

function TrackingPage() {
  const { code = "" } = Route.useSearch();
  const navigate = useNavigate({ from: "/signalement" });
  const [input, setInput] = useState(code);
  const [result, setResult] = useState<Suivi | "inconnu" | "erreur" | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!code) return;
    let active = true;
    setBusy(true);
    void supabase.rpc("report_status", { _code: code }).then(({ data, error }) => {
      if (!active) return;
      setBusy(false);
      if (error) {
        setResult("erreur");
        return;
      }
      const row = (data ?? [])[0] as Suivi | undefined;
      setResult(row ?? "inconnu");
    });
    return () => {
      active = false;
    };
  }, [code]);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const next = cleanCode(input);
    void navigate({ search: next ? { code: next } : {} });
  }

  return (
    <PageShell>
      <div className="mx-auto max-w-[620px]">
        <h1 className="text-3xl font-bold text-foreground">Suivre mon signalement</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Saisissez le code reçu à l'envoi de votre signalement : vous voyez où en est son
          traitement et la réponse de l'équipe.
        </p>
        <form className="mt-6 flex flex-wrap items-end gap-3" onSubmit={onSubmit}>
          <div className="min-w-[220px] flex-1 space-y-1.5">
            <Label htmlFor="code">Code de suivi</Label>
            <Input
              id="code"
              name="code"
              autoComplete="off"
              maxLength={20}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Exemple : 3FA9C21B07"
              className="font-mono uppercase tracking-widest"
            />
          </div>
          <Button
            type="submit"
            disabled={busy || cleanCode(input).length < 6}
            title="Afficher le suivi du signalement"
          >
            Je consulte le suivi
          </Button>
        </form>

        {result === "inconnu" ? (
          <p className="mt-6 rounded-lg border border-border p-5 text-sm text-foreground">
            Ce code ne correspond à aucun signalement. Vérifiez sa saisie : il compte dix
            caractères, des chiffres et des lettres de A à F.
          </p>
        ) : result === "erreur" ? (
          <p className="mt-6 rounded-lg border border-destructive/40 p-5 text-sm text-destructive-text">
            Le suivi n'a pas pu être affiché : réessayez dans un instant.
          </p>
        ) : result ? (
          <div className="mt-6 rounded-xl border border-border bg-card p-5">
            <p className="text-sm font-semibold text-foreground">
              {reportPublicStatusLabel(result.status)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {reportReasonLabel(result.reason)} · envoyé le{" "}
              {new Date(result.created_at).toLocaleDateString("fr-FR")}
              {result.handled_at
                ? ` · traité le ${new Date(result.handled_at).toLocaleDateString("fr-FR")}`
                : ""}
            </p>
            {result.public_note ? (
              <p className="mt-3 whitespace-pre-line rounded-lg bg-muted px-3 py-2 text-sm text-foreground">
                {result.public_note}
              </p>
            ) : null}
          </div>
        ) : null}

        <p className="mt-8 text-sm text-muted-foreground">
          Les corrections apportées grâce aux lecteurs sont réunies sur{" "}
          <Link to="/ameliorations" className="font-medium text-foreground underline">
            Le site s'améliore grâce à vous
          </Link>
          .
        </p>
      </div>
    </PageShell>
  );
}
