import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { ConfirmButton } from "@/components/cds/ConfirmButton";
import { AdminShell } from "@/components/cds/AdminShell";
import { ImageField } from "@/components/cds/MediaPicker";
import { ModerationNote } from "@/components/cds/ModerationNote";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import type { TablesUpdate } from "@/integrations/supabase/types";
import { moveRow } from "@/lib/reorder";
import { seo } from "@/lib/seo";
import { requireFeature } from "@/config/features";

export const Route = createFileRoute("/_authenticated/admin/temoignages")({
  beforeLoad: () => requireFeature("testimonials"),
  head: () =>
    seo({
      title: "Administration — Témoignages",
      description: "Ajouter, modifier, valider, ordonner ou retirer les témoignages.",
      path: "/admin/temoignages",
      noindex: true,
    }),
  component: AdminTestimonialsPage,
});

type Testimonial = {
  id: string;
  author_id: string | null;
  author_name: string;
  role_title: string;
  company: string;
  avatar_url: string | null;
  content: string;
  outcome: string;
  approved: boolean;
  featured: boolean;
  position: number;
  created_at: string;
  moderation_note: string | null;
};

type Draft = {
  author_name: string;
  role_title: string;
  company: string;
  avatar_url: string;
  content: string;
  outcome: string;
  moderation_note: string;
};

const emptyDraft: Draft = {
  author_name: "",
  role_title: "",
  company: "",
  avatar_url: "",
  content: "",
  outcome: "",
  moderation_note: "",
};

