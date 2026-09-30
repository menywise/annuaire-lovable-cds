import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { AdminShell } from "@/components/cds/AdminShell";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { requireFeature } from "@/config/features";
import { downloadCsv } from "@/lib/csv";
import {
  computeGeoNeighbours,
  geoStatus,
  importGeoCommunes,
  importGeoSocle,
  type GeoStatus,
} from "@/lib/geo.functions";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/_authenticated/admin/geographie")({
  beforeLoad: () => requireFeature("geo"),
  head: () =>
    seo({
      title: "Administration — Géographie",
      description:
        "Référentiel géographique (régions, départements, intercommunalités, communes) et fiches rattachées.",
      path: "/admin/geographie",
      noindex: true,
    }),
  component: AdminGeoPage,
});

type Row = {
  code: string;
  nom: string;
  region: string;
  slug: string;
  population: number;
  listings: number;
};

function AdminGeoPage() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    void (async () => {
      const [deps, listings] = await Promise.all([
        supabase
          .from("geo_departements")
          .select("code, nom, region, slug, population")
          .order("code"),
        supabase.from("directory_listings").select("departement").eq("status", "published"),
      ]);
      if (deps.error || listings.error) {
        setFailed(true);
        return;
      }
      const counts = new Map<string, number>();
      for (const item of listings.data ?? []) {
        if (item.departement) counts.set(item.departement, (counts.get(item.departement) ?? 0) + 1);
      }
      setRows((deps.data ?? []).map((dep) => ({ ...dep, listings: counts.get(dep.code) ?? 0 })));
    })();
  }, []);

  return (
    <AdminShell
      title="Géographie"
      intro="Les pages départementales et communales se génèrent automatiquement à partir du référentiel officiel (geo.api.gouv.fr) : rien à créer à la main."
    >
      <ReferentielPanel />
      {failed ? (
        <p
          role="alert"
          className="mt-8 rounded-lg border border-destructive p-4 text-sm text-foreground"
        >
          Les départements n'ont pas pu être chargés. Rechargez la page.
        </p>
      ) : rows === null ? (
        <p className="text-sm text-muted-foreground">Chargement…</p>
      ) : (
        <>
          <h2 className="mt-10 text-lg font-semibold text-foreground">Départements</h2>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <p className="text-sm text-muted-foreground">
              {rows.length} départements · {rows.reduce((sum, row) => sum + row.listings, 0)} fiches
              rattachées
            </p>
            <Button
              variant="outline"
              className="ml-auto"
              title="Télécharger la liste au format tableur"
              onClick={() => downloadCsv("departements.csv", rows)}
            >
              Export CSV
            </Button>
          </div>
          <div className="mt-4 overflow-x-auto rounded-xl border border-border bg-card">
            <table className="w-full text-sm">
              <thead className="border-b border-border text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Code</th>
                  <th className="px-4 py-3">Département</th>
                  <th className="px-4 py-3">Région</th>
                  <th className="px-4 py-3">Fiches</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.code} className="border-b border-border last:border-0">
                    <td className="px-4 py-2.5 text-muted-foreground">{row.code}</td>
                    <td className="px-4 py-2.5 text-foreground">{row.nom}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{row.region}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{row.listings}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </AdminShell>
  );
}

const KINDS: Array<{ key: keyof GeoStatus["lieux"]; label: string }> = [
  { key: "region", label: "Régions" },
  { key: "departement", label: "Départements" },
  { key: "epci", label: "Intercommunalités" },
  { key: "commune", label: "Communes" },
];

