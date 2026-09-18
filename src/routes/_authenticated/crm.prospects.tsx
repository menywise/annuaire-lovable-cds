import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { CrmShell, CRM_STAGES, CRM_STAGE_LABEL } from "@/components/cds/CrmShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { requireFeature } from "@/config/features";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { seo } from "@/lib/seo";

type Prospect = {
  id: string;
  name: string;
  company: string;
  email: string;
  phone: string;
  source: string;
  sector: string;
  stage: string;
  active: boolean;
};

export const Route = createFileRoute("/_authenticated/crm/prospects")({
  beforeLoad: () => requireFeature("crm"),
  head: () =>
    seo({
      title: "Contacts suivis",
      description: "La liste de vos contacts, leur étape et leurs coordonnées.",
      path: "/crm/prospects",
      noindex: true,
    }),
  component: ProspectsPage,
});

function ProspectsPage() {
  const { user } = useAuth();
  const [rows, setRows] = useState<Prospect[] | null>(null);
  const [query, setQuery] = useState("");
  const [stage, setStage] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    void supabase
      .from("crm_prospects")
      .select("id, name, company, email, phone, source, sector, stage, active")
      .eq("owner_id", user.id)
      .order("updated_at", { ascending: false })
      .then(({ data }) => {
        if (!cancelled) setRows((data ?? []) as Prospect[]);
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return (rows ?? []).filter((row) => {
      if (stage && row.stage !== stage) return false;
      if (!needle) return true;
      return `${row.name} ${row.company} ${row.email} ${row.sector}`.toLowerCase().includes(needle);
    });
  }, [rows, query, stage]);

  async function addProspect(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!user) return;
    const form = e.currentTarget;
    const data = new FormData(form);
    const name = String(data.get("name") ?? "").trim();
    if (!name) return;
    setBusy(true);
    const { data: created, error } = await supabase
      .from("crm_prospects")
      .insert({
        owner_id: user.id,
        name,
        company: String(data.get("company") ?? "").trim(),
        email: String(data.get("email") ?? "").trim(),
        phone: String(data.get("phone") ?? "").trim(),
        source: String(data.get("source") ?? "").trim(),
        sector: String(data.get("sector") ?? "").trim(),
        stage: String(data.get("stage") ?? "inconnu"),
      })
      .select("id, name, company, email, phone, source, sector, stage, active")
      .maybeSingle();
    setBusy(false);
    if (error || !created) {
      toast.error("Contact non enregistré.", { description: "Réessayez dans un instant." });
      return;
    }
    form.reset();
    setRows((prev) => [created as Prospect, ...(prev ?? [])]);
    toast.success("Contact ajouté.");
  }

  return (
    <CrmShell
      title="Vos contacts"
      intro="Chaque fiche garde l'historique : vous savez quoi dire la prochaine fois que vous les croisez."
    >
      <form
        onSubmit={addProspect}
        className="grid gap-3 rounded-xl border border-border bg-card p-5 sm:grid-cols-3"
      >
        <div className="space-y-1.5">
          <Label htmlFor="p-name">Nom</Label>
          <Input id="p-name" name="name" required placeholder="Camille Martin" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="p-company">Structure</Label>
          <Input id="p-company" name="company" placeholder="Atelier Martin" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="p-email">E-mail</Label>
          <Input id="p-email" name="email" type="email" placeholder="camille@exemple.fr" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="p-phone">Téléphone</Label>
          <Input id="p-phone" name="phone" placeholder="06 00 00 00 00" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="p-source">Origine</Label>
          <Input id="p-source" name="source" placeholder="Salon, recommandation…" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="p-stage">Étape</Label>
          <select
            id="p-stage"
            name="stage"
            className="h-11 w-full rounded-md border border-border bg-card px-3 text-sm text-foreground"
          >
            {CRM_STAGES.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </div>
        <div className="sm:col-span-3">
          <Button type="submit" disabled={busy} title="Ajouter ce contact">
            {busy ? "Enregistrement…" : "Ajouter le contact"}
          </Button>
        </div>
      </form>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="p-search">Rechercher</Label>
          <Input
            id="p-search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Nom, structure, secteur…"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="p-filter">Étape</Label>
          <select
            id="p-filter"
            value={stage}
            onChange={(e) => setStage(e.target.value)}
            className="h-11 w-full rounded-md border border-border bg-card px-3 text-sm text-foreground"
          >
            <option value="">Toutes</option>
            {CRM_STAGES.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {rows === null ? (
        <Skeleton className="mt-6 h-40 w-full" />
      ) : visible.length === 0 ? (
        <p className="mt-6 rounded-lg border border-border bg-card p-6 text-sm text-muted-foreground">
          Aucun contact pour l'instant.
        </p>
      ) : (
        <ul className="mt-6 space-y-2">
          {visible.map((row) => (
            <li
              key={row.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card p-4"
            >
              <div>
                <Link
                  to="/crm/prospect/$prospectId"
                  params={{ prospectId: row.id }}
                  title={`Ouvrir la fiche de ${row.name}`}
                  className="text-sm font-medium text-foreground hover:underline"
                >
                  {row.name}
                </Link>
                <p className="text-xs text-muted-foreground">
                  {[row.company, row.sector, row.email].filter(Boolean).join(" · ") ||
                    "Coordonnées à compléter"}
                </p>
              </div>
              <span className="rounded bg-muted px-2 py-1 text-xs text-primary-text">
                {CRM_STAGE_LABEL[row.stage] ?? row.stage}
              </span>
            </li>
          ))}
        </ul>
      )}
    </CrmShell>
  );
}
