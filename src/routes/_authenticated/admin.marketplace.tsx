import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { AdminShell } from "@/components/cds/AdminShell";
import { CategoryManager } from "@/components/cds/CategoryManager";
import { ConfirmButton } from "@/components/cds/ConfirmButton";
import { RecordEditor } from "@/components/cds/RecordEditor";
import { ImageListField } from "@/components/cds/MediaPicker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { requireFeature } from "@/config/features";
import { downloadCsv } from "@/lib/csv";
import { formatDate, formatPrice, slugify } from "@/lib/format";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/_authenticated/admin/marketplace")({
  beforeLoad: () => requireFeature("marketplace"),
  head: () =>
    seo({
      title: "Administration — Annonces",
      description: "Modérer les annonces publiées par les membres et gérer les catégories.",
      path: "/admin/marketplace",
      noindex: true,
    }),
  component: AdminMarketplacePage,
});

type Listing = {
  id: string;
  title: string;
  slug: string;
  seller_name: string;
  price_cents: number;
  status: string;
  approved: boolean;
  views: number;
  created_at: string;
  photos: string[];
  description: string;
  category_id: string | null;
  tags: string[];
  negotiable: boolean;
  city: string;
  departement: string | null;
};

type Category = { id: string; name: string; slug: string; position: number };