/** Import du référentiel en trois étapes, chacune rejouable et reprise où elle s'était arrêtée. */
function ReferentielPanel() {
  const [status, setStatus] = useState<GeoStatus | null>(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const stop = useRef(false);

  const refresh = useCallback(async () => {
    try {
      setStatus(await geoStatus());
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function run(step: string, action: () => Promise<boolean>) {
    setBusy(step);
    stop.current = false;
    try {
      // Une étape « jusqu'au bout » s'arrête quand il ne reste rien, ou sur demande.
      while (!stop.current && (await action())) await refresh();
      await refresh();
    } catch (error) {
      toast.error("Import interrompu.", {
        description: error instanceof Error ? error.message : "Réessayez dans un instant.",
      });
    } finally {
      setBusy(null);
    }
  }

  const socle = () =>
    run("socle", async () => {
      const r = await importGeoSocle();
      toast.success(
        `${r.regions} régions, ${r.departements} départements, ${r.epcis} intercommunalités.`,
      );
      return false;
    });
  const communes = () =>
    run("communes", async () => {
      const r = await importGeoCommunes({ data: { lots: 3 } });
      if (r.departements.length)
        toast.success(`${r.communes} communes (${r.departements.join(", ")}).`);
      return r.departements.length > 0;
    });
  const voisins = () =>
    run("voisins", async () => {
      const r = await computeGeoNeighbours({ data: { limit: 300 } });
      return r.communes > 0;
    });

  const pending = status?.departements_sans_communes.length ?? 0;
  const noDeps = !status?.lieux.departement;

  return (
    <section aria-labelledby="referentiel" className="rounded-xl border border-border bg-card p-5">
      <h2 id="referentiel" className="text-lg font-semibold text-foreground">
        Référentiel géographique
      </h2>
      {failed ? (
        <p
          role="alert"
          className="mt-3 rounded-lg border border-destructive p-4 text-sm text-foreground"
        >
          L'état du référentiel n'a pas pu être lu. Vérifiez que le SQL du lot 11 est exécuté.
        </p>
      ) : !status ? (
        <p className="mt-3 text-sm text-muted-foreground">Chargement…</p>
      ) : (
        <>
          <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
            {KINDS.map((k) => (
              <div key={k.key} className="rounded-lg border border-border p-3">
                <dt className="text-xs text-muted-foreground">{k.label}</dt>
                <dd className="text-xl font-semibold text-foreground">
                  {new Intl.NumberFormat("fr-FR").format(status.lieux[k.key] ?? 0)}
                </dd>
              </div>
            ))}
            <div className="rounded-lg border border-border p-3">
              <dt className="text-xs text-muted-foreground">Voisinages</dt>
              <dd className="text-xl font-semibold text-foreground">
                {new Intl.NumberFormat("fr-FR").format(status.voisinages)}
              </dd>
            </div>
          </dl>
          <ol className="mt-5 space-y-3 text-sm">
            <li className="flex flex-wrap items-center gap-3">
              <span className="text-foreground">1. Régions, départements, intercommunalités</span>
              <Button
                size="sm"
                variant="outline"
                disabled={busy !== null}
                onClick={() => void socle()}
                title="Importer ou mettre à jour régions, départements et intercommunalités"
              >
                {busy === "socle" ? "Import…" : "Importer le socle"}
              </Button>
            </li>
            <li className="flex flex-wrap items-center gap-3">
              <span className="text-foreground">
                2. Communes : {pending} département{pending > 1 ? "s" : ""} à importer
              </span>
              <Button
                size="sm"
                variant="outline"
                disabled={busy !== null || noDeps || pending === 0}
                onClick={() => void communes()}
                title="Importer les communes, trois départements à la fois, jusqu'au dernier"
              >
                {busy === "communes" ? "Import…" : "Importer les communes"}
              </Button>
            </li>
            <li className="flex flex-wrap items-center gap-3">
              <span className="text-foreground">
                3. Voisinages : {new Intl.NumberFormat("fr-FR").format(status.voisins_a_calculer)}{" "}
                communes à calculer (25 km, 8 voisines au plus)
              </span>
              <Button
                size="sm"
                variant="outline"
                disabled={busy !== null || status.voisins_a_calculer === 0}
                onClick={() => void voisins()}
                title="Calculer les communes voisines, par paquets, jusqu'à la dernière"
              >
                {busy === "voisins" ? "Calcul…" : "Calculer les voisinages"}
              </Button>
            </li>
          </ol>
          {busy ? (
            <Button
              size="sm"
              variant="ghost"
              className="mt-3"
              onClick={() => (stop.current = true)}
              title="Arrêter après le paquet en cours (la reprise continue là où elle s'est arrêtée)"
            >
              Arrêter après ce paquet
            </Button>
          ) : null}
        </>
      )}
    </section>
  );
}
