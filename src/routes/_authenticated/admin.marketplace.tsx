import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { AdminShell } from "@/components/cds/AdminShell";
import { ConfirmButton } from "@/components/cds/ConfirmButton";
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
};

type Category = { id: string; name: string; slug: string; position: number };

function AdminMarketplacePage() {
  const [listings, setListings] = useState<Listing[] | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [openPhotos, setOpenPhotos] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [l, c] = await Promise.all([
      supabase
        .from("marketplace_listings")
        .select("id, title, slug, seller_name, price_cents, status, approved, views, created_at, photos")
        .order("created_at", { ascending: false }),
      supabase.from("marketplace_categories").select("id, name, slug, position").order("position"),
    ]);
    setListings(l.data ?? []);
    setCategories(c.data ?? []);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function addCategory(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const name = String(new FormData(form).get("name") ?? "").trim();
    if (!name) return;
    const { error } = await supabase
      .from("marketplace_categories")
      .insert({ name, slug: slugify(name), position: categories.length });
    if (error) toast.error("Catégorie non créée.");
    else {
      toast.success("Catégorie créée.");
      form.reset();
      void load();
    }
  }

  return (
    <AdminShell
      title="Annonces"
      intro="Chaque annonce passe sous vos yeux avant d'être visible. Vous gardez la main sur les catégories."
    >
      <form onSubmit={addCategory} className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card p-5">
        <div className="flex-1">
          <Label htmlFor="mk-cat">Nouvelle catégorie</Label>
          <Input id="mk-cat" name="name" required placeholder="Matériel" className="mt-1" />
        </div>
        <Button type="submit" title="Créer cette catégorie">
          Ajouter
        </Button>
      </form>

      {categories.length > 0 ? (
        <p className="mt-3 text-xs text-muted-foreground">
          Catégories : {categories.map((item) => item.name).join(", ")}
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
                    onClick={async () => {
                      await supabase
                        .from("marketplace_listings")
                        .update({ approved: !item.approved })
                        .eq("id", item.id);
                      void load();
                    }}
                  >
                    {item.approved ? "Retirer" : "Valider"}
                  </Button>
                  <Button
                    variant="outline"
                    title="Archiver cette annonce"
                    onClick={async () => {
                      await supabase.from("marketplace_listings").update({ status: "archived" }).eq("id", item.id);
                      void load();
                    }}
                  >
                    Archiver
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
