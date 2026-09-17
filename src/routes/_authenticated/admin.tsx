import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { PageShell } from "@/components/cds/SiteHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  type BrandSettings,
  saveBrandSettings,
  useBrandSettings,
} from "@/hooks/useSiteSettings";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/_authenticated/admin")({
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
  const { user } = useAuth();
  const { settings, loading, setSettings } = useBrandSettings();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase
      .rpc("has_role", { _user_id: user.id, _role: "admin" })
      .then(({ data }) => setIsAdmin(Boolean(data)));
  }, [user]);

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

  if (isAdmin === false) {
    return (
      <PageShell>
        <Alert variant="destructive" className="mx-auto max-w-[640px]">
          <AlertTitle>Accès réservé</AlertTitle>
          <AlertDescription>
            Cet espace est réservé aux administrateurs.{" "}
            <Link to="/compte" title="Revenir à mon compte" className="underline">
              Revenir à mon compte
            </Link>
          </AlertDescription>
        </Alert>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <div className="mx-auto max-w-[760px]">
        <p className="text-xs font-medium uppercase tracking-wide text-primary">Administration</p>
        <h1 className="mt-2 text-3xl font-bold text-foreground">Paramètres du site</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Tout ce qui identifie le site se règle ici : aucun fichier à modifier. Les informations
          alimentent l'en-tête, le pied de page, les mentions légales et les aperçus de partage.
        </p>

        {loading || isAdmin === null ? (
          <div className="mt-8 space-y-3">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        ) : (
          <form onSubmit={handleSave} className="mt-8 space-y-8">
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

            <div className="flex flex-wrap items-center gap-3">
              <Button type="submit" disabled={saving} title="Enregistrer les paramètres du site">
                {saving ? "Enregistrement…" : "Enregistrer"}
              </Button>
              <Link
                to="/compte"
                title="Consulter les messages reçus"
                className="text-sm text-muted-foreground underline hover:text-foreground"
              >
                Messages reçus
              </Link>
            </div>
          </form>
        )}
      </div>
    </PageShell>
  );
}
