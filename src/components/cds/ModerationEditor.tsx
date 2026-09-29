import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";

/**
 * Modération par l'admin : corriger le texte d'un contenu déposé par un membre et signer
 * une note publique (« Lien retiré »). La base date et signe la note (lot 6).
 */

export type ModeratedTable =
  | "blog_comments"
  | "reviews"
  | "forum_topics"
  | "forum_replies"
  | "directory_reviews"
  | "testimonials";

const QUICK_NOTES = [
  "Lien retiré.",
  "Propos injurieux retirés.",
  "Données personnelles retirées.",
  "Publicité retirée.",
  "Texte raccourci, hors sujet retiré.",
];

export function ModerationEditor({
  table,
  id,
  content,
  note,
  approvable,
  approved,
  onDone,
  onCancel,
}: {
  table: ModeratedTable;
  id: string;
  content: string;
  note: string | null;
  /** Vrai si le contenu a un statut « publié / en attente » (commentaires, avis, témoignages). */
  approvable: boolean;
  approved?: boolean;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [text, setText] = useState(content);
  const [moderation, setModeration] = useState(note ?? "");
  const [publish, setPublish] = useState(approvable ? true : false);
  const [saving, setSaving] = useState(false);
  const changed = text.trim() !== content.trim();

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!text.trim()) {
      toast.error("Le texte ne peut pas être vide.", {
        description: "Pour tout retirer, supprimez le contenu.",
      });
      return;
    }
    if (changed && !moderation.trim()) {
      toast.error("Expliquez la modification.", {
        description: "Le texte a été modifié : une note visible prévient les lecteurs.",
      });
      return;
    }
    setSaving(true);
    const changes: Record<string, unknown> = {
      content: text.trim(),
      moderation_note: moderation.trim() || null,
    };
    if (approvable) changes["approved"] = publish;
    const { error } = await supabase
      .from(table)
      .update(changes as never)
      .eq("id", id);
    setSaving(false);
    if (error) {
      toast.error("Modération non enregistrée.", { description: "Réessayez dans un instant." });
      return;
    }
    toast.success(approvable && publish ? "Contenu modéré et publié." : "Contenu modéré.");
    onDone();
  }

  return (
    <form onSubmit={save} className="mt-3 space-y-3 rounded-lg border border-border bg-muted p-3">
      <div className="space-y-1.5">
        <Label htmlFor={`mod-text-${id}`}>Texte publié</Label>
        <Textarea
          id={`mod-text-${id}`}
          rows={5}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`mod-note-${id}`}>
          Note visible des lecteurs (« Modéré par l'équipe : … »)
        </Label>
        <Input
          id={`mod-note-${id}`}
          value={moderation}
          maxLength={500}
          onChange={(e) => setModeration(e.target.value)}
          placeholder="Lien retiré."
        />
        <div className="flex flex-wrap gap-1.5">
          {QUICK_NOTES.map((quick) => (
            <button
              key={quick}
              type="button"
              onClick={() => setModeration(quick)}
              className="min-h-8 rounded-full border border-border bg-card px-2.5 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              {quick}
            </button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          Laissez vide pour ne rien afficher. Si le membre réécrit son texte, la note disparaît.
        </p>
      </div>
      {approvable ? (
        <label className="flex min-h-11 items-center gap-2 text-sm text-foreground">
          <input
            type="checkbox"
            checked={publish}
            onChange={(e) => setPublish(e.target.checked)}
            className="h-4 w-4"
          />
          {approved ? "Garder publié" : "Publier après modération"}
        </label>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" size="sm" disabled={saving}>
          {saving ? "Enregistrement…" : "Enregistrer la modération"}
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={onCancel}>
          Annuler
        </Button>
      </div>
    </form>
  );
}

/**
 * Bouton « Modérer » + éditeur, à placer dans une rangée d'actions `flex flex-wrap` :
 * l'éditeur passe à la ligne sur toute la largeur.
 */
export function ModerationControl({
  table,
  item,
  approvable,
  onDone,
}: {
  table: ModeratedTable;
  item: { id: string; content: string; moderation_note: string | null; approved?: boolean };
  approvable: boolean;
  onDone: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={() => setOpen(!open)}
        title="Corriger le texte et laisser une note visible"
      >
        Modérer
      </Button>
      {open ? (
        <div className="basis-full">
          <ModerationEditor
            table={table}
            id={item.id}
            content={item.content}
            note={item.moderation_note}
            approvable={approvable}
            {...(item.approved !== undefined ? { approved: item.approved } : {})}
            onCancel={() => setOpen(false)}
            onDone={() => {
              setOpen(false);
              onDone();
            }}
          />
        </div>
      ) : null}
    </>
  );
}
