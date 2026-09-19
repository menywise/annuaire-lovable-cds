import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { AdminShell } from "@/components/cds/AdminShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { requireFeature } from "@/config/features";
import { downloadCsv } from "@/lib/csv";
import { slugify } from "@/lib/format";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/_authenticated/admin/annuaire")({
  beforeLoad: () => requireFeature("directory"),
  head: () =>
    seo({
      title: "Administration — Annuaire métier",
      description: "Gérer les fiches, les catégories, les avis et les demandes de revendication.",
      path: "/admin/annuaire",
      noindex: true,
    }),
  component: AdminDirectoryPage,
});

type Listing = {
  id: string;
  name: string;
  slug: string;
  city: string;
  status: string;
  plan: string;
  featured: boolean;
  verified: boolean;
  claimed_by: string | null;
  claim_requested_by: string | null;
  created_at: string;
};

type Category = { id: string; name: string; slug: string; position: number };
type Review = {
  id: string;
  listing_id: string;
  author_name: string;
  rating: number;
  content: string;
  approved: boolean;
};

const TABS = [
  { key: "fiches", label: "Fiches" },
  { key: "categories", label: "Catégories" },
  { key: "avis", label: "Avis" },
  { key: "claims", label: "Revendications" },
] as const;

function AdminDirectoryPage() {
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("fiches");
  const [listings, setListings] = useState<Listing[] | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);

  const load = useCallback(async () => {
    const [l, c, r] = await Promise.all([
      supabase
        .from("directory_listings")
        .select(
          "id, name, slug, city, status, plan, featured, verified, claimed_by, claim_requested_by, created_at",
        )
        .order("created_at", { ascending: false }),
      supabase.from("directory_categories").select("id, name, slug, position").order("position"),
      supabase
        .from("directory_reviews")
        .select("id, listing_id, author_name, rating, content, approved")
        .order("created_at", { ascending: false }),
    ]);
    setListings(l.data ?? []);
    setCategories(c.data ?? []);
    setReviews(r.data ?? []);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function updateListing(id: string, changes: Partial<Listing>) {
    const { error } = await supabase.from("directory_listings").update(changes).eq("id", id);
    if (error) toast.error("Modification non enregistrée.");
    else {
      toast.success("Fiche mise à jour.");
      void load();
    }
  }

  async function approveClaim(item: Listing) {
    if (!item.claim_requested_by) return;
    await updateListing(item.id, {
      claimed_by: item.claim_requested_by,
      claim_requested_by: null,
    } as Partial<Listing>);
  }

  async function addCategory(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const name = String(new FormData(form).get("name") ?? "").trim();
    if (!name) return;
    const { error } = await supabase
      .from("directory_categories")
      .insert({ name, slug: slugify(name), position: categories.length });
    if (error) toast.error("Catégorie non créée.");
    else {
      toast.success("Catégorie créée.");
      form.reset();
      void load();
    }
  }

  const pendingClaims = (listings ?? []).filter((item) => item.claim_requested_by);

  return (
    <AdminShell
      title="Annuaire métier"
      intro="Les fiches professionnelles, leurs catégories, les avis reçus et les demandes de revendication."
    >
      <div className="flex flex-wrap gap-2">
        {TABS.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setTab(item.key)}
            title={`Afficher : ${item.label}`}
            className={`min-h-11 rounded-md border px-3 text-sm ${
              tab === item.key
                ? "border-primary bg-accent text-foreground"
                : "border-border text-muted-foreground"
            }`}
          >
            {item.label}
          </button>
        ))}
        <Button
          variant="outline"
          className="ml-auto"
          title="Télécharger les fiches au format tableur"
          onClick={() => downloadCsv("annuaire.csv", listings ?? [])}
        >
          Export CSV
        </Button>
      </div>

      {listings === null ? (
        <p className="mt-6 text-sm text-muted-foreground">Chargement…</p>
      ) : tab === "fiches" ? (
        <ul className="mt-6 space-y-3">
          {listings.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucune fiche pour l'instant.</p>
          ) : null}
          {listings.map((item) => (
            <li key={item.id} className="rounded-xl border border-border bg-card p-5">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-semibold text-foreground">{item.name}</p>
                <p className="text-xs text-muted-foreground">{item.city}</p>
                <span className="ml-auto rounded-full bg-muted px-2.5 py-0.5 text-xs text-muted-foreground">
                  {item.status === "published"
                    ? "En ligne"
                    : item.status === "draft"
                      ? "Brouillon"
                      : "Archivée"}
                </span>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button
                  variant={item.status === "published" ? "outline" : "default"}
                  title={
                    item.status === "published"
                      ? "Retirer cette fiche du site"
                      : "Publier cette fiche"
                  }
                  onClick={() =>
                    updateListing(item.id, {
                      status: item.status === "published" ? "draft" : "published",
                    })
                  }
                >
                  {item.status === "published" ? "Dépublier" : "Publier"}
                </Button>
                <Button
                  variant="outline"
                  title={
                    item.plan === "premium"
                      ? "Repasser en fiche gratuite"
                      : "Passer cette fiche en premium"
                  }
                  onClick={() =>
                    updateListing(item.id, { plan: item.plan === "premium" ? "free" : "premium" })
                  }
                >
                  {item.plan === "premium" ? "Retirer le premium" : "Passer en premium"}
                </Button>
                <Button
                  variant="outline"
                  title={
                    item.verified
                      ? "Retirer le badge vérifié"
                      : "Marquer cette fiche comme vérifiée"
                  }
                  onClick={() => updateListing(item.id, { verified: !item.verified })}
                >
                  {item.verified ? "Retirer « vérifié »" : "Marquer vérifié"}
                </Button>
                <Button
                  variant="outline"
                  title={
                    item.featured ? "Retirer de la mise en avant" : "Mettre en avant cette fiche"
                  }
                  onClick={() => updateListing(item.id, { featured: !item.featured })}
                >
                  {item.featured ? "Ne plus mettre en avant" : "Mettre en avant"}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      ) : tab === "categories" ? (
        <div className="mt-6 space-y-4">
          <form
            onSubmit={addCategory}
            className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card p-5"
          >
            <div className="flex-1">
              <Label htmlFor="cat-name">Nom de la catégorie</Label>
              <Input id="cat-name" name="name" required placeholder="Plombiers" className="mt-1" />
            </div>
            <Button type="submit" title="Créer cette catégorie">
              Ajouter
            </Button>
          </form>
          <ul className="space-y-2">
            {categories.map((item) => (
              <li
                key={item.id}
                className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3 text-sm"
              >
                <span className="text-foreground">{item.name}</span>
                <span className="text-xs text-muted-foreground">/{item.slug}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : tab === "avis" ? (
        <ul className="mt-6 space-y-3">
          {reviews.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucun avis reçu.</p>
          ) : null}
          {reviews.map((item) => (
            <li key={item.id} className="rounded-xl border border-border bg-card p-5">
              <p className="text-sm font-semibold text-foreground">
                {item.author_name} — {item.rating}/5
              </p>
              <p className="mt-2 text-sm text-muted-foreground">{item.content}</p>
              <div className="mt-3 flex gap-2">
                <Button
                  variant={item.approved ? "outline" : "default"}
                  title={item.approved ? "Retirer cet avis du site" : "Publier cet avis"}
                  onClick={async () => {
                    await supabase
                      .from("directory_reviews")
                      .update({ approved: !item.approved })
                      .eq("id", item.id);
                    void load();
                  }}
                >
                  {item.approved ? "Dépublier" : "Publier"}
                </Button>
                <Button
                  variant="destructive"
                  title="Supprimer cet avis"
                  onClick={async () => {
                    await supabase.from("directory_reviews").delete().eq("id", item.id);
                    void load();
                  }}
                >
                  Supprimer
                </Button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <ul className="mt-6 space-y-3">
          {pendingClaims.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Aucune demande de revendication en attente.
            </p>
          ) : null}
          {pendingClaims.map((item) => (
            <li key={item.id} className="rounded-xl border border-border bg-card p-5">
              <p className="text-sm font-semibold text-foreground">{item.name}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Un membre demande à gérer cette fiche.
              </p>
              <div className="mt-3 flex gap-2">
                <Button title="Confier la fiche à ce membre" onClick={() => approveClaim(item)}>
                  Accepter
                </Button>
                <Button
                  variant="outline"
                  title="Refuser cette demande"
                  onClick={() =>
                    updateListing(item.id, { claim_requested_by: null } as Partial<Listing>)
                  }
                >
                  Refuser
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </AdminShell>
  );
}
