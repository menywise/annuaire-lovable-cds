import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { CrmShell, CRM_INTERACTION_TYPES, CRM_STAGES } from "@/components/cds/CrmShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { requireFeature } from "@/config/features";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { seo } from "@/lib/seo";
import { formatDate } from "@/lib/format";

type Prospect = {
  id: string;
  name: string;
  company: string;
  email: string;
  phone: string;
  source: string;
  sector: string;
  stage: string;
  notes: string;
  active: boolean;
};

type Interaction = { id: string; type: string; content: string; created_at: string };
type Action = { id: string; title: string; due_date: string | null; done: boolean };

export const Route = createFileRoute("/_authenticated/crm/prospect/$prospectId")({
  beforeLoad: () => requireFeature("crm"),
  head: () =>
    seo({
      title: "Fiche contact",
      description: "Historique des échanges et actions prévues pour ce contact.",
      path: "/crm/prospects",
      noindex: true,
    }),
  component: ProspectPage,
});

function ProspectPage() {
  const { prospectId } = Route.useParams();
  const { user } = useAuth();
  const [prospect, setProspect] = useState<Prospect | null | undefined>(undefined);
  const [interactions, setInteractions] = useState<Interaction[]>([]);
  const [actions, setActions] = useState<Action[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    void (async () => {
      const [{ data: row }, { data: history }, { data: todo }] = await Promise.all([
        supabase
          .from("crm_prospects")
          .select("id, name, company, email, phone, source, sector, stage, notes, active")
          .eq("id", prospectId)
          .maybeSingle(),
        supabase
          .from("crm_interactions")
          .select("id, type, content, created_at")
          .eq("prospect_id", prospectId)
          .order("created_at", { ascending: false }),
        supabase
          .from("crm_actions")
          .select("id, title, due_date, done")
          .eq("prospect_id", prospectId)
          .order("due_date", { ascending: true }),
      ]);
      if (cancelled) return;
      setProspect((row as Prospect) ?? null);
      setInteractions((history ?? []) as Interaction[]);
      setActions((todo ?? []) as Action[]);
    })();
    return () => {
      cancelled = true;
    };
  }, [user, prospectId]);

  async function saveProspect(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!prospect) return;
    const data = new FormData(e.currentTarget);
    setBusy(true);
    const patch = {
      name: String(data.get("name") ?? "").trim(),
      company: String(data.get("company") ?? "").trim(),
      email: String(data.get("email") ?? "").trim(),
      phone: String(data.get("phone") ?? "").trim(),
      sector: String(data.get("sector") ?? "").trim(),
      source: String(data.get("source") ?? "").trim(),
      stage: String(data.get("stage") ?? prospect.stage),
      notes: String(data.get("notes") ?? "").trim(),
    };
    const { error } = await supabase.from("crm_prospects").update(patch).eq("id", prospect.id);
    setBusy(false);
    if (error) {
      toast.error("Modification non enregistrée.");
      return;
    }
    setProspect({ ...prospect, ...patch });
    toast.success("Fiche mise à jour.");
  }

  async function addInteraction(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!user || !prospect) return;
    const form = e.currentTarget;
    const data = new FormData(form);
    const content = String(data.get("content") ?? "").trim();
    if (!content) return;
    setBusy(true);
    const { data: created, error } = await supabase
      .from("crm_interactions")
      .insert({
        owner_id: user.id,
        prospect_id: prospect.id,
        type: String(data.get("type") ?? "note"),
        content,
      })
      .select("id, type, content, created_at")
      .maybeSingle();
    setBusy(false);
    if (error || !created) {
      toast.error("Échange non enregistré.");
      return;
    }
    form.reset();
    setInteractions((prev) => [created as Interaction, ...prev]);
    toast.success("Échange enregistré.");
  }

  if (prospect === undefined) {
    return (
      <CrmShell title="Fiche contact" intro="Chargement de la fiche…">
        <Skeleton className="h-60 w-full" />
      </CrmShell>
    );
  }

  if (prospect === null) {
    return (
      <CrmShell
        title="Fiche introuvable"
        intro="Ce contact n'existe pas ou ne vous appartient pas."
      >
        <Link
          to="/crm/prospects"
          title="Revenir à la liste des contacts"
          className="text-sm text-primary-text hover:underline"
        >
          Revenir à la liste
        </Link>
      </CrmShell>
    );
  }

  return (
    <CrmShell
      title={prospect.name}
      intro="Tout ce que vous savez de cette personne, au même endroit."
    >
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div>
          <form
            onSubmit={saveProspect}
            className="grid gap-3 rounded-xl border border-border bg-card p-5 sm:grid-cols-2"
          >
            <div className="space-y-1.5">
              <Label htmlFor="e-name">Nom</Label>
              <Input id="e-name" name="name" defaultValue={prospect.name} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="e-company">Structure</Label>
              <Input id="e-company" name="company" defaultValue={prospect.company} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="e-email">E-mail</Label>
              <Input id="e-email" name="email" type="email" defaultValue={prospect.email} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="e-phone">Téléphone</Label>
              <Input id="e-phone" name="phone" defaultValue={prospect.phone} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="e-sector">Secteur</Label>
              <Input id="e-sector" name="sector" defaultValue={prospect.sector} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="e-source">Origine</Label>
              <Input id="e-source" name="source" defaultValue={prospect.source} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="e-stage">Étape</Label>
              <select
                id="e-stage"
                name="stage"
                defaultValue={prospect.stage}
                className="h-11 w-full rounded-md border border-border bg-card px-3 text-sm text-foreground"
              >
                {CRM_STAGES.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="e-notes">Notes</Label>
              <Textarea id="e-notes" name="notes" rows={4} defaultValue={prospect.notes} />
            </div>
            <div className="sm:col-span-2">
              <Button type="submit" disabled={busy} title="Enregistrer les modifications">
                {busy ? "Enregistrement…" : "Enregistrer"}
              </Button>
            </div>
          </form>

          <section className="mt-8">
            <h2 className="text-base font-semibold text-foreground">Historique des échanges</h2>
            <form
              onSubmit={addInteraction}
              className="mt-3 space-y-3 rounded-xl border border-border bg-card p-5"
            >
              <div className="space-y-1.5">
                <Label htmlFor="i-type">Type</Label>
                <select
                  id="i-type"
                  name="type"
                  className="h-11 w-full rounded-md border border-border bg-card px-3 text-sm text-foreground"
                >
                  {CRM_INTERACTION_TYPES.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="i-content">Ce qui s'est dit</Label>
                <Textarea id="i-content" name="content" rows={3} required />
              </div>
              <Button type="submit" disabled={busy} title="Enregistrer cet échange">
                {busy ? "Enregistrement…" : "Enregistrer l'échange"}
              </Button>
            </form>

            {interactions.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">Aucun échange enregistré.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {interactions.map((item) => (
                  <li key={item.id} className="rounded-lg border border-border bg-card p-4">
                    <p className="text-xs text-muted-foreground">
                      {CRM_INTERACTION_TYPES.find((type) => type.value === item.type)?.label ??
                        item.type}{" "}
                      · {formatDate(item.created_at)}
                    </p>
                    <p className="mt-1 whitespace-pre-line text-sm text-foreground">
                      {item.content}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <aside>
          <div className="rounded-xl border border-border bg-card p-5">
            <h2 className="text-sm font-semibold text-foreground">Actions liées</h2>
            {actions.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">Aucune action prévue.</p>
            ) : (
              <ul className="mt-3 space-y-2 text-sm">
                {actions.map((action) => (
                  <li key={action.id} className="flex items-center justify-between gap-2">
                    <span
                      className={
                        action.done ? "text-muted-foreground line-through" : "text-foreground"
                      }
                    >
                      {action.title}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {formatDate(action.due_date)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <Link
              to="/crm/actions"
              title="Gérer toutes les actions"
              className="mt-3 inline-flex min-h-11 items-center text-sm text-primary-text hover:underline"
            >
              Gérer les actions
            </Link>
          </div>
        </aside>
      </div>
    </CrmShell>
  );
}
