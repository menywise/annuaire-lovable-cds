import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { PageShell } from "@/components/cds/SiteHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { RichTextEditor } from "@/lib/richtext";
import { requireFeature } from "@/config/features";
import { listMarketplaceCategories } from "@/lib/marketplace.functions";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { seo } from "@/lib/seo";
import { slugify } from "@/lib/format";

export const Route = createFileRoute("/marketplace/publier")({
  beforeLoad: () => requireFeature("marketplace"),
  loader: () => listMarketplaceCategories(),
  head: () =>
    seo({
      title: "Publier une annonce",
      description:
        "Décrivez ce que vous proposez, fixez votre prix et laissez les membres vous contacter en privé.",
      path: "/marketplace/publier",
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
  component: PublishPage,
});

function PublishPage() {
  const categories = Route.useLoaderData();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [negotiable, setNegotiable] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!user) return;
    const form = e.currentTarget;
    const data = new FormData(form);
    const title = String(data.get("title") ?? "").trim();
    if (!title) return;
    setBusy(true);
    const price = Math.round(Number(String(data.get("price") ?? "0").replace(",", ".")) * 100);
    const photos = String(data.get("photos") ?? "")
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => /^https?:\/\//.test(line))
      .slice(0, 5);
    const { error } = await supabase.from("marketplace_listings").insert({
      seller_id: user.id,
      seller_name: (user.user_metadata?.["full_name"] as string) || "Membre",
      title,
      slug: `${slugify(title)}-${Math.random().toString(36).slice(2, 7)}`,
      description: String(data.get("description") ?? "").trim(),
      category_id: String(data.get("category_id") ?? "") || null,
      price_cents: Number.isFinite(price) && price > 0 ? price : 0,
      negotiable,
      city: String(data.get("city") ?? "").trim(),
      photos,
      status: "active",
    });
    setBusy(false);
    if (error) {
      toast.error("Annonce non publiée.", { description: "Vérifiez les champs et réessayez." });
      return;
    }
    toast.success("Annonce envoyée.", { description: "Elle apparaîtra après validation." });
    void navigate({ to: "/mes-annonces" });
  }

  return (
    <PageShell>
      <div className="mx-auto max-w-[720px]">
        <h1 className="text-3xl font-bold text-foreground">Publier une annonce</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Une annonce précise trouve preneur plus vite : dites ce que c'est, l'état, et pourquoi
          vous vous en séparez.
        </p>

        {!user ? (
          <p className="mt-6 rounded-lg border border-border bg-card p-6 text-sm text-muted-foreground">
            <Link
              to="/login"
              title="Se connecter pour publier une annonce"
              className="text-primary-text hover:underline"
            >
              Connectez-vous
            </Link>{" "}
            pour publier une annonce.
          </p>
        ) : (
          <form
            onSubmit={submit}
            className="mt-6 space-y-4 rounded-xl border border-border bg-card p-6"
          >
            <div className="space-y-1.5">
              <Label htmlFor="a-title">Titre</Label>
              <Input id="a-title" name="title" required placeholder="Ce que vous proposez" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="a-description">Description</Label>
              <RichTextEditor
                id="a-description"
                name="description"
                rows={6}
                placeholder="État, dimensions, conditions de remise…"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="a-cat">Catégorie</Label>
                <select
                  id="a-cat"
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
              <div className="space-y-1.5">
                <Label htmlFor="a-price">Prix en euros</Label>
                <Input id="a-price" name="price" inputMode="decimal" placeholder="0" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="a-city">Ville</Label>
                <Input id="a-city" name="city" placeholder="Limoges" />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="a-nego"
                checked={negotiable}
                onCheckedChange={(value) => setNegotiable(value === true)}
              />
              <Label htmlFor="a-nego" className="font-normal">
                Prix à débattre
              </Label>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="a-photos">Photos (une adresse par ligne, 5 maximum)</Label>
              <textarea
                id="a-photos"
                name="photos"
                rows={3}
                placeholder="https://…"
                className="w-full resize-y rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
            <Button type="submit" disabled={busy} title="Publier cette annonce">
              {busy ? "Envoi…" : "Publier mon annonce"}
            </Button>
            <p className="text-xs text-muted-foreground">
              Chaque annonce est relue avant d'apparaître publiquement.
            </p>
          </form>
        )}
      </div>
    </PageShell>
  );
}