function AdminMarketplacePage() {
  const [listings, setListings] = useState<Listing[] | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [openPhotos, setOpenPhotos] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    const [l, c] = await Promise.all([
      supabase
        .from("marketplace_listings")
        .select(
          "id, title, slug, seller_name, price_cents, status, approved, views, created_at, photos, description, category_id, tags, negotiable, city, departement",
        )
        .order("created_at", { ascending: false }),
      supabase.from("marketplace_categories").select("id, name, slug, position").order("position"),
    ]);
    setFailed(Boolean(l.error || c.error));
    if (l.error) return;
    setListings(l.data ?? []);
    setCategories(c.data ?? []);
  }, []);

  async function update(id: string, changes: Record<string, unknown>, message: string) {
    const { error } = await supabase
      .from("marketplace_listings")
      .update(changes as never)
      .eq("id", id);
    if (error) {
      toast.error("Modification non enregistrée.", {
        description: error.code === "23505" ? "Cette adresse est déjà prise." : undefined,
      });
      return false;
    }
    toast.success(message);
    void load();
    return true;
  }

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <AdminShell
      title="Annonces"
      intro="Chaque annonce passe sous vos yeux avant d'être visible. Vous pouvez la corriger, l'archiver ou la supprimer, et gérer les catégories."
    >
      <details className="rounded-xl border border-border bg-card p-4">
        <summary className="min-h-11 cursor-pointer text-sm font-semibold text-foreground">
          Catégories ({categories.length})
        </summary>
        <div className="mt-4">
          <CategoryManager table="marketplace_categories" placeholder="Matériel" usage="annonces" />
        </div>
      </details>

      {failed ? (
        <p role="alert" className="mt-6 rounded-lg border border-destructive/40 p-4 text-sm text-destructive">
          Les annonces n'ont pas pu être chargées.{" "}
          <button type="button" className="underline" onClick={() => void load()}>
            Réessayer
          </button>
        </p>
      ) : null}
      {listings === null ? (
        <p className="mt-6 text-sm text-muted-foreground">Chargement…</p>
      ) : (
        <>
          <div className="mt-6 flex items-center gap-3">
            <p className="text-sm text-muted-foreground">{listings.length} annonces</p>
            <Button
              variant="outline"
              className="ml-auto"
              title="Télécharger les annonces au format tableur"
              onClick={() => downloadCsv("annonces.csv", listings)}
            >
              Export CSV
            </Button>
          </div>
          <ul className="mt-3 space-y-3">
            {listings.map((item) => (
              <li key={item.id} className="rounded-xl border border-border bg-card p-5">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold text-foreground">{item.title}</p>
                  <span className="text-xs text-muted-foreground">
                    {item.seller_name} · {formatPrice(item.price_cents)} · {item.views} vues ·{" "}
                    {formatDate(item.created_at)}
                  </span>
                  <span className="ml-auto rounded-full bg-muted px-2.5 py-0.5 text-xs text-muted-foreground">
                    {item.approved ? "Validée" : "En attente"}
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    variant={item.approved ? "outline" : "default"}
                    title={item.approved ? "Retirer cette annonce du site" : "Valider cette annonce"}
                    onClick={() =>
                      void update(
                        item.id,
                        { approved: !item.approved },
                        item.approved ? "Annonce retirée du site." : "Annonce validée.",
                      )
                    }
                  >
                    {item.approved ? "Retirer" : "Valider"}
                  </Button>
                  <Button
                    variant="outline"
                    title="Archiver cette annonce"
                    onClick={() =>
                      void update(
                        item.id,
                        { status: item.status === "archived" ? "active" : "archived" },
                        item.status === "archived" ? "Annonce réactivée." : "Annonce archivée.",
                      )
                    }
                  >
                    {item.status === "archived" ? "Réactiver" : "Archiver"}
                  </Button>
                  <Button
                    variant="outline"
                    title="Modifier le contenu de cette annonce"
                    onClick={() => setEditing(editing === item.id ? null : item.id)}
                  >
                    {editing === item.id ? "Fermer" : "Modifier"}
                  </Button>
                  <Button
                    variant="outline"
                    title="Modifier les photos de cette annonce"
                    onClick={() => setOpenPhotos(openPhotos === item.id ? null : item.id)}
                  >
                    {openPhotos === item.id ? "Masquer les photos" : "Photos"}
                  </Button>
                  <ConfirmButton
                    size="default"
                    title="Supprimer définitivement cette annonce"
                    question={`Supprimer l'annonce « ${item.title} » ?`}
                    onConfirm={async () => {
                      const { error } = await supabase.from("marketplace_listings").delete().eq("id", item.id);
                      if (error) toast.error("Annonce non supprimée.");
                      else {
                        toast.success("Annonce supprimée.");
                        void load();
                      }
                    }}
                  />
                </div>
                {editing === item.id ? (
                  <div className="mt-4 border-t border-border pt-4">
                    <RecordEditor
                      idPrefix={`mk-${item.id}`}
                      fields={[
                        { key: "title", label: "Titre", type: "text", required: true },
                        { key: "slug", label: "Adresse (/marketplace/…)", type: "text", required: true },
                        {
                          key: "category_id",
                          label: "Catégorie",
                          type: "select",
                          nullable: true,
                          options: categories.map((c) => ({ value: c.id, label: c.name })),
                        },
                        {
                          key: "status",
                          label: "État",
                          type: "select",
                          options: [
                            { value: "draft", label: "Brouillon" },
                            { value: "active", label: "En ligne" },
                            { value: "sold", label: "Vendue" },
                            { value: "archived", label: "Archivée" },
                          ],
                        },
                        { key: "price_cents", label: "Prix", type: "euros" },
                        { key: "negotiable", label: "Prix à débattre", type: "checkbox" },
                        { key: "description", label: "Description", type: "textarea" },
                        { key: "city", label: "Ville", type: "text" },
                        {
                          key: "departement",
                          label: "Département (code)",
                          type: "text",
                          nullable: true,
                        },
                        { key: "tags", label: "Étiquettes", type: "tags" },
                      ]}
                      values={item}
                      onCancel={() => setEditing(null)}
                      onSave={async (changes) => {
                        const ok = await update(
                          item.id,
                          { ...changes, slug: slugify(String(changes["slug"] ?? "")) },
                          "Annonce modifiée.",
                        );
                        if (ok) setEditing(null);
                        return ok;
                      }}
                    />
                  </div>
                ) : null}
                {openPhotos === item.id ? (
                  <ListingPhotos
                    item={item}
                    onSaved={() => {
                      setOpenPhotos(null);
                      void load();
                    }}
                  />
                ) : null}
              </li>
            ))}
          </ul>
        </>
      )}
    </AdminShell>
  );
}

function ListingPhotos({ item, onSaved }: { item: Listing; onSaved: () => void }) {
  const [photos, setPhotos] = useState<string[]>(item.photos ?? []);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    const { error } = await supabase.from("marketplace_listings").update({ photos }).eq("id", item.id);
    if (error) toast.error("Photos non enregistrées.");
    else {
      toast.success("Photos enregistrées.");
      onSaved();
    }
  }

  return (
    <form onSubmit={save} className="mt-4 space-y-3 border-t border-border pt-4">
      <ImageListField id={`mk-photos-${item.id}`} label="Photos" value={photos} onChange={setPhotos} max={5} />
      <Button type="submit" size="sm">
        Enregistrer les photos
      </Button>
    </form>
  );
}
