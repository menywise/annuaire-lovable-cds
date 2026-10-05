import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { AdminShell } from "@/components/cds/AdminShell";
import { ConfirmButton } from "@/components/cds/ConfirmButton";
import { ImageField } from "@/components/cds/MediaPicker";
import { RecordEditor } from "@/components/cds/RecordEditor";
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

type Placement = {
  id: string;
  name: string;
  slug: string;
  location: string;
  format: string;
  active: boolean;
  width: number | null;
  height: number | null;
};
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
  contact_email: string;
  alt_text: string;
  affiliate_code: string;
  commission_pct: number;
};

const LOCATIONS = [
  { value: "header", label: "En-tête" },
  { value: "sidebar", label: "Colonne latérale" },
  { value: "in-content", label: "Dans le contenu" },
  { value: "footer", label: "Pied de page" },
  { value: "interstitial", label: "Interstitiel" },
];
const FORMATS = [
  { value: "banner", label: "Bandeau" },
  { value: "square", label: "Carré" },
  { value: "text-link", label: "Lien texte" },
];
const TYPES = [
  { value: "direct", label: "Direct" },
  { value: "affiliation", label: "Affiliation" },
  { value: "cross-promo", label: "Promotion croisée" },
  { value: "sponsorise", label: "Contenu sponsorisé" },
];