function AdminTestimonialsPage() {
  const [items, setItems] = useState<Testimonial[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from("testimonials")
      .select(
        "id, author_id, author_name, role_title, company, avatar_url, content, outcome, approved, featured, position, created_at, moderation_note",
      )
      .order("position", { ascending: true })
      .order("created_at", { ascending: false });
    setFailed(Boolean(error));
    if (!error) setItems(data ?? []);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function update(
    id: string,
    changes: TablesUpdate<"testimonials">,
    message = "Témoignage mis à jour.",
  ) {
    const { error } = await supabase.from("testimonials").update(changes).eq("id", id);
    if (error) {
      toast.error("Modification non enregistrée.");
      return false;
    }
    toast.success(message);
    void load();
    return true;
  }

  async function remove(id: string) {
    const { error } = await supabase.from("testimonials").delete().eq("id", id);
    if (error) toast.error("Suppression impossible.");
    else {
      toast.success("Témoignage supprimé.");
      void load();
    }
  }

  async function move(index: number, delta: number) {
    if (!items) return;
    if (!(await moveRow("testimonials", items, index, delta))) toast.error("Ordre non enregistré.");
    void load();
  }

  async function create(draft: Draft) {
    const { error } = await supabase.from("testimonials").insert({
      author_name: draft.author_name.trim(),
      role_title: draft.role_title.trim(),
      company: draft.company.trim(),
      avatar_url: draft.avatar_url.trim() || null,
      content: draft.content.trim(),
      outcome: draft.outcome.trim(),
      approved: false,
      position: items?.length ?? 0,
    });
    if (error) {
      toast.error("Témoignage non créé.");
      return false;
    }
    toast.success("Témoignage créé en attente : publiez-le quand il est prêt.");
    setCreating(false);
    void load();
    return true;
  }

  return (
    <AdminShell
      title="Témoignages"
      intro="Rien n'est publié sans votre relecture. Ajoutez un témoignage reçu par e-mail, corrigez, ordonnez, mettez en avant ou écartez."
    >
      <div className="mb-4">
        {creating ? (
          <TestimonialForm
            idPrefix="new"
            initial={emptyDraft}
            submitLabel="Créer le témoignage"
            showNote={false}
            onSubmit={create}
            onCancel={() => setCreating(false)}
          />
        ) : (
          <Button type="button" onClick={() => setCreating(true)}>
            Ajouter un témoignage
          </Button>
        )}
      </div>

      {failed ? (
        <p
          role="alert"
          className="rounded-lg border border-destructive/40 p-4 text-sm text-destructive"
        >
          Témoignages indisponibles.{" "}
          <button type="button" className="underline" onClick={() => void load()}>
            Réessayer
          </button>
        </p>
      ) : items === null ? (
        <div className="space-y-3">
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-28 w-full" />
        </div>
      ) : items.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          Aucun témoignage pour l'instant.
        </p>
      ) : (
        <ul className="space-y-3">
          {items.map((item, index) => (
            <li key={item.id} className="rounded-xl border border-border bg-card p-5">
              {editing === item.id ? (
                <TestimonialForm
                  idPrefix={item.id}
                  initial={{
                    author_name: item.author_name,
                    role_title: item.role_title,
                    company: item.company,
                    avatar_url: item.avatar_url ?? "",
                    content: item.content,
                    outcome: item.outcome,
                    moderation_note: item.moderation_note ?? "",
                  }}
                  submitLabel="Enregistrer"
                  showNote={Boolean(item.author_id)}
                  onSubmit={async (draft) => {
                    const ok = await update(item.id, {
                      author_name: draft.author_name.trim(),
                      role_title: draft.role_title.trim(),
                      company: draft.company.trim(),
                      avatar_url: draft.avatar_url.trim() || null,
                      content: draft.content.trim(),
                      outcome: draft.outcome.trim(),
                      moderation_note: draft.moderation_note.trim() || null,
                    });
                    if (ok) setEditing(null);
                    return ok;
                  }}
                  onCancel={() => setEditing(null)}
                />
              ) : (
                <>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-foreground">{item.author_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {[item.role_title, item.company].filter(Boolean).join(" — ")}
                    </p>
                    <span
                      className={`ml-auto rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        item.approved ? "bg-muted text-success-text" : "bg-muted text-warning-text"
                      }`}
                    >
                      {item.approved ? "Publié" : "En attente"}
                      {item.featured ? " · mis en avant" : ""}
                    </span>
                  </div>
                  <p className="mt-3 text-sm text-muted-foreground">{item.content}</p>
                  {item.outcome ? (
                    <p className="mt-2 text-xs font-medium text-success-text">
                      Résultat : {item.outcome}
                    </p>
                  ) : null}
                  <ModerationNote note={item.moderation_note} />
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button
                      variant={item.approved ? "outline" : "default"}
                      onClick={() =>
                        void update(
                          item.id,
                          { approved: !item.approved },
                          item.approved ? "Témoignage retiré." : "Témoignage publié.",
                        )
                      }
                    >
                      {item.approved ? "Dépublier" : "Publier"}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => void update(item.id, { featured: !item.featured })}
                    >
                      {item.featured ? "Ne plus mettre en avant" : "Mettre en avant"}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setEditing(item.id)}
                      title="Modifier ce témoignage"
                    >
                      Modifier
                    </Button>
                    <Button
                      variant="outline"
                      disabled={index === 0}
                      onClick={() => void move(index, -1)}
                      aria-label={`Monter le témoignage de ${item.author_name}`}
                    >
                      ↑
                    </Button>
                    <Button
                      variant="outline"
                      disabled={index === items.length - 1}
                      onClick={() => void move(index, 1)}
                      aria-label={`Descendre le témoignage de ${item.author_name}`}
                    >
                      ↓
                    </Button>
                    <ConfirmButton
                      size="default"
                      title="Supprimer définitivement ce témoignage"
                      question={`Supprimer le témoignage de ${item.author_name} ?`}
                      onConfirm={() => remove(item.id)}
                    />
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </AdminShell>
  );
}

function TestimonialForm({
  idPrefix,
  initial,
  submitLabel,
  showNote,
  onSubmit,
  onCancel,
}: {
  idPrefix: string;
  initial: Draft;
  submitLabel: string;
  /** Note de modération : seulement pour un témoignage déposé par un membre. */
  showNote: boolean;
  onSubmit: (draft: Draft) => Promise<boolean>;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState(initial);
  const [saving, setSaving] = useState(false);
  const id = (field: string) => `t-${field}-${idPrefix}`;
  const set =
    (field: keyof Draft) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setDraft({ ...draft, [field]: e.target.value });

  return (
    <form
      className="space-y-3 rounded-xl border border-border bg-card p-5"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!draft.author_name.trim() || !draft.content.trim()) {
          toast.error("Nom et témoignage obligatoires.");
          return;
        }
        setSaving(true);
        await onSubmit(draft);
        setSaving(false);
      }}
    >
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor={id("name")}>Nom</Label>
          <Input id={id("name")} value={draft.author_name} onChange={set("author_name")} required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={id("role")}>Fonction</Label>
          <Input id={id("role")} value={draft.role_title} onChange={set("role_title")} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={id("company")}>Entreprise</Label>
          <Input id={id("company")} value={draft.company} onChange={set("company")} />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={id("content")}>Témoignage</Label>
        <Textarea
          id={id("content")}
          rows={4}
          value={draft.content}
          onChange={set("content")}
          required
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={id("outcome")}>Résultat obtenu (facultatif)</Label>
        <Input id={id("outcome")} value={draft.outcome} onChange={set("outcome")} />
      </div>
      <ImageField
        id={id("avatar")}
        label="Photo (facultative)"
        value={draft.avatar_url}
        onChange={(avatar_url) => setDraft({ ...draft, avatar_url })}
      />
      {showNote ? (
        <div className="space-y-1.5">
          <Label htmlFor={id("note")}>
            Note de modération visible (si vous avez corrigé le texte)
          </Label>
          <Input
            id={id("note")}
            maxLength={500}
            value={draft.moderation_note}
            onChange={set("moderation_note")}
            placeholder="Coordonnées retirées."
          />
        </div>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" size="sm" disabled={saving}>
          {saving ? "Enregistrement…" : submitLabel}
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={onCancel}>
          Annuler
        </Button>
      </div>
    </form>
  );
}
