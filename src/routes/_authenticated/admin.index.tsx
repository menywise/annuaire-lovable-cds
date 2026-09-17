import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { AdminShell } from "@/components/cds/AdminShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  type BrandSettings,
  saveBrandSettings,
  useBrandSettings,
} from "@/hooks/useSiteSettings";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/_authenticated/admin/")({
  head: () =>
    seo({
      title: "Administration",
      description: "Espace d'administration : paramètres du site, identité, coordonnées légales et hébergeur.",
      path: "/admin",
      noindex: true,
    }),
  component: AdminPage,
});

function Field({
  id,
  label,
  value,
  onChange,
  hint,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  hint?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} value={value} onChange={(e) => onChange(e.target.value)} />
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function AdminPage() {
  const { settings, loading, setSettings } = useBrandSettings();
  const [saving, setSaving] = useState(false);

  function patch(next: Partial<BrandSettings>) {
    setSettings({ ...settings, ...next });
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await saveBrandSettings(settings);
      toast.success("Paramètres enregistrés.", {
        description: "Le site utilise désormais ces informations.",
      });
    } catch {
      toast.error("Enregistrement impossible.", {
        description: "Vérifiez votre connexion, puis réessayez.",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <AdminShell
      title="Paramètres du site"
      intro="Tout ce qui identifie le site se règle ici : aucun fichier à modifier. Ces informations alimentent l'en-tête, le pied de page, les mentions légales et les aperçus de partage."
    >
      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      ) : (
        <form onSubmit={handleSave} className="space-y-8">
          <section className="rounded-xl border border-border bg-card p-6">
            <h2 className="text-base font-semibold text-foreground">Identité</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Field
                id="shortName"
                label="Nom court"
                value={settings.shortName}
                onChange={(v) => patch({ shortName: v })}
                hint="Affiché à côté du logo."
              />
              <Field
                id="name"
                label="Nom complet"
                value={settings.name}
                onChange={(v) => patch({ name: v })}
              />
              <Field
                id="tagline"
                label="Signature du pied de page"
                value={settings.tagline}
                onChange={(v) => patch({ tagline: v })}
              />
              <Field
                id="url"
                label="Adresse publique du site"
                value={settings.url}
                onChange={(v) => patch({ url: v })}
                hint="Sans barre oblique finale."
              />
            </div>
          </section>

          <section className="rounded-xl border border-border bg-card p-6">
            <h2 className="text-base font-semibold text-foreground">Éditeur (mentions légales)</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Field
                id="company"
                label="Raison sociale"
                value={settings.legal.company}
                onChange={(v) => patch({ legal: { ...settings.legal, company: v } })}
              />
              <Field
                id="form"
                label="Forme juridique"
                value={settings.legal.form}
                onChange={(v) => patch({ legal: { ...settings.legal, form: v } })}
              />
              <Field
                id="capital"
                label="Capital social"
                value={settings.legal.capital}
                onChange={(v) => patch({ legal: { ...settings.legal, capital: v } })}
              />
              <Field
                id="rcs"
                label="Immatriculation"
                value={settings.legal.rcs}
                onChange={(v) => patch({ legal: { ...settings.legal, rcs: v } })}
              />
              <Field
                id="address"
                label="Adresse du siège"
                value={settings.legal.address}
                onChange={(v) => patch({ legal: { ...settings.legal, address: v } })}
              />
              <Field
                id="country"
                label="Pays"
                value={settings.legal.country}
                onChange={(v) => patch({ legal: { ...settings.legal, country: v } })}
              />
              <Field
                id="publisher"
                label="Directeur de la publication"
                value={settings.legal.publisher}
                onChange={(v) => patch({ legal: { ...settings.legal, publisher: v } })}
              />
            </div>
          </section>

          <section className="rounded-xl border border-border bg-card p-6">
            <h2 className="text-base font-semibold text-foreground">Hébergeur</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Field
                id="hostName"
                label="Nom"
                value={settings.host.name}
                onChange={(v) => patch({ host: { ...settings.host, name: v } })}
              />
              <Field
                id="hostDetail"
                label="Immatriculation"
                value={settings.host.detail}
                onChange={(v) => patch({ host: { ...settings.host, detail: v } })}
              />
              <Field
                id="hostAddress"
                label="Adresse"
                value={settings.host.address}
                onChange={(v) => patch({ host: { ...settings.host, address: v } })}
              />
              <Field
                id="hostPhone"
                label="Téléphone"
                value={settings.host.phone}
                onChange={(v) => patch({ host: { ...settings.host, phone: v } })}
              />
            </div>
          </section>

          <Button type="submit" disabled={saving} title="Enregistrer les paramètres du site">
            {saving ? "Enregistrement…" : "Enregistrer"}
          </Button>
        </form>
      )}
    </AdminShell>
  );
}