function AdminAdsPage() {
  const [placements, setPlacements] = useState<Placement[] | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [stats, setStats] = useState<Record<string, { impressions: number; clicks: number }>>({});
  const [campaignFormKey, setCampaignFormKey] = useState(0);
  const [editing, setEditing] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    const [p, c, e] = await Promise.all([
      supabase.from("ad_placements").select("id, name, slug, location, format, active, width, height").order("name"),
      supabase
        .from("ad_campaigns")
        .select(
          "id, placement_id, advertiser, title, link_url, image_url, type, active, starts_at, ends_at, contact_email, alt_text, affiliate_code, commission_pct",
        )
        .order("created_at", { ascending: false }),
      supabase.from("ad_events").select("campaign_id, event_type"),
    ]);
    setFailed(Boolean(p.error || c.error || e.error));
    if (p.error) return;
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

  async function write(
    table: "ad_placements" | "ad_campaigns",
    id: string,
    changes: Record<string, unknown>,
    message: string,
  ) {
    const { error } = await supabase
      .from(table)
      .update(changes as never)
      .eq("id", id);
    if (error) {
      toast.error("Modification non enregistrée.");
      return false;
    }
    toast.success(message);
    void load();
    return true;
  }

  async function removeRow(table: "ad_placements" | "ad_campaigns", id: string, message: string) {
    const { error } = await supabase.from(table).delete().eq("id", id);
    if (error) toast.error("Suppression impossible.");
    else {
      toast.success(message);
      void load();
    }
  }

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
      setCampaignFormKey((k) => k + 1);
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

      {failed ? (
        <p role="alert" className="mt-6 rounded-lg border border-destructive/40 p-4 text-sm text-destructive-text">
          Une partie de la régie n'a pas pu être chargée.{" "}
          <button type="button" className="underline" onClick={() => void load()}>
            Réessayer
          </button>
        </p>
      ) : null}
      {placements === null ? (
        <p className="mt-6 text-sm text-muted-foreground">Chargement…</p>
      ) : (
        <>
          <ul className="mt-4 space-y-2">
            {placements.map((item) => {
              const key = `pl:${item.id}`;
              const count = campaigns.filter((c) => c.placement_id === item.id).length;
              return (
                <li key={item.id} className="rounded-xl border border-border bg-card p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-foreground">{item.name}</p>
                    <span className="text-xs text-muted-foreground">
                      code « {item.slug} » · {LOCATIONS.find((l) => l.value === item.location)?.label ?? item.location} ·{" "}
                      {count} campagne{count > 1 ? "s" : ""} · {item.active ? "actif" : "désactivé"}
                    </span>
                    <div className="ml-auto flex flex-wrap gap-2">
                      <Button size="sm" variant="outline" onClick={() => setEditing(editing === key ? null : key)}>
                        {editing === key ? "Fermer" : "Modifier"}
                      </Button>
                      <ConfirmButton
                        title={`Supprimer l'emplacement ${item.name}`}
                        question={`Supprimer l'emplacement « ${item.name} » ?`}
                        detail={`Ses ${count} campagnes et leurs statistiques sont supprimées définitivement. Pour l'arrêter sans rien perdre, désactivez-le.`}
                        onConfirm={() => removeRow("ad_placements", item.id, "Emplacement supprimé.")}
                      />
                    </div>
                  </div>
                  {editing === key ? (
                    <div className="mt-3 border-t border-border pt-3">
                      <RecordEditor
                        idPrefix={key}
                        fields={[
                          { key: "name", label: "Nom", type: "text", required: true },
                          { key: "location", label: "Position", type: "select", options: LOCATIONS },
                          { key: "format", label: "Format", type: "select", options: FORMATS },
                          { key: "width", label: "Largeur (px)", type: "number", nullable: true },
                          { key: "height", label: "Hauteur (px)", type: "number", nullable: true },
                          { key: "active", label: "Emplacement actif", type: "checkbox" },
                        ]}
                        values={item}
                        onCancel={() => setEditing(null)}
                        onSave={async (changes) => {
                          const ok = await write("ad_placements", item.id, changes, "Emplacement modifié.");
                          if (ok) setEditing(null);
                          return ok;
                        }}
                      />
                      <p className="mt-2 text-xs text-muted-foreground">
                        Le code « {item.slug} » n'est pas modifiable : il relie l'emplacement aux pages du site.
                      </p>
                    </div>
                  ) : null}
                </li>
              );
            })}
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
            <div className="sm:col-span-2">
              <ImageField key={campaignFormKey} id="ca-image" name="image_url" label="Visuel" />
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

          {campaigns.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">Aucune campagne pour l'instant.</p>
          ) : null}
          <ul className="mt-3 space-y-3">
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
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                      variant={item.active ? "outline" : "default"}
                      title={item.active ? "Mettre cette campagne en pause" : "Activer cette campagne"}
                      onClick={() =>
                        void write(
                          "ad_campaigns",
                          item.id,
                          { active: !item.active },
                          item.active ? "Campagne en pause." : "Campagne activée.",
                        )
                      }
                    >
                      {item.active ? "Mettre en pause" : "Activer"}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setEditing(editing === `ca:${item.id}` ? null : `ca:${item.id}`)}
                    >
                      {editing === `ca:${item.id}` ? "Fermer" : "Modifier"}
                    </Button>
                    <ConfirmButton
                      size="default"
                      title="Supprimer cette campagne"
                      question={`Supprimer la campagne « ${item.title} » ?`}
                      detail="La campagne et ses statistiques sont supprimées définitivement."
                      onConfirm={() => removeRow("ad_campaigns", item.id, "Campagne supprimée.")}
                    />
                  </div>
                  {editing === `ca:${item.id}` ? (
                    <div className="mt-3 border-t border-border pt-3">
                      <RecordEditor
                        idPrefix={`ca-${item.id}`}
                        fields={[
                          {
                            key: "placement_id",
                            label: "Emplacement",
                            type: "select",
                            options: placements.map((p) => ({ value: p.id, label: p.name })),
                          },
                          { key: "type", label: "Type", type: "select", options: TYPES },
                          { key: "advertiser", label: "Annonceur", type: "text", required: true },
                          { key: "contact_email", label: "E-mail de l'annonceur", type: "email" },
                          { key: "title", label: "Message affiché", type: "text", required: true },
                          { key: "alt_text", label: "Description du visuel", type: "text" },
                          { key: "link_url", label: "Lien de destination", type: "url", required: true, wide: true },
                          { key: "image_url", label: "Visuel", type: "image", nullable: true },
                          { key: "starts_at", label: "Début", type: "datetime" },
                          { key: "ends_at", label: "Fin", type: "datetime" },
                          { key: "affiliate_code", label: "Code d'affiliation", type: "text" },
                          { key: "commission_pct", label: "Commission (%)", type: "number" },
                        ]}
                        values={item}
                        onCancel={() => setEditing(null)}
                        onSave={async (changes) => {
                          const ok = await write("ad_campaigns", item.id, changes, "Campagne modifiée.");
                          if (ok) setEditing(null);
                          return ok;
                        }}
                      />
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </>
      )}
    </AdminShell>
  );
}
