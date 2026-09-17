import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { AdminShell } from "@/components/cds/AdminShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/_authenticated/admin/forum")({
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

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("forum_categories")
      .select("id, slug, name, description, color, position")
      .order("position", { ascending: true });
    setCategories(data ?? []);
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
      position: Number(data.get("position") ?? 0),
    });
    setBusy(false);
    if (error) {
      toast.error("Thématique non créée.", { description: "Vérifiez que l'identifiant est unique." });
      return;
    }
    form.reset();
    toast.success("Thématique ajoutée.");
    void load();
  }

  async function save(category: Category, changes: Partial<Category>) {
    const { error } = await supabase.from("forum_categories").update(changes).eq("id", category.id);
    if (error) toast.error("Modification non enregistrée.");
    else {
      toast.success("Thématique mise à jour.");
      void load();
    }
  }

  async function remove(category: Category) {
    const { error } = await supabase.from("forum_categories").delete().eq("id", category.id);
    if (error) toast.error("Suppression impossible.", { description: "Des discussions y sont peut-être rattachées." });
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
            <Input id="c-color" name="color" type="color" defaultValue="#0d6efd" className="h-11 w-24 p-1" />
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
        {categories === null ? (
          <p className="mt-3 text-sm text-muted-foreground">Chargement…</p>
        ) : categories.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">Aucune thématique pour l'instant.</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {categories.map((category) => (
              <li key={category.id} className="rounded-xl border border-border bg-card p-4">
                <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
                  <div className="space-y-1.5">
                    <Label htmlFor={`name-${category.id}`}>Nom</Label>
                    <Input
                      id={`name-${category.id}`}
                      defaultValue={category.name}
                      onBlur={(e) =>
                        e.target.value !== category.name && save(category, { name: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor={`desc-${category.id}`}>Description</Label>
                    <Input
                      id={`desc-${category.id}`}
                      defaultValue={category.description}
                      onBlur={(e) =>
                        e.target.value !== category.description &&
                        save(category, { description: e.target.value })
                      }
                    />
                  </div>
                  <Button
                    variant="destructive"
                    onClick={() => remove(category)}
                    title={`Supprimer la thématique ${category.name}`}
                  >
                    Supprimer
                  </Button>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">Adresse : /forum/categorie/{category.slug}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </AdminShell>
  );
}
