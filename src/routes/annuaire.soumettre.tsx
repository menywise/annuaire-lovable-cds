import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { PageShell } from "@/components/cds/SiteHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RichTextEditor } from "@/lib/richtext";
import { requireFeature, isFeatureOn } from "@/config/features";
import { listDirectoryListings } from "@/lib/directory.functions";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { seo } from "@/lib/seo";
import { slugify } from "@/lib/format";

export const Route = createFileRoute("/annuaire/soumettre")({
  beforeLoad: () => requireFeature("directory"),
  loader: () => listDirectoryListings(),
  head: () =>
    seo({
      title: "Ajouter votre fiche à l'annuaire",
      description:
        "Décrivez votre activité en quelques minutes : votre fiche est relue puis publiée, avec vos coordonnées et votre zone d'intervention.",
      path: "/annuaire/soumettre",
    }),
  errorComponent: () => (
    <PageShell>
      <p className="text-sm text-muted-foreground">Cette page n'a pas pu être chargée.</p>
    </PageShell>
  ),
  notFoundComponent: () => (
    <PageShell>
      <p className="text-sm text-muted-foreground">Cette page n'existe pas.</p>
    </PageShell>
  ),
  component: SubmitListingPage,
});

function SubmitListingPage() {
  const { categories, departements } = Route.useLoaderData();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!user) return;
    const form = e.currentTarget;
    const data = new FormData(form);
    const name = String(data.get("name") ?? "").trim();
    if (!name) return;
    setBusy(true);
    const slug = `${slugify(name)}-${Math.random().toString(36).slice(2, 7)}`;
    const categoryId = String(data.get("category_id") ?? "");
    const departementCode = String(data.get("departement") ?? "");
    const { error } = await supabase.from("directory_listings").insert({
      name,
      slug,
      excerpt: String(data.get("excerpt") ?? "")
        .trim()
        .slice(0, 155),
      description: String(data.get("description") ?? "").trim(),
      category_id: categoryId || null,
      departement: departementCode || null,
      address: String(data.get("address") ?? "").trim(),
      postal_code: String(data.get("postal_code") ?? "").trim(),
      city: String(data.get("city") ?? "").trim(),
      phone: String(data.get("phone") ?? "").trim(),
      email: String(data.get("email") ?? "").trim(),
      website: String(data.get("website") ?? "").trim(),
      created_by: user.id,
      claimed_by: user.id,
      claimed_at: new Date().toISOString(),
      status: "draft",
    });
    setBusy(false);
    if (error) {
      toast.error("Fiche non enregistrée.", { description: "Vérifiez les champs et réessayez." });
      return;
    }
    toast.success("Fiche envoyée.", { description: "Elle sera publiée après relecture." });
    void navigate({ to: "/annuaire" });
  }

  return (
    <PageShell>
      <div className="mx-auto max-w-[720px]">
        <h1 className="text-3xl font-bold text-foreground">Ajoutez votre fiche</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Dix minutes suffisent. Une fiche claire, c'est un client qui vous trouve au lieu de
          chercher ailleurs.
        </p>

        {!user ? (
          <p className="mt-6 rounded-lg border border-border bg-card p-6 text-sm text-muted-foreground">
            <Link
              to="/login"
              title="Se connecter pour ajouter une fiche"
              className="text-primary-text hover:underline"
            >
              Connectez-vous
            </Link>{" "}
            pour créer votre fiche et la modifier ensuite quand vous voulez.
          </p>
        ) : (
          <form
            onSubmit={submit}
            className="mt-6 space-y-4 rounded-xl border border-border bg-card p-6"
          >
            <div className="space-y-1.5">
              <Label htmlFor="f-name">Nom de l'établissement</Label>
              <Input id="f-name" name="name" required placeholder="Atelier Dupont" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="f-excerpt">Résumé (155 caractères)</Label>
              <Input
                id="f-excerpt"
                name="excerpt"
                maxLength={155}
                placeholder="Ce que vous faites, en une phrase"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="f-description">Description</Label>
              <RichTextEditor
                id="f-description"
                name="description"
                rows={6}
                placeholder="Vos prestations, votre méthode, vos zones d'intervention…"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="f-cat">Activité</Label>
                <select
                  id="f-cat"
                  name="category_id"
                  className="h-11 w-full rounded-md border border-border bg-card px-3 text-sm text-foreground"
                >
                  <option value="">À classer</option>
                  {categories.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </div>
              {isFeatureOn("geo") ? (
                <div className="space-y-1.5">
                  <Label htmlFor="f-dep">Département</Label>
                  <select
                    id="f-dep"
                    name="departement"
                    className="h-11 w-full rounded-md border border-border bg-card px-3 text-sm text-foreground"
                  >
                    <option value="">Non précisé</option>
                    {departements.map((dep) => (
                      <option key={dep.code} value={dep.code}>
                        {dep.code} — {dep.nom}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="f-address">Adresse</Label>
                <Input id="f-address" name="address" placeholder="12 rue des Artisans" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="f-cp">Code postal</Label>
                <Input id="f-cp" name="postal_code" placeholder="87000" />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="f-city">Ville</Label>
                <Input id="f-city" name="city" placeholder="Votre ville" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="f-phone">Téléphone</Label>
                <Input id="f-phone" name="phone" placeholder="05 00 00 00 00" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="f-email">E-mail</Label>
                <Input id="f-email" name="email" type="email" placeholder="contact@exemple.fr" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="f-web">Site web</Label>
              <Input id="f-web" name="website" placeholder="https://" />
            </div>
            <Button type="submit" disabled={busy} title="Envoyer votre fiche pour relecture">
              {busy ? "Envoi…" : "Envoyer ma fiche"}
            </Button>
            <p className="text-xs text-muted-foreground">
              Votre fiche est relue avant publication : c'est ce qui garantit la qualité de
              l'annuaire.
            </p>
          </form>
        )}
      </div>
    </PageShell>
  );
}
