import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { AdminShell } from "@/components/cds/AdminShell";
import { CategoryManager } from "@/components/cds/CategoryManager";
import { ConfirmButton } from "@/components/cds/ConfirmButton";
import { RecordEditor } from "@/components/cds/RecordEditor";
import { ModerationControl } from "@/components/cds/ModerationEditor";
import { ModerationNote } from "@/components/cds/ModerationNote";
import { ImageField, ImageListField } from "@/components/cds/MediaPicker";
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
  logo_url: string | null;
  cover_url: string | null;
  photos: string[];
  description: string;
  excerpt: string;
  category_id: string | null;
  tags: string[];
  address: string;
  postal_code: string;
  departement: string | null;
  phone: string;
  email: string;
  website: string;
};

type Category = { id: string; name: string; slug: string; position: number };
type Review = {
  id: string;
  listing_id: string;
  author_name: string;
  rating: number;
  content: string;
  approved: boolean;
  moderation_note: string | null;
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
  const [openImages, setOpenImages] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    const [l, c, r] = await Promise.all([
      supabase
        .from("directory_listings")
        .select(
          "id, name, slug, city, status, plan, featured, verified, claimed_by, claim_requested_by, created_at, logo_url, cover_url, photos, description, excerpt, category_id, tags, address, postal_code, departement, phone, email, website",
        )
        .order("created_at", { ascending: false }),
      supabase.from("directory_categories").select("id, name, slug, position").order("position"),
      supabase
        .from("directory_reviews")
        .select("id, listing_id, author_name, rating, content, approved, moderation_note")
        .order("created_at", { ascending: false }),
    ]);
    setFailed(Boolean(l.error || c.error || r.error));
    if (l.error) return;
    setListings(l.data ?? []);
    setCategories(c.data ?? []);
    setReviews(r.data ?? []);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function updateListing(id: string, changes: Partial<Listing>) {
    const { error } = await supabase.from("directory_listings").update(changes).eq("id", id);
    if (error) {
      toast.error("Modification non enregistrée.", {
        description: error.code === "23505" ? "Cette adresse est déjà prise." : undefined,
      });
      return false;
    }
    toast.success("Fiche mise à jour.");
    void load();
    return true;
  }

  async function removeListing(item: Listing) {
    const { error } = await supabase.from("directory_listings").delete().eq("id", item.id);
    if (error) toast.error("Fiche non supprimée.");
    else {
      toast.success("Fiche supprimée.");
      void load();
    }
  }

  /** Accepter : la fiche est confiée au membre, datée ; la demande est close. */
  async function approveClaim(item: Listing) {
    if (!item.claim_requested_by) return;
    await updateListing(item.id, {
      claimed_by: item.claim_requested_by,
      claimed_at: new Date().toISOString(),
      claim_requested_by: null,
      claim_requested_at: null,
    } as Partial<Listing>);
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

      {failed ? (
        <p role="alert" className="mt-6 rounded-lg border border-destructive/40 p-4 text-sm text-destructive-text">
          Une partie de l'annuaire n'a pas pu être chargée.{" "}
          <button type="button" className="underline" onClick={() => void load()}>
            Réessayer
          </button>
        </p>
      ) : null}
      {listings === null ? (
        <p className="mt-6 text-sm text-muted-foreground">Chargement…</p>
      ) : tab === "fiches" ? (
        <>
          {listings.length === 0 ? (
            <p className="mt-6 text-sm text-muted-foreground">Aucune fiche pour l'instant.</p>
          ) : null}
        <ul className="mt-6 space-y-3">
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
                <Button
                  variant="outline"
                  title="Modifier le logo, la couverture et les photos"
                  onClick={() => setOpenImages(openImages === item.id ? null : item.id)}
                >
                  {openImages === item.id ? "Masquer les images" : "Images"}
                </Button>
                <Button
                  variant="outline"
                  title="Modifier le contenu de cette fiche"
                  onClick={() => setEditing(editing === item.id ? null : item.id)}
                >
                  {editing === item.id ? "Fermer" : "Modifier"}
                </Button>
                <Button
                  variant="outline"
                  title={item.status === "archived" ? "Remettre en brouillon" : "Retirer du site sans supprimer"}
                  onClick={() =>
                    updateListing(item.id, { status: item.status === "archived" ? "draft" : "archived" })
                  }
                >
                  {item.status === "archived" ? "Désarchiver" : "Archiver"}
                </Button>
                <ConfirmButton
                  size="default"
                  title="Supprimer définitivement cette fiche"
                  question={`Supprimer la fiche « ${item.name} » ?`}
                  detail="La fiche et ses avis sont supprimés définitivement. Pour la retirer sans la perdre, archivez-la."
                  onConfirm={() => removeListing(item)}
                />
              </div>
              {editing === item.id ? (
                <div className="mt-4 border-t border-border pt-4">
                  <RecordEditor
                    idPrefix={`dir-${item.id}`}
                    fields={[
                      { key: "name", label: "Nom", type: "text", required: true },
                      { key: "slug", label: "Adresse (/annuaire/…)", type: "text", required: true },
                      {
                        key: "category_id",
                        label: "Catégorie",
                        type: "select",
                        nullable: true,
                        options: categories.map((c) => ({ value: c.id, label: c.name })),
                      },
                      { key: "tags", label: "Étiquettes", type: "tags" },
                      { key: "excerpt", label: "Résumé", type: "text", wide: true },
                      { key: "description", label: "Description", type: "textarea" },
                      { key: "address", label: "Adresse postale", type: "text", wide: true },
                      { key: "postal_code", label: "Code postal", type: "text" },
                      { key: "city", label: "Ville", type: "text" },
                      {
                        key: "departement",
                        label: "Département (code)",
                        type: "text",
                        nullable: true,
                        hint: "Code INSEE, par exemple 75 ou 2A. Vide si inconnu.",
                      },
                      { key: "phone", label: "Téléphone", type: "text" },
                      { key: "email", label: "E-mail", type: "email" },
                      { key: "website", label: "Site web", type: "url" },
                    ]}
                    values={item}
                    onCancel={() => setEditing(null)}
                    onSave={async (changes) => {
                      const ok = await updateListing(item.id, {
                        ...changes,
                        slug: slugify(String(changes["slug"] ?? "")),
                      } as Partial<Listing>);
                      if (ok) setEditing(null);
                      return ok;
                    }}
                  />
                </div>
              ) : null}
              {openImages === item.id ? (
                <ListingImages
                  item={item}
                  onSave={(changes) => updateListing(item.id, changes)}
                />
              ) : null}
            </li>
          ))}
        </ul>
        </>
      ) : tab === "categories" ? (
        <div className="mt-6">
          <CategoryManager table="directory_categories" withDescription placeholder="Plombiers" usage="fiches" />
        </div>
      ) : tab === "avis" ? (
        <>
          {reviews.length === 0 ? (
            <p className="mt-6 text-sm text-muted-foreground">Aucun avis reçu.</p>
          ) : null}
        <ul className="mt-6 space-y-3">
          {reviews.map((item) => (
            <li key={item.id} className="rounded-xl border border-border bg-card p-5">
              <p className="text-sm font-semibold text-foreground">
                {item.author_name} — {item.rating}/5
              </p>
              <p className="mt-2 text-sm text-muted-foreground">{item.content}</p>
              <ModerationNote note={item.moderation_note} />
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  variant={item.approved ? "outline" : "default"}
                  title={item.approved ? "Retirer cet avis du site" : "Publier cet avis"}
                  onClick={async () => {
                    const { error } = await supabase
                      .from("directory_reviews")
                      .update({ approved: !item.approved })
                      .eq("id", item.id);
                    if (error) toast.error("Modification non enregistrée.");
                    void load();
                  }}
                >
                  {item.approved ? "Dépublier" : "Publier"}
                </Button>
                <ConfirmButton
                  size="default"
                  title="Supprimer cet avis"
                  question={`Supprimer l'avis de ${item.author_name} ?`}
                  onConfirm={async () => {
                    const { error } = await supabase.from("directory_reviews").delete().eq("id", item.id);
                    if (error) toast.error("Avis non supprimé.");
                    else toast.success("Avis supprimé.");
                    void load();
                  }}
                />
                <ModerationControl
                  table="directory_reviews"
                  item={item}
                  approvable
                  onDone={() => void load()}
                />
              </div>
            </li>
          ))}
        </ul>
        </>
      ) : (
        <>
          {pendingClaims.length === 0 ? (
            <p className="mt-6 text-sm text-muted-foreground">
              Aucune demande de revendication en attente.
            </p>
          ) : null}
        <ul className="mt-6 space-y-3">
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
                    updateListing(item.id, {
                      claim_requested_by: null,
                      claim_requested_at: null,
                    } as Partial<Listing>)
                  }
                >
                  Refuser
                </Button>
              </div>
            </li>
          ))}
        </ul>
        </>
      )}
    </AdminShell>
  );
}

function ListingImages({
  item,
  onSave,
}: {
  item: Listing;
  onSave: (changes: Partial<Listing>) => Promise<unknown>;
}) {
  const [logo, setLogo] = useState(item.logo_url ?? "");
  const [cover, setCover] = useState(item.cover_url ?? "");
  const [photos, setPhotos] = useState<string[]>(item.photos ?? []);

  return (
    <form
      className="mt-4 space-y-4 border-t border-border pt-4"
      onSubmit={(event) => {
        event.preventDefault();
        void onSave({ logo_url: logo.trim() || null, cover_url: cover.trim() || null, photos });
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <ImageField id={`dir-logo-${item.id}`} label="Logo" value={logo} onChange={setLogo} />
        <ImageField id={`dir-cover-${item.id}`} label="Image de couverture" value={cover} onChange={setCover} />
      </div>
      <ImageListField id={`dir-photos-${item.id}`} label="Photos" value={photos} onChange={setPhotos} max={10} />
      <Button type="submit" size="sm">
        Enregistrer les images
      </Button>
    </form>
  );
}
