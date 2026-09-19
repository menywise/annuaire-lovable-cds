import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AdminShell } from "@/components/cds/AdminShell";
import {
  CheckStatusBadge,
  ConformitySummary,
  checkStatusLabel,
  conformityScore,
  groupByArea,
  type TemplateCheck,
} from "@/components/cds/ConformityBoard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/_authenticated/admin/conformite")({
  head: () =>
    seo({
      title: "Conformité du modèle",
      description:
        "Grille de contrôle du modèle CDS : ce qui est conforme, à corriger ou à vérifier.",
      path: "/admin/conformite",
      noindex: true,
    }),
  component: AdminConformite,
});

const statuses = ["conforme", "a_verifier", "a_corriger", "non_applicable"] as const;

function AdminConformite() {
  const { user } = useAuth();
  const [checks, setChecks] = useState<TemplateCheck[]>([]);
  const [busy, setBusy] = useState(false);

  async function load() {
    const { data } = await supabase
      .from("template_checks")
      .select("id, code, area, label, requirement, status, severity, evidence, position")
      .order("position", { ascending: true });
    setChecks(data ?? []);
  }

  useEffect(() => {
    void load();
  }, []);

  async function update(check: TemplateCheck, patch: Partial<TemplateCheck>) {
    setChecks((prev) => prev.map((item) => (item.id === check.id ? { ...item, ...patch } : item)));
    const { error } = await supabase.from("template_checks").update(patch).eq("id", check.id);
    if (error)
      toast.error("Modification non enregistrée.", { description: "Réessayez dans un instant." });
  }

  /** Fige l'état courant de la grille dans un audit daté, avec ses constats. */
  async function snapshot() {
    if (!user) return;
    setBusy(true);
    const score = conformityScore(checks);
    const { data: audit, error } = await supabase
      .from("audits")
      .insert({
        label: `Recettage du modèle — ${new Date().toLocaleDateString("fr-FR")}`,
        score: score.ok,
        max_score: score.total,
        summary: `${score.percent}% de complétude : ${score.toFix} points à corriger, ${score.toCheck} à vérifier, ${score.paused} en pause.`,
      })
      .select("id")
      .maybeSingle();
    if (error || !audit) {
      setBusy(false);
      toast.error("Audit non enregistré.", { description: "Réessayez dans un instant." });
      return;
    }
    const findings = checks
      .filter((check) => check.status === "a_corriger" || check.status === "a_verifier")
      .map((check) => ({
        audit_id: audit.id,
        code: check.code,
        severity: check.severity === "bloquant" ? "majeur" : check.severity,
        location: check.area,
        description: `${check.label} — ${checkStatusLabel[check.status]}${check.evidence ? ` : ${check.evidence}` : ""}`,
      }));
    if (findings.length > 0) await supabase.from("audit_findings").insert(findings);
    setBusy(false);
    toast.success("Audit enregistré.", {
      description: "Il rejoint l'historique visible depuis la page Pilotage.",
    });
  }

  return (
    <AdminShell
      title="Conformité du modèle"
      intro="La grille de recettage du modèle : chaque point porte un état, une exigence et un constat. Le score se recalcule tout seul et les points mis en pause sortent du calcul."
    >
      <ConformitySummary checks={checks} />

      <div className="mt-4">
        <Button
          type="button"
          onClick={snapshot}
          disabled={busy}
          title="Figer l'état actuel dans un audit daté"
        >
          {busy ? "Enregistrement…" : "Enregistrer un audit daté"}
        </Button>
      </div>

      {groupByArea(checks).map((group) => (
        <section key={group.area} className="mt-8">
          <h2 className="text-base font-semibold text-foreground">{group.area}</h2>
          <ul className="mt-3 space-y-3">
            {group.items.map((check) => (
              <li key={check.id} className="rounded-xl border border-border bg-card p-5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-medium text-muted-foreground">{check.code}</span>
                  <p className="text-sm font-semibold text-foreground">{check.label}</p>
                  <span className="ml-auto">
                    <CheckStatusBadge status={check.status} />
                  </span>
                </div>
                <p className="mt-1.5 text-xs text-muted-foreground">{check.requirement}</p>

                <div className="mt-3 flex flex-wrap gap-2">
                  {statuses.map((status) => (
                    <button
                      key={status}
                      type="button"
                      onClick={() => void update(check, { status })}
                      title={`Marquer ce point : ${checkStatusLabel[status]}`}
                      className={`min-h-11 rounded-md border px-3 text-xs font-medium transition-colors ${
                        check.status === status
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-card text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {checkStatusLabel[status]}
                    </button>
                  ))}
                </div>

                <div className="mt-3 space-y-1.5">
                  <Label htmlFor={`evidence-${check.id}`}>Constat</Label>
                  <Textarea
                    id={`evidence-${check.id}`}
                    rows={2}
                    defaultValue={check.evidence}
                    placeholder="Ce qui a été vérifié, où, et ce qui reste à faire."
                    onBlur={(event) => {
                      if (event.target.value !== check.evidence) {
                        void update(check, { evidence: event.target.value });
                      }
                    }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}

      <section className="mt-10 rounded-xl border border-border bg-card p-5">
        <h2 className="text-base font-semibold text-foreground">Ajouter un point de contrôle</h2>
        <NewCheckForm onDone={load} nextPosition={(checks.at(-1)?.position ?? 0) + 1} />
      </section>
    </AdminShell>
  );
}

function NewCheckForm({ onDone, nextPosition }: { onDone: () => void; nextPosition: number }) {
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setBusy(true);
    const { error } = await supabase.from("template_checks").insert({
      code: String(data.get("code") ?? "").trim(),
      area: String(data.get("area") ?? "").trim(),
      label: String(data.get("label") ?? "").trim(),
      requirement: String(data.get("requirement") ?? "").trim(),
      position: nextPosition,
    });
    setBusy(false);
    if (error) {
      toast.error("Point non ajouté.", { description: "Le code doit être unique." });
      return;
    }
    form.reset();
    toast.success("Point de contrôle ajouté.");
    onDone();
  }

  return (
    <form onSubmit={submit} className="mt-4 grid gap-3 sm:grid-cols-2">
      <div className="space-y-1.5">
        <Label htmlFor="check-code">Code</Label>
        <Input id="check-code" name="code" required placeholder="SEO-5" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="check-area">Domaine</Label>
        <Input id="check-area" name="area" required placeholder="Référencement" />
      </div>
      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor="check-label">Intitulé</Label>
        <Input id="check-label" name="label" required placeholder="Ce qui doit exister" />
      </div>
      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor="check-requirement">Exigence</Label>
        <Input
          id="check-requirement"
          name="requirement"
          placeholder="Comment savoir que c'est conforme"
        />
      </div>
      <div className="sm:col-span-2">
        <Button type="submit" disabled={busy} title="Ajouter ce point à la grille">
          {busy ? "Ajout…" : "Ajouter le point"}
        </Button>
      </div>
    </form>
  );
}
