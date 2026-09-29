import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { ConfirmButton } from "@/components/cds/ConfirmButton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { slugify } from "@/lib/format";
import { moveRow } from "@/lib/reorder";

/**
 * Catégories d'une brique (annuaire, annonces) : créer, renommer, décrire, ordonner, supprimer.
 * Supprimer une catégorie laisse ses fiches en place, sans catégorie (clé étrangère ON DELETE SET NULL).
 */

type Category = { id: string; name: string; slug: string; position: number; description?: string };

export function CategoryManager({
  table,
  withDescription = false,
  placeholder,
  usage,
}: {
  table: "directory_categories" | "marketplace_categories";
  withDescription?: boolean;
  placeholder: string;
  /** Nom des éléments rattachés, pour le message de suppression (« fiches », « annonces »). */
  usage: string;
}) {
  const [items, setItems] = useState<Category[] | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from(table)
      .select(
        withDescription ? "id, name, slug, position, description" : "id, name, slug, position",
      )
      .order("position");
    setFailed(Boolean(error));
    if (!error) setItems((data ?? []) as unknown as Category[]);
  }, [table, withDescription]);

  useEffect(() => {
    void load();
  }, [load]);

  async function create(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const name = String(new FormData(form).get("name") ?? "").trim();
    if (!name) return;
    const { error } = await supabase
      .from(table)
      .insert({ name, slug: slugify(name), position: items?.length ?? 0 } as never);
    if (error)
      toast.error("Catégorie non créée.", { description: "Ce nom existe peut-être déjà." });
    else {
      toast.success("Catégorie créée.");
      form.reset();
      void load();
    }
  }

  async function save(item: Category, changes: Partial<Category>) {
    const { error } = await supabase
      .from(table)
      .update(changes as never)
      .eq("id", item.id);
    if (error)
      toast.error("Catégorie non modifiée.", {
        description: "Cette adresse existe peut-être déjà.",
      });
    else {
      toast.success("Catégorie modifiée.");
      void load();
    }
  }

  async function remove(item: Category) {
    const { error } = await supabase.from(table).delete().eq("id", item.id);
    if (error) toast.error("Catégorie non supprimée.");
    else {
      toast.success("Catégorie supprimée.");
      void load();
    }
  }

  async function move(index: number, delta: number) {
    if (!items) return;
    if (!(await moveRow(table, items, index, delta))) toast.error("Ordre non enregistré.");
    void load();
  }

  return (
    <div className="space-y-4">
      <form
        onSubmit={create}
        className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card p-5"
      >
        <div className="min-w-[200px] flex-1 space-y-1.5">
          <Label htmlFor={`${table}-new`}>Nouvelle catégorie</Label>
          <Input id={`${table}-new`} name="name" required placeholder={placeholder} />
        </div>
        <Button type="submit" title="Créer cette catégorie">
          Ajouter
        </Button>
      </form>

      {failed ? (
        <p role="alert" className="text-sm text-destructive">
          Catégories indisponibles.{" "}
          <button type="button" className="underline" onClick={() => void load()}>
            Réessayer
          </button>
        </p>
      ) : items === null ? (
        <p className="text-sm text-muted-foreground">Chargement…</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aucune catégorie pour l'instant.</p>
      ) : (
        <ul className="space-y-2">
          {items.map((item, index) => (
            <CategoryRow
              key={`${item.id}-${item.name}-${item.slug}-${item.description ?? ""}`}
              item={item}
              withDescription={withDescription}
              first={index === 0}
              last={index === items.length - 1}
              usage={usage}
              onSave={(changes) => void save(item, changes)}
              onMove={(delta) => void move(index, delta)}
              onRemove={() => remove(item)}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function CategoryRow({
  item,
  withDescription,
  first,
  last,
  usage,
  onSave,
  onMove,
  onRemove,
}: {
  item: Category;
  withDescription: boolean;
  first: boolean;
  last: boolean;
  usage: string;
  onSave: (changes: Partial<Category>) => void;
  onMove: (delta: number) => void;
  onRemove: () => Promise<void>;
}) {
  const [name, setName] = useState(item.name);
  const [slug, setSlug] = useState(item.slug);
  const [description, setDescription] = useState(item.description ?? "");
  const dirty =
    name !== item.name || slug !== item.slug || description !== (item.description ?? "");
  const id = (f: string) => `cat-${f}-${item.id}`;

  return (
    <li className="rounded-xl border border-border bg-card p-4">
      <form
        className="grid gap-3 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          const cleanSlug = slugify(slug || name);
          if (!name.trim() || !cleanSlug) {
            toast.error("Nom obligatoire.");
            return;
          }
          onSave({
            name: name.trim(),
            slug: cleanSlug,
            ...(withDescription ? { description: description.trim() } : {}),
          });
        }}
      >
        <div className="space-y-1.5">
          <Label htmlFor={id("name")}>Nom</Label>
          <Input id={id("name")} value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={id("slug")}>Adresse</Label>
          <Input id={id("slug")} value={slug} onChange={(e) => setSlug(e.target.value)} />
          {slugify(slug) !== item.slug ? (
            <p className="text-xs text-destructive">
              Changer l'adresse casse les liens déjà partagés.
            </p>
          ) : null}
        </div>
        {withDescription ? (
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor={id("desc")}>Description</Label>
            <Input
              id={id("desc")}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
        ) : null}
        <div className="flex flex-wrap items-center gap-2 sm:col-span-2">
          <span className="text-xs text-muted-foreground">Rang {item.position + 1}</span>
          <div className="ml-auto flex flex-wrap gap-2">
            <Button type="submit" size="sm" disabled={!dirty}>
              Enregistrer
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={first}
              onClick={() => onMove(-1)}
              aria-label={`Monter la catégorie ${item.name}`}
            >
              ↑
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={last}
              onClick={() => onMove(1)}
              aria-label={`Descendre la catégorie ${item.name}`}
            >
              ↓
            </Button>
            <ConfirmButton
              title={`Supprimer la catégorie ${item.name}`}
              question={`Supprimer la catégorie « ${item.name} » ?`}
              detail={`Les ${usage} de cette catégorie restent en ligne, sans catégorie.`}
              onConfirm={onRemove}
            />
          </div>
        </div>
      </form>
    </li>
  );
}
