import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { AdminShell } from "@/components/cds/AdminShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { seo } from "@/lib/seo";
import { requireFeature } from "@/config/features";

export const Route = createFileRoute("/_authenticated/admin/pilotage")({
  beforeLoad: () => requireFeature("studio"),
  head: () =>
    seo({
      title: "Administration — Pilotage",
      description: "Feuille de route, plan directeur et historique des audits.",
      path: "/admin/pilotage",
      noindex: true,
    }),
  component: AdminPilotagePage,
});

type Item = {
  id: string;
  title: string;
  description: string;
  lot: string;
  status: string;
  priority: string;
  position: number;
  public_visible: boolean;
};

type Section = { id: string; title: string; content: string; position: number };

type Audit = {
  id: string;
  label: string;
  score: number;
  max_score: number;
  summary: string;
  performed_at: string;
};

type Finding = {
  id: string;
  audit_id: string;
  code: string;
  severity: string;
  location: string;
  description: string;
  resolved: boolean;
};

const statusLabel: Record<string, string> = {
  a_faire: "À faire",
  en_cours: "En cours",
  fait: "Fait",
};

function AdminPilotagePage() {
  const [items, setItems] = useState<Item[] | null>(null);
  const [sections, setSections] = useState<Section[] | null>(null);
  const [audits, setAudits] = useState<Audit[] | null>(null);
  const [findings, setFindings] = useState<Finding[]>([]);

  const load = useCallback(async () => {
    const [roadmap, masterplan, auditList, findingList] = await Promise.all([
      supabase
        .from("roadmap_items")
        .select("id, title, description, lot, status, priority, position, public_visible")
        .order("position", { ascending: true }),
      supabase
        .from("masterplan_sections")
        .select("id, title, content, position")
        .order("position", { ascending: true }),
      supabase
        .from("audits")
        .select("id, label, score, max_score, summary, performed_at")
        .order("performed_at", { ascending: false }),
      supabase
        .from("audit_findings")
        .select("id, audit_id, code, severity, location, description, resolved"),
    ]);
    setItems(roadmap.data ?? []);
    setSections(masterplan.data ?? []);
    setAudits(auditList.data ?? []);
    setFindings(findingList.data ?? []);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function updateItem(id: string, changes: Partial<Item>) {
    const { error } = await supabase.from("roadmap_items").update(changes).eq("id", id);
    if (error) toast.error("Modification non enregistrée.");
    else void load();
  }

  async function addItem(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    const { error } = await supabase.from("roadmap_items").insert({
      title: String(data.get("title") ?? "").trim(),
      description: String(data.get("description") ?? "").trim(),
      lot: String(data.get("lot") ?? "").trim(),
      status: "a_faire",
      priority: "normale",
      position: (items?.length ?? 0) + 1,
    });
    if (error) {
      toast.error("Étape non ajoutée.");
      return;
    }
    form.reset();
    toast.success("Étape ajoutée à la feuille de route.");
    void load();
  }

  async function saveSection(section: Section, content: string) {
    const { error } = await supabase
      .from("masterplan_sections")
      .update({ content })
      .eq("id", section.id);
    if (error) toast.error("Section non enregistrée.");
    else toast.success("Plan directeur mis à jour.");
  }

  async function addAudit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    const { error } = await supabase.from("audits").insert({
      label: String(data.get("label") ?? "").trim(),
      score: Number(data.get("score") ?? 0),
      max_score: Number(data.get("max_score") ?? 100),
      summary: String(data.get("summary") ?? "").trim(),
    });
    if (error) {
      toast.error("Audit non enregistré.");
      return;
    }
    form.reset();
    toast.success("Audit enregistré.", {
      description: "Il rejoint l'historique et sert de mémoire.",
    });
    void load();
  }

  return (
    <AdminShell
      title="Pilotage"
      intro="Ce que vous construisez, dans quel ordre, et ce que chaque audit a relevé : tout se règle ici, sans toucher au code."
    >
      <section>
        <h2 className="text-base font-semibold text-foreground">Feuille de route</h2>
        {items === null ? (
          <p className="mt-3 text-sm text-muted-foreground">Chargement…</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {items.map((item) => (
              <li key={item.id} className="rounded-xl border border-border bg-card p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold text-foreground">{item.title}</p>
                  <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs text-muted-foreground">
                    {item.lot}
                  </span>
                </div>
                <p className="mt-1.5 text-sm text-muted-foreground">{item.description}</p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {(["a_faire", "en_cours", "fait"] as const).map((status) => (
                    <button
                      key={status}
                      type="button"
                      onClick={() => updateItem(item.id, { status })}
                      title={`Marquer cette étape comme « ${statusLabel[status]} »`}
                      className={`min-h-11 rounded-md border px-3 text-xs font-medium transition-colors sm:min-h-9 ${
                        item.status === status
                          ? "border-primary bg-accent text-foreground"
                          : "border-border text-muted-foreground hover:bg-accent"
                      }`}
                    >
                      {statusLabel[status]}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => updateItem(item.id, { public_visible: !item.public_visible })}
                    title={
                      item.public_visible
                        ? "Masquer cette étape du public"
                        : "Rendre cette étape publique"
                    }
                    className="ml-auto min-h-11 rounded-md border border-border px-3 text-xs font-medium text-muted-foreground hover:bg-accent sm:min-h-9"
                  >
                    {item.public_visible ? "Visible du public" : "Interne"}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}

        <form onSubmit={addItem} className="mt-6 rounded-xl border border-border bg-card p-5">
          <h3 className="text-sm font-semibold text-foreground">Ajouter une étape</h3>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="r-title">Titre</Label>
              <Input id="r-title" name="title" required placeholder="Brancher les paiements" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="r-lot">Lot</Label>
              <Input id="r-lot" name="lot" placeholder="Lot 6" />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="r-desc">Description</Label>
              <Input id="r-desc" name="description" placeholder="Ce que l'étape doit produire" />
            </div>
          </div>
          <Button type="submit" className="mt-4" title="Ajouter cette étape à la feuille de route">
            Ajouter
          </Button>
        </form>
      </section>

      <section className="mt-10">
        <h2 className="text-base font-semibold text-foreground">Plan directeur</h2>
        {sections === null ? (
          <p className="mt-3 text-sm text-muted-foreground">Chargement…</p>
        ) : (
          <ul className="mt-4 space-y-4">
            {sections.map((section) => (
              <li key={section.id} className="rounded-xl border border-border bg-card p-5">
                <Label htmlFor={`s-${section.id}`}>{section.title}</Label>
                <Textarea
                  id={`s-${section.id}`}
                  defaultValue={section.content}
                  rows={3}
                  className="mt-2"
                  onBlur={(e) =>
                    e.target.value !== section.content && saveSection(section, e.target.value)
                  }
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-10">
        <h2 className="text-base font-semibold text-foreground">Audits</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Chaque audit reste en mémoire : vous comparez d'un coup d'œil ce qui progresse.
        </p>
        {audits === null ? (
          <p className="mt-3 text-sm text-muted-foreground">Chargement…</p>
        ) : audits.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">Aucun audit enregistré.</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {audits.map((audit) => {
              const own = findings.filter((f) => f.audit_id === audit.id);
              return (
                <li key={audit.id} className="rounded-xl border border-border bg-card p-5">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-foreground">{audit.label}</p>
                    <span className="text-xs text-muted-foreground">
                      {new Date(audit.performed_at).toLocaleDateString("fr-FR")}
                    </span>
                    <span className="ml-auto text-sm font-semibold text-primary-text">
                      {audit.score}/{audit.max_score}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">{audit.summary}</p>
                  {own.length > 0 ? (
                    <ul className="mt-3 space-y-1.5 text-xs text-muted-foreground">
                      {own.map((finding) => (
                        <li key={finding.id}>
                          <span
                            className={finding.severity === "majeur" ? "text-warning-text" : ""}
                          >
                            {finding.code} — {finding.description}
                          </span>{" "}
                          <span className="text-muted-foreground">({finding.location})</span>
                          {finding.resolved ? (
                            <span className="text-success-text"> — corrigé</span>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}

        <form onSubmit={addAudit} className="mt-6 rounded-xl border border-border bg-card p-5">
          <h3 className="text-sm font-semibold text-foreground">Enregistrer un audit</h3>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="a-label">Intitulé</Label>
              <Input id="a-label" name="label" required placeholder="Audit complet du 12 mars" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="a-score">Score</Label>
              <Input id="a-score" name="score" type="number" min={0} defaultValue={0} />
            </div>
            <div className="space-y-1.5 sm:col-span-3">
              <Label htmlFor="a-summary">Résumé</Label>
              <Textarea
                id="a-summary"
                name="summary"
                rows={3}
                placeholder="Ce que l'audit a relevé"
              />
            </div>
            <input type="hidden" name="max_score" value={100} />
          </div>
          <Button type="submit" className="mt-4" title="Enregistrer cet audit dans l'historique">
            Enregistrer l'audit
          </Button>
        </form>
      </section>
    </AdminShell>
  );
}
