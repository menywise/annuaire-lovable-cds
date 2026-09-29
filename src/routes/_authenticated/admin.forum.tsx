import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { ConfirmButton } from "@/components/cds/ConfirmButton";
import { AdminShell } from "@/components/cds/AdminShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { moveRow } from "@/lib/reorder";
import { seo } from "@/lib/seo";
import { requireFeature } from "@/config/features";

export const Route = createFileRoute("/_authenticated/admin/forum")({
  beforeLoad: () => requireFeature("forum"),
  head: () =>
    seo({
      title: "Administration — Forum",
      description: "Gérer les thématiques du forum depuis le back-office.",
      path: "/admin/forum",
      noindex: true,
    }),
  component: AdminForumPage,
});

type Category = {
  id: string;
  slug: string;
  name: string;
  description: string;
  color: string;
  position: number;
};

function AdminForumPage() {
  const [categories, setCategories] = useState<Category[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from("forum_categories")
      .select("id, slug, name, description, color, position")
      .order("position", { ascending: true });
    setFailed(Boolean(error));
    if (!error) setCategories(data ?? []);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function create(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    setBusy(true);
    const { error } = await supabase.from("forum_categories").insert({
      name: String(data.get("name") ?? "").trim(),
      slug: String(data.get("slug") ?? "")
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, ""),
      description: String(data.get("description") ?? "").trim(),
      color: String(data.get("color") ?? "#0d6efd"),
      position: Number(data.get("position") ?? categories?.length ?? 0),
    });
    setBusy(false);
    if (error) {
      toast.error("Thématique non créée.", {
        description: "Vérifiez que l'identifiant est unique.",
      });
      return;
    }
    form.reset();
    toast.success("Thématique ajoutée.");
    void load();
  }

  async function save(category: Category, changes: Partial<Category>) {
    const { error } = await supabase.from("forum_categories").update(changes).eq("id", category.id);
    if (error) {
      toast.error("Modification non enregistrée.");
      return false;
    }
    toast.success("Thématique mise à jour.");
    void load();
    return true;
  }

  async function move(index: number, delta: number) {
    if (!categories) return;
    if (!(await moveRow("forum_categories", categories, index, delta))) toast.error("Ordre non enregistré.");
    void load();
  }

  async function remove(category: Category) {
    const { error } = await supabase.from("forum_categories").delete().eq("id", category.id);
    if (error)
      toast.error("Suppression impossible.", {
        description: "Des discussions y sont peut-être rattachées.",
      });
    else {
      toast.success("Thématique supprimée.");
      void load();
    }
  }

  return (
    <AdminShell
      title="Forum"
      intro="Les thématiques structurent le forum et aident chaque membre à trouver la bonne discussion."
    >
      <form onSubmit={create} className="rounded-xl border border-border bg-card p-5">
        <h2 className="text-base font-semibold text-foreground">Ajouter une thématique</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="c-name">Nom</Label>
            <Input id="c-name" name="name" required placeholder="Visibilité" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="c-slug">Identifiant d'adresse</Label>
            <Input id="c-slug" name="slug" required placeholder="visibilite" />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="c-desc">Description</Label>
            <Input id="c-desc" name="description" placeholder="À quoi sert cette thématique" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="c-color">Couleur</Label>
            <Input
              id="c-color"
              name="color"
              type="color"
              defaultValue="#0d6efd"
              className="h-11 w-24 p-1"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="c-position">Ordre d'affichage</Label>
            <Input id="c-position" name="position" type="number" defaultValue={0} />
          </div>
        </div>
        <Button type="submit" className="mt-4" disabled={busy} title="Ajouter cette thématique">
          {busy ? "Ajout…" : "Ajouter"}
        </Button>
      </form>

      <section className="mt-8">
        <h2 className="text-base font-semibold text-foreground">Thématiques existantes</h2>
        {failed ? (
          <p role="alert" className="mt-3 text-sm text-destructive">
            Thématiques indisponibles.{" "}
            <button type="button" className="underline" onClick={() => void load()}>
              Réessayer
            </button>
          </p>
        ) : categories === null ? (
          <p className="mt-3 text-sm text-muted-foreground">Chargement…</p>
        ) : categories.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">Aucune thématique pour l'instant.</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {categories.map((category, index) => (
              <CategoryRow
                key={`${category.id}-${category.name}-${category.description}-${category.color}`}
                category={category}
                first={index === 0}
                last={index === categories.length - 1}
                onSave={(changes) => save(category, changes)}
                onMove={(delta) => void move(index, delta)}
                onRemove={() => remove(category)}
              />
            ))}
          </ul>
        )}
      </section>
    </AdminShell>
  );
}

function CategoryRow({
  category,
  first,
  last,
  onSave,
  onMove,
  onRemove,
}: {
  category: Category;
  first: boolean;
  last: boolean;
  onSave: (changes: Partial<Category>) => Promise<boolean>;
  onMove: (delta: number) => void;
  onRemove: () => Promise<void>;
}) {
  const [name, setName] = useState(category.name);
  const [description, setDescription] = useState(category.description);
  const [color, setColor] = useState(category.color);
  const dirty = name !== category.name || description !== category.description || color !== category.color;
  const id = (field: string) => `${field}-${category.id}`;

  return (
    <li className="rounded-xl border border-border bg-card p-4">
      <form
        className="grid gap-3 sm:grid-cols-[1fr_2fr_auto] sm:items-end"
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim()) {
            toast.error("Le nom est obligatoire.");
            return;
          }
          void onSave({ name: name.trim(), description: description.trim(), color });
        }}
      >
        <div className="space-y-1.5">
          <Label htmlFor={id("name")}>Nom</Label>
          <Input id={id("name")} value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={id("desc")}>Description</Label>
          <Input id={id("desc")} value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={id("color")}>Couleur</Label>
          <Input
            id={id("color")}
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="h-10 w-16 p-1"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:col-span-3">
          <span
            className="inline-block size-3 rounded-full"
            style={{ backgroundColor: color }}
            aria-hidden="true"
          />
          <span className="text-xs text-muted-foreground">
            Rang {category.position + 1} · /forum/categorie/{category.slug}
          </span>
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
              aria-label={`Monter la thématique ${category.name}`}
            >
              ↑
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={last}
              onClick={() => onMove(1)}
              aria-label={`Descendre la thématique ${category.name}`}
            >
              ↓
            </Button>
            <ConfirmButton
              title={`Supprimer la thématique ${category.name}`}
              question={`Supprimer la thématique « ${category.name} » ?`}
              detail="Les discussions de cette thématique restent en ligne, sans thématique."
              onConfirm={onRemove}
            />
          </div>
        </div>
      </form>
    </li>
  );
}
