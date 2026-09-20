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

export const Route = createFileRoute("/_authenticated/admin/regie")({
  beforeLoad: () => requireFeature("adNetwork"),
  head: () =>
    seo({
      title: "Administration — Régie publicitaire",
      description: "Emplacements, campagnes et statistiques d'affichage.",
      path: "/admin/regie",
      noindex: true,
    }),
  component: AdminAdsPage,
});

type Placement = { id: string; name: string; slug: string; location: string; format: string; active: boolean };
type Campaign = {
  id: string;
  placement_id: string;
  advertiser: string;
  title: string;
  link_url: string;
  image_url: string | null;
  type: string;
  active: boolean;
  starts_at: string | null;
  ends_at: string | null;
};

function AdminAdsPage() {
  const [placements, setPlacements] = useState<Placement[] | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [stats, setStats] = useState<Record<string, { impressions: number; clicks: number }>>({});

  const load = useCallback(async () => {
    const [p, c, e] = await Promise.all([
      supabase.from("ad_placements").select("id, name, slug, location, format, active").order("name"),
      supabase
        .from("ad_campaigns")
        .select("id, placement_id, advertiser, title, link_url, image_url, type, active, starts_at, ends_at")
        .order("created_at", { ascending: false }),
      supabase.from("ad_events").select("campaign_id, event_type"),
    ]);
    setPlacements(p.data ?? []);
    setCampaigns(c.data ?? []);
    const totals: Record<string, { impressions: number; clicks: number }> = {};
    for (const event of e.data ?? []) {
      const entry = (totals[event.campaign_id] ??= { impressions: 0, clicks: 0 });
      if (event.event_type === "click") entry.clicks += 1;
      else entry.impressions += 1;
    }
    setStats(totals);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function addPlacement(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const name = String(data.get("name") ?? "").trim();
    if (!name) return;
    const { error } = await supabase.from("ad_placements").insert({
      name,
      slug: slugify(name),
      location: String(data.get("location") ?? "in-content"),
      format: String(data.get("format") ?? "banner"),
    });
    if (error) toast.error("Emplacement non créé.");
    else {
      toast.success("Emplacement créé.");
      form.reset();
      void load();
    }
  }

  async function addCampaign(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const placementId = String(data.get("placement_id") ?? "");
    if (!placementId) return;
    const { error } = await supabase.from("ad_campaigns").insert({
      placement_id: placementId,
      advertiser: String(data.get("advertiser") ?? ""),
      title: String(data.get("title") ?? ""),
      link_url: String(data.get("link_url") ?? ""),
      image_url: String(data.get("image_url") ?? "") || null,
      alt_text: String(data.get("title") ?? ""),
      type: String(data.get("type") ?? "direct"),
    });
    if (error) toast.error("Campagne non créée.");
    else {
      toast.success("Campagne créée.");
      form.reset();
      void load();
    }
  }

  return (
    <AdminShell
      title="Régie publicitaire"
      intro="Un emplacement décrit où l'encart s'affiche ; une campagne décide de ce qui y passe, et pendant combien de temps."
    >
      <form onSubmit={addPlacement} className="grid gap-3 rounded-xl border border-border bg-card p-5 sm:grid-cols-3">
        <div>
          <Label htmlFor="pl-name">Nom de l'emplacement</Label>
          <Input id="pl-name" name="name" required className="mt-1" placeholder="Bandeau blog" />
        </div>
        <div>
          <Label htmlFor="pl-location">Position</Label>
          <select
            id="pl-location"
            name="location"
            className="mt-1 h-10 w-full rounded-md border border-border bg-card px-3 text-sm text-foreground"
          >
            <option value="header">En-tête</option>
            <option value="sidebar">Colonne latérale</option>
            <option value="in-content">Dans le contenu</option>
            <option value="footer">Pied de page</option>
            <option value="interstitial">Interstitiel</option>
          </select>
        </div>
        <div>
          <Label htmlFor="pl-format">Format</Label>
          <select
            id="pl-format"
            name="format"
            className="mt-1 h-10 w-full rounded-md border border-border bg-card px-3 text-sm text-foreground"
          >
            <option value="banner">Bandeau</option>
            <option value="square">Carré</option>
            <option value="text-link">Lien texte</option>
          </select>
        </div>
        <div className="sm:col-span-3">
          <Button type="submit" title="Créer cet emplacement">
            Créer l'emplacement
          </Button>
        </div>
      </form>

      {placements === null ? (
        <p className="mt-6 text-sm text-muted-foreground">Chargement…</p>
      ) : (
        <>
          <ul className="mt-4 flex flex-wrap gap-2 text-xs text-muted-foreground">
            {placements.map((item) => (
              <li key={item.id} className="rounded-full bg-muted px-3 py-1">
                {item.name} — code « {item.slug} »
              </li>
            ))}
          </ul>

          <form onSubmit={addCampaign} className="mt-6 grid gap-3 rounded-xl border border-border bg-card p-5 sm:grid-cols-2">
            <div>
              <Label htmlFor="ca-placement">Emplacement</Label>
              <select
                id="ca-placement"
                name="placement_id"
                required
                className="mt-1 h-10 w-full rounded-md border border-border bg-card px-3 text-sm text-foreground"
              >
                {placements.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="ca-type">Type</Label>
              <select
                id="ca-type"
                name="type"
                className="mt-1 h-10 w-full rounded-md border border-border bg-card px-3 text-sm text-foreground"
              >
                <option value="direct">Direct</option>
                <option value="affiliation">Affiliation</option>
                <option value="cross-promo">Promotion croisée</option>
                <option value="sponsorise">Contenu sponsorisé</option>
              </select>
            </div>
            <div>
              <Label htmlFor="ca-advertiser">Annonceur</Label>
              <Input id="ca-advertiser" name="advertiser" required className="mt-1" />
            </div>
            <div>
              <Label htmlFor="ca-title">Message affiché</Label>
              <Input id="ca-title" name="title" required className="mt-1" />
            </div>
            <div>
              <Label htmlFor="ca-link">Lien de destination</Label>
              <Input id="ca-link" name="link_url" type="url" required className="mt-1" placeholder="https://" />
            </div>
            <div>
              <Label htmlFor="ca-image">Visuel (adresse de l'image)</Label>
              <Input id="ca-image" name="image_url" type="url" className="mt-1" placeholder="https://" />
            </div>
            <div className="sm:col-span-2">
              <Button type="submit" title="Créer cette campagne">
                Créer la campagne
              </Button>
            </div>
          </form>

          <div className="mt-6 flex items-center gap-3">
            <h2 className="text-sm font-semibold text-foreground">Campagnes et performances</h2>
            <Button
              variant="outline"
              className="ml-auto"
              title="Télécharger les campagnes au format tableur"
              onClick={() =>
                downloadCsv(
                  "campagnes.csv",
                  campaigns.map((item) => ({
                    annonceur: item.advertiser,
                    titre: item.title,
                    impressions: stats[item.id]?.impressions ?? 0,
                    clics: stats[item.id]?.clicks ?? 0,
                  })),
                )
              }
            >
              Export CSV
            </Button>
          </div>

          <ul className="mt-3 space-y-3">
            {campaigns.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucune campagne pour l'instant.</p>
            ) : null}
            {campaigns.map((item) => {
              const stat = stats[item.id] ?? { impressions: 0, clicks: 0 };
              const ctr = stat.impressions > 0 ? ((stat.clicks / stat.impressions) * 100).toFixed(1) : "0,0";
              return (
                <li key={item.id} className="rounded-xl border border-border bg-card p-5">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-foreground">{item.title}</p>
                    <span className="text-xs text-muted-foreground">{item.advertiser}</span>
                    <span className="ml-auto text-xs text-muted-foreground">
                      {stat.impressions} affichages · {stat.clicks} clics · {ctr} %
                    </span>
                  </div>
                  <div className="mt-3 flex gap-2">
                    <Button
                      variant={item.active ? "outline" : "default"}
                      title={item.active ? "Mettre cette campagne en pause" : "Activer cette campagne"}
                      onClick={async () => {
                        await supabase.from("ad_campaigns").update({ active: !item.active }).eq("id", item.id);
                        void load();
                      }}
                    >
                      {item.active ? "Mettre en pause" : "Activer"}
                    </Button>
                    <Button
                      variant="destructive"
                      title="Supprimer cette campagne"
                      onClick={async () => {
                        await supabase.from("ad_campaigns").delete().eq("id", item.id);
                        void load();
                      }}
                    >
                      Supprimer
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </AdminShell>
  );
}
