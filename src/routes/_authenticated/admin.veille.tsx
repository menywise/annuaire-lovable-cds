import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { AdminShell, useIsAdmin } from "@/components/cds/AdminShell";
import { ConfirmButton } from "@/components/cds/ConfirmButton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { isFeatureOn, requireFeature } from "@/config/features";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { downloadCsv } from "@/lib/csv";
import { formatDate } from "@/lib/format";
import { seo } from "@/lib/seo";
import { getSiteConfig } from "@/lib/site-config";
import {
  WATCH_REASON_LABEL,
  WATCH_SETTINGS_KEY,
  WATCH_STATUS_LABEL,
  WATCH_SUBMISSION_LABEL,
  isValidPattern,
  normalizeWatchSettings,
  type WatchSettings,
} from "@/lib/watch";
import {
  analyzeUrls,
  publishWatchSite,
  runChecks,
  runDiscovery,
  runSubmissions,
  watchConfig,
} from "@/lib/watch.functions";

export const Route = createFileRoute("/_authenticated/admin/veille")({
  beforeLoad: () => requireFeature("watch"),
  head: () =>
    seo({
      title: "Veille de sites",
      description: "Découverte de sites, technologies détectées, disponibilité et propositions.",
      path: "/admin/veille",
      noindex: true,
    }),
  component: AdminWatchPage,
});

const TABS = [
  { key: "bord", label: "Tableau de bord" },
  { key: "sites", label: "Sites" },
  { key: "propositions", label: "Propositions" },
  { key: "sources", label: "Sources" },
  { key: "refus", label: "Refus" },
  { key: "regles", label: "Règles" },
  { key: "reglages", label: "Réglages" },
] as const;
type TabKey = (typeof TABS)[number]["key"];

type AnalysisRow = { host: string; decision: string; message: string; score: number | null };

function tabClass(active: boolean) {
  return `min-h-11 rounded-md border px-3 text-sm ${
    active ? "border-primary bg-accent text-foreground" : "border-border text-muted-foreground"
  }`;
}

function errorText(err: unknown) {
  return err instanceof Error ? err.message : "Réessayez dans un instant.";
}

function AdminWatchPage() {
  const [tab, setTab] = useState<TabKey>("bord");
  return (
    <AdminShell
      title="Veille de sites"
      intro="Trouver des sites (recherche web, agents, propositions des membres), reconnaître leurs technologies et suivre leur disponibilité. Rien n'entre dans l'annuaire sans votre geste : « Publier » crée une fiche en brouillon."
    >
      <div className="flex flex-wrap gap-2">
        {TABS.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setTab(item.key)}
            aria-pressed={tab === item.key}
            title={`Afficher : ${item.label}`}
            className={tabClass(tab === item.key)}
          >
            {item.label}
          </button>
        ))}
      </div>
      <div className="mt-6">
        {tab === "bord" ? (
          <DashboardTab />
        ) : tab === "sites" ? (
          <SitesTab />
        ) : tab === "propositions" ? (
          <SubmissionsTab />
        ) : tab === "sources" ? (
          <SourcesTab />
        ) : tab === "refus" ? (
          <RejectsTab />
        ) : tab === "regles" ? (
          <DetectorsTab />
        ) : (
          <SettingsTab />
        )}
      </div>
    </AdminShell>
  );
}

// Tableau de bord ----------------------------------------------------------------------------------

type Status = Record<string, number>;

function AnalysisResults({ rows }: { rows: AnalysisRow[] }) {
  if (rows.length === 0) return null;
  return (
    <ul className="mt-3 space-y-1 text-sm">
      {rows.map((r) => (
        <li key={r.host} className="flex flex-wrap gap-2">
          <span className="font-medium text-foreground">{r.host}</span>
          <Badge variant={r.decision === "retenu" ? "default" : "secondary"}>
            {r.decision === "retenu" ? "Retenu" : r.decision === "refuse" ? "Refusé" : "Erreur"}
          </Badge>
          <span className="text-muted-foreground">{r.message}</span>
        </li>
      ))}
    </ul>
  );
}

function DashboardTab() {
  const isAdmin = useIsAdmin();
  const [status, setStatus] = useState<Status | null>(null);
  const [config, setConfig] = useState<{
    firecrawl: string;
    hooksSecret: boolean;
    cronSecret: boolean;
  } | null>(null);
  const [urls, setUrls] = useState("");
  const [force, setForce] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [results, setResults] = useState<AnalysisRow[]>([]);
  const siteUrl = getSiteConfig().brand.url || "https://votre-site";

  const load = useCallback(async () => {
    const { data } = await supabase.rpc("watch_status");
    setStatus((data ?? {}) as Status);
  }, []);

  useEffect(() => {
    if (!isAdmin) return;
    void load();
    watchConfig()
      .then(setConfig)
      .catch(() => setConfig({ firecrawl: "absent", hooksSecret: false, cronSecret: false }));
  }, [isAdmin, load]);

  async function run(label: string, action: () => Promise<string>) {
    setBusy(label);
    try {
      toast.success(await action());
    } catch (err) {
      toast.error("Action impossible.", { description: errorText(err) });
    } finally {
      setBusy(null);
      void load();
    }
  }

  async function analyze(event: React.FormEvent) {
    event.preventDefault();
    const list = urls
      .split(/[\s,;]+/)
      .map((u) => u.trim())
      .filter(Boolean);
    await run("analyse", async () => {
      const { results: rows, postponed } = await analyzeUrls({ data: { urls: list, force } });
      setResults(rows);
      if (rows.some((r) => r.decision === "retenu")) setUrls("");
      return `${rows.filter((r) => r.decision === "retenu").length} site(s) retenu(s) sur ${rows.length}${
        postponed.length ? `, ${postponed.length} reporté(s)` : ""
      }.`;
    });
  }

  const tiles: Array<[string, string]> = [
    ["sites", "Sites suivis"],
    ["en_ligne", "En ligne"],
    ["hors_ligne", "Hors ligne"],
    ["a_publier", "À publier"],
    ["propositions_en_attente", "Propositions en attente"],
    ["refus_7_jours", "Refus (7 jours)"],
    ["sources_actives", "Sources actives"],
    ["regles_actives", "Règles actives"],
  ];

  return (
    <div className="space-y-6">
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {tiles.map(([key, label]) => (
          <li key={key} className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="mt-1 text-2xl font-semibold text-foreground">
              {status ? (status[key] ?? 0) : "…"}
            </p>
          </li>
        ))}
      </ul>

      <section className="rounded-xl border border-border bg-card p-5">
        <h2 className="text-base font-semibold text-foreground">Analyser des adresses</h2>
        <form onSubmit={analyze} className="mt-3 space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="watch-urls">
              Une à cinq adresses (séparées par des espaces ou des retours à la ligne)
            </Label>
            <Textarea
              id="watch-urls"
              value={urls}
              onChange={(e) => setUrls(e.target.value)}
              rows={3}
              placeholder="exemple.fr"
            />
          </div>
          <label className="flex min-h-11 items-center gap-2 text-sm text-foreground">
            <input
              type="checkbox"
              className="size-4"
              checked={force}
              onChange={(e) => setForce(e.target.checked)}
            />
            Retenir même si les portiers refusent (empreinte, langue)
          </label>
          <Button
            type="submit"
            disabled={busy !== null || !urls.trim()}
            title="Analyser ces adresses maintenant"
          >
            {busy === "analyse" ? "Analyse en cours…" : "Analyser"}
          </Button>
        </form>
        <AnalysisResults rows={results} />
      </section>

      <section className="rounded-xl border border-border bg-card p-5">
        <h2 className="text-base font-semibold text-foreground">Lancer maintenant</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          La tâche planifiée fait la même chose à chaque passage, avec les volumes des réglages.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            variant="outline"
            disabled={busy !== null}
            title="Contrôler la disponibilité des sites vérifiés depuis le plus longtemps"
            onClick={() =>
              void run("controle", async () => {
                const r = await runChecks({ data: { limit: 25 } });
                return `${r.checked} site(s) contrôlé(s), ${r.hors_ligne} hors ligne.`;
              })
            }
          >
            {busy === "controle" ? "Contrôle…" : "Contrôler 25 sites"}
          </Button>
          <Button
            variant="outline"
            disabled={busy !== null}
            title="Analyser les propositions des membres en attente"
            onClick={() =>
              void run("file", async () => {
                const r = await runSubmissions();
                return `${r.processed} proposition(s) traitée(s).`;
              })
            }
          >
            {busy === "file" ? "Traitement…" : "Traiter les propositions"}
          </Button>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-5 text-sm">
        <h2 className="text-base font-semibold text-foreground">Configuration</h2>
        {config === null ? (
          <p className="mt-2 text-muted-foreground">Chargement…</p>
        ) : (
          <ul className="mt-3 space-y-2 text-muted-foreground">
            <li>
              Firecrawl (recherche web, rendu complet des pages) :{" "}
              {config.firecrawl === "absent" ? (
                <span className="font-medium text-destructive-text">absent</span>
              ) : (
                <span className="font-medium text-foreground">
                  configuré (
                  {config.firecrawl === "direct" ? "compte Firecrawl" : "connecteur Lovable"})
                </span>
              )}
              . Sans lui, la recherche est indisponible et les pages sont lues par simple requête.
            </li>
            <li>
              Accès des agents (Letta, Cowork) :{" "}
              {config.hooksSecret ? (
                <span className="font-medium text-foreground">secret configuré</span>
              ) : (
                <span className="font-medium text-destructive-text">
                  secret WATCH_HOOKS_SECRET absent (24 caractères au moins)
                </span>
              )}
              . Adresse :{" "}
              <code className="break-all rounded bg-muted px-1.5 py-0.5 text-foreground">
                {siteUrl}/api/hooks/veille
              </code>
              , en-tête{" "}
              <code className="rounded bg-muted px-1.5 py-0.5 text-foreground">x-hook-secret</code>.
            </li>
            <li>
              Tâche planifiée :{" "}
              {config.cronSecret ? (
                <span className="font-medium text-foreground">secret des tâches présent</span>
              ) : (
                <span className="font-medium text-destructive-text">
                  LOVABLE_CRON_SECRET absent
                </span>
              )}
              . À programmer toutes les heures : POST{" "}
              <code className="break-all rounded bg-muted px-1.5 py-0.5 text-foreground">
                {siteUrl}/api/cron/veille
              </code>
              .
            </li>
          </ul>
        )}
      </section>
    </div>
  );
}

// Sites ----------------------------------------------------------------------------------------------

type Site = {
  id: string;
  host: string;
  url: string;
  title: string;
  status: string;
  http_status: number | null;
  gate_score: number;
  language_score: number;
  stack: Json;
  source: string;
  listing_id: string | null;
  last_checked_at: string | null;
  last_analyzed_at: string | null;
};

function stackNames(stack: Json) {
  return Array.isArray(stack)
    ? stack
        .map((t) =>
          t && typeof t === "object" && !Array.isArray(t) && "name" in t ? String(t["name"]) : "",
        )
        .filter(Boolean)
    : [];
}

function SitesTab() {
  const [sites, setSites] = useState<Site[] | null>(null);
  const [filter, setFilter] = useState<"tous" | "a_publier" | "hors_ligne">("tous");
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const directoryOn = isFeatureOn("directory");

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from("watch_sites")
      .select(
        "id, host, url, title, status, http_status, gate_score, language_score, stack, source, listing_id, last_checked_at, last_analyzed_at",
      )
      .order("created_at", { ascending: false })
      .limit(1000);
    if (error) toast.error("Sites non chargés.");
    setSites((data ?? []) as Site[]);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function reanalyze(site: Site) {
    setBusy(site.id);
    try {
      const { results } = await analyzeUrls({ data: { urls: [site.url], force: true } });
      toast.success(results[0]?.message ?? "Analyse terminée.");
    } catch (err) {
      toast.error("Analyse impossible.", { description: errorText(err) });
    } finally {
      setBusy(null);
      void load();
    }
  }

  async function publish(site: Site) {
    setBusy(site.id);
    try {
      await publishWatchSite({ data: { siteId: site.id } });
      toast.success("Fiche créée en brouillon dans l'annuaire.", {
        description: "Complétez-la puis publiez-la depuis l'écran Annuaire.",
      });
    } catch (err) {
      toast.error("Publication impossible.", { description: errorText(err) });
    } finally {
      setBusy(null);
      void load();
    }
  }

  async function remove(site: Site) {
    const { error } = await supabase.from("watch_sites").delete().eq("id", site.id);
    if (error) toast.error("Suppression impossible.");
    else toast.success("Site retiré de la veille.");
    void load();
  }

  const needle = query.trim().toLowerCase();
  const visible = (sites ?? []).filter(
    (s) =>
      (filter === "tous" || (filter === "a_publier" ? !s.listing_id : s.status !== "en_ligne")) &&
      (!needle ||
        `${s.host} ${s.title} ${stackNames(s.stack).join(" ")}`.toLowerCase().includes(needle)),
  );

  return (
    <>
      <div className="flex flex-wrap items-end gap-2">
        {(
          [
            ["tous", "Tous"],
            ["a_publier", "À publier"],
            ["hors_ligne", "Hors ligne ou instables"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setFilter(key)}
            aria-pressed={filter === key}
            className={tabClass(filter === key)}
          >
            {label}
          </button>
        ))}
        <div className="ml-auto w-full max-w-xs space-y-1 sm:w-auto">
          <Label htmlFor="watch-sites-search">Rechercher</Label>
          <Input
            id="watch-sites-search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Domaine, titre, technologie"
          />
        </div>
        <Button
          variant="outline"
          disabled={!sites?.length}
          title="Télécharger les sites suivis au format tableur"
          onClick={() =>
            downloadCsv(
              "veille-sites.csv",
              (sites ?? []).map((s) => ({
                domaine: s.host,
                titre: s.title,
                etat: WATCH_STATUS_LABEL[s.status] ?? s.status,
                code_http: s.http_status ?? "",
                empreinte: s.gate_score,
                technologies: stackNames(s.stack).join(" ; "),
                source: s.source,
                publie: s.listing_id ? "oui" : "non",
                controle_le: s.last_checked_at ?? "",
              })),
            )
          }
        >
          Export CSV
        </Button>
      </div>
      <p className="mt-3 text-xs text-muted-foreground" aria-live="polite">
        {sites === null
          ? "Chargement…"
          : `${visible.length} site(s) affiché(s) sur ${sites.length}.`}
      </p>
      {sites !== null && visible.length === 0 ? (
        <p className="mt-4 rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          Aucun site dans cette vue.
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {visible.map((site) => (
            <li key={site.id} className="rounded-xl border border-border bg-card p-4">
              <div className="flex flex-wrap items-center gap-2">
                <a
                  href={site.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-semibold text-foreground hover:underline"
                  title={`Ouvrir ${site.host} dans un nouvel onglet`}
                >
                  {site.host}
                </a>
                <Badge variant={site.status === "en_ligne" ? "default" : "secondary"}>
                  {WATCH_STATUS_LABEL[site.status] ?? site.status}
                  {site.http_status ? ` · ${site.http_status}` : ""}
                </Badge>
                {site.gate_score > 0 ? (
                  <Badge variant="outline">Empreinte {site.gate_score}</Badge>
                ) : null}
                {site.listing_id ? <Badge variant="outline">Dans l'annuaire</Badge> : null}
              </div>
              {site.title ? (
                <p className="mt-1 text-sm text-muted-foreground">{site.title}</p>
              ) : null}
              <p className="mt-1 text-xs text-muted-foreground">
                {stackNames(site.stack).join(" · ") || "Aucune technologie reconnue"} · source :{" "}
                {site.source} · contrôlé le {formatDate(site.last_checked_at)}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy === site.id}
                  onClick={() => void reanalyze(site)}
                  title={`Analyser à nouveau ${site.host}`}
                >
                  {busy === site.id ? "…" : "Réanalyser"}
                </Button>
                {directoryOn && !site.listing_id ? (
                  <Button
                    size="sm"
                    disabled={busy === site.id}
                    onClick={() => void publish(site)}
                    title={`Créer la fiche de ${site.host} en brouillon dans l'annuaire`}
                  >
                    Publier dans l'annuaire
                  </Button>
                ) : null}
                {site.listing_id ? (
                  <Button
                    asChild
                    size="sm"
                    variant="outline"
                    title="Ouvrir l'écran Annuaire pour compléter la fiche"
                  >
                    <Link to="/admin/annuaire">Voir la fiche</Link>
                  </Button>
                ) : null}
                <ConfirmButton
                  label="Retirer"
                  title={`Retirer ${site.host} de la veille`}
                  question={`Retirer ${site.host} de la veille ?`}
                  detail="Son historique de disponibilité est effacé. Une fiche déjà créée dans l'annuaire reste en place."
                  confirmLabel="Retirer"
                  onConfirm={() => remove(site)}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

// Propositions ---------------------------------------------------------------------------------------

type Submission = {
  id: string;
  url: string;
  host: string;
  note: string;
  status: string;
  created_at: string;
  processed_at: string | null;
  result: Json | null;
};

function SubmissionsTab() {
  const [rows, setRows] = useState<Submission[] | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("watch_submissions")
      .select("id, url, host, note, status, created_at, processed_at, result")
      .order("created_at", { ascending: false })
      .limit(300);
    setRows((data ?? []) as Submission[]);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function process() {
    setBusy(true);
    try {
      const r = await runSubmissions();
      toast.success(`${r.processed} proposition(s) traitée(s).`);
    } catch (err) {
      toast.error("Traitement impossible.", { description: errorText(err) });
    } finally {
      setBusy(false);
      void load();
    }
  }

  const pending = (rows ?? []).filter((r) => r.status === "en_attente").length;
  const message = (r: Json | null) =>
    r && typeof r === "object" && !Array.isArray(r) && typeof r["message"] === "string"
      ? r["message"]
      : "";

  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-sm text-muted-foreground">
          Les membres proposent des sites depuis la page « Proposer un site ». {pending} en attente.
        </p>
        <Button
          className="ml-auto"
          disabled={busy || pending === 0}
          onClick={() => void process()}
          title="Analyser les propositions en attente"
        >
          {busy ? "Traitement…" : "Traiter maintenant"}
        </Button>
      </div>
      {rows === null ? (
        <p className="mt-4 text-sm text-muted-foreground">Chargement…</p>
      ) : rows.length === 0 ? (
        <p className="mt-4 rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          Aucune proposition pour le moment.
        </p>
      ) : (
        <ul className="mt-4 space-y-2">
          {rows.map((row) => (
            <li key={row.id} className="rounded-xl border border-border bg-card p-4 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold text-foreground">{row.host}</span>
                <Badge variant={row.status === "acceptee" ? "default" : "secondary"}>
                  {WATCH_SUBMISSION_LABEL[row.status] ?? row.status}
                </Badge>
                <span className="ml-auto text-xs text-muted-foreground">
                  {formatDate(row.created_at)}
                </span>
              </div>
              {row.note ? <p className="mt-1 text-muted-foreground">« {row.note} »</p> : null}
              {message(row.result) ? (
                <p className="mt-1 text-xs text-muted-foreground">{message(row.result)}</p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

// Sources ----------------------------------------------------------------------------------------------

type Source = {
  id: string;
  label: string;
  query: string;
  enabled: boolean;
  last_run_at: string | null;
  run_count: number;
  found_count: number;
};

function SourcesTab() {
  const [rows, setRows] = useState<Source[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [results, setResults] = useState<AnalysisRow[]>([]);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("watch_sources")
      .select("id, label, query, enabled, last_run_at, run_count, found_count")
      .order("label");
    setRows((data ?? []) as Source[]);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function add(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const { error } = await supabase.from("watch_sources").insert({
      label: String(data.get("label") ?? "").trim(),
      query: String(data.get("query") ?? "").trim(),
    });
    if (error) {
      toast.error("Source non créée.", {
        description:
          error.code === "23505"
            ? "Cette requête existe déjà."
            : "Nom de 2 à 80 caractères, requête de 3 à 300.",
      });
      return;
    }
    form.reset();
    toast.success("Source créée.");
    void load();
  }

  async function launch(source: Source) {
    setBusy(source.id);
    try {
      const r = await runDiscovery({ data: { sourceId: source.id } });
      setResults(r.results);
      toast.success(`${r.found} domaine(s) trouvé(s), ${r.new} nouveau(x), ${r.added} retenu(s).`);
    } catch (err) {
      toast.error("Recherche impossible.", { description: errorText(err) });
    } finally {
      setBusy(null);
      void load();
    }
  }

  async function toggle(source: Source, enabled: boolean) {
    const { error } = await supabase.from("watch_sources").update({ enabled }).eq("id", source.id);
    if (error) toast.error("Modification non enregistrée.");
    void load();
  }

  async function remove(source: Source) {
    const { error } = await supabase.from("watch_sources").delete().eq("id", source.id);
    if (error) toast.error("Suppression impossible.");
    else toast.success("Source supprimée.");
    void load();
  }

  return (
    <>
      <form
        onSubmit={add}
        className="grid gap-3 rounded-xl border border-border bg-card p-5 sm:grid-cols-[1fr_2fr_auto] sm:items-end"
      >
        <div className="space-y-1.5">
          <Label htmlFor="source-label">Nom</Label>
          <Input
            id="source-label"
            name="label"
            required
            minLength={2}
            maxLength={80}
            placeholder="Sites Lovable en France"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="source-query">Requête de recherche web</Label>
          <Input
            id="source-query"
            name="query"
            required
            minLength={3}
            maxLength={300}
            placeholder="site:lovable.app artisan"
          />
        </div>
        <Button type="submit" title="Ajouter cette source">
          Ajouter
        </Button>
      </form>
      <p className="mt-3 text-xs text-muted-foreground">
        La tâche planifiée lance à chaque passage les sources actives les plus anciennes. Chaque
        recherche et chaque analyse consomment des crédits Firecrawl.
      </p>
      {rows === null ? (
        <p className="mt-4 text-sm text-muted-foreground">Chargement…</p>
      ) : rows.length === 0 ? (
        <p className="mt-4 rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          Aucune source pour le moment.
        </p>
      ) : (
        <ul className="mt-4 space-y-2">
          {rows.map((source) => (
            <li key={source.id} className="rounded-xl border border-border bg-card p-4 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold text-foreground">{source.label}</span>
                <code className="rounded bg-muted px-1.5 py-0.5 text-xs text-foreground">
                  {source.query}
                </code>
                <label className="ml-auto flex min-h-11 items-center gap-2 text-xs text-muted-foreground">
                  <Switch
                    checked={source.enabled}
                    onCheckedChange={(on) => void toggle(source, on)}
                    aria-label={`Activer ${source.label}`}
                  />
                  Active
                </label>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {source.run_count} passage(s), {source.found_count} site(s) retenu(s)
                {source.last_run_at
                  ? ` · dernier le ${formatDate(source.last_run_at)}`
                  : " · jamais lancée"}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy !== null}
                  onClick={() => void launch(source)}
                  title={`Lancer la recherche ${source.label}`}
                >
                  {busy === source.id ? "Recherche…" : "Lancer maintenant"}
                </Button>
                <ConfirmButton
                  title={`Supprimer ${source.label}`}
                  question={`Supprimer la source « ${source.label} » ?`}
                  onConfirm={() => remove(source)}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
      <AnalysisResults rows={results} />
    </>
  );
}

// Refus ------------------------------------------------------------------------------------------------

type Reject = {
  id: string;
  host: string;
  url: string;
  reason: string;
  score: number | null;
  detail: Json;
  source: string;
  created_at: string;
};

function RejectsTab() {
  const [rows, setRows] = useState<Reject[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("watch_rejects")
      .select("id, host, url, reason, score, detail, source, created_at")
      .order("created_at", { ascending: false })
      .limit(300);
    setRows((data ?? []) as Reject[]);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function accept(row: Reject) {
    setBusy(row.id);
    try {
      const { results } = await analyzeUrls({ data: { urls: [row.url], force: true } });
      if (results[0]?.decision === "retenu") {
        await supabase.from("watch_rejects").delete().eq("host", row.host);
        toast.success(`${row.host} retenu.`);
      } else {
        toast.error("Analyse impossible.", { description: results[0]?.message });
      }
    } catch (err) {
      toast.error("Analyse impossible.", { description: errorText(err) });
    } finally {
      setBusy(null);
      void load();
    }
  }

  const motif = (d: Json) =>
    d && typeof d === "object" && !Array.isArray(d) && typeof d["motif"] === "string"
      ? d["motif"]
      : "";

  return rows === null ? (
    <p className="text-sm text-muted-foreground">Chargement…</p>
  ) : rows.length === 0 ? (
    <p className="rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
      Aucun refus enregistré.
    </p>
  ) : (
    <ul className="space-y-2">
      {rows.map((row) => (
        <li key={row.id} className="rounded-xl border border-border bg-card p-4 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-foreground">{row.host}</span>
            <Badge variant="secondary">{WATCH_REASON_LABEL[row.reason] ?? row.reason}</Badge>
            {row.score !== null ? <Badge variant="outline">Score {row.score}</Badge> : null}
            <span className="ml-auto text-xs text-muted-foreground">
              {formatDate(row.created_at)} · {row.source}
            </span>
          </div>
          {motif(row.detail) ? (
            <p className="mt-1 text-xs text-muted-foreground">{motif(row.detail)}</p>
          ) : null}
          {row.reason !== "adresse" ? (
            <Button
              className="mt-3"
              size="sm"
              variant="outline"
              disabled={busy !== null}
              onClick={() => void accept(row)}
              title={`Retenir ${row.host} malgré le refus`}
            >
              {busy === row.id ? "Analyse…" : "Retenir quand même"}
            </Button>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

// Règles de détection -----------------------------------------------------------------------------------

type Detector = {
  id: string;
  code: string;
  name: string;
  kind: string;
  target: string;
  selector: string;
  pattern: string;
  weight: number;
  enabled: boolean;
};

const TARGET_LABEL: Record<string, string> = {
  html: "Motif dans la page",
  header: "En-tête de réponse",
  path: "Adresse qui répond",
};

function DetectorsTab() {
  const [rows, setRows] = useState<Detector[] | null>(null);
  const [target, setTarget] = useState("html");

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("watch_detectors")
      .select("id, code, name, kind, target, selector, pattern, weight, enabled")
      .order("weight", { ascending: false })
      .order("name");
    setRows((data ?? []) as Detector[]);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function add(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const pattern = String(data.get("pattern") ?? "").trim();
    if (!isValidPattern(pattern)) {
      toast.error("Motif invalide : vérifiez l'expression régulière.");
      return;
    }
    const name = String(data.get("name") ?? "").trim();
    const { error } = await supabase.from("watch_detectors").insert({
      code: String(data.get("code") ?? "")
        .trim()
        .toLowerCase(),
      name,
      kind: String(data.get("kind") ?? "").trim() || "autre",
      target,
      selector:
        target === "html"
          ? ""
          : String(data.get("selector") ?? "")
              .trim()
              .toLowerCase(),
      pattern,
      weight: Math.min(100, Math.max(0, Math.floor(Number(data.get("weight") ?? 0) || 0))),
    });
    if (error) {
      toast.error("Règle non créée.", {
        description:
          error.code === "23505"
            ? "Ce code existe déjà."
            : "Code en minuscules et tirets ; motif obligatoire pour la page ; chemin commençant par / ; en-tête en minuscules.",
      });
      return;
    }
    form.reset();
    toast.success("Règle créée.");
    void load();
  }

  async function toggle(row: Detector, enabled: boolean) {
    const { error } = await supabase.from("watch_detectors").update({ enabled }).eq("id", row.id);
    if (error) toast.error("Modification non enregistrée.");
    void load();
  }

  async function remove(row: Detector) {
    const { error } = await supabase.from("watch_detectors").delete().eq("id", row.id);
    if (error) toast.error("Suppression impossible.");
    else toast.success("Règle supprimée.");
    void load();
  }

  return (
    <>
      <form
        onSubmit={add}
        className="grid gap-3 rounded-xl border border-border bg-card p-5 sm:grid-cols-3"
      >
        <div className="space-y-1.5">
          <Label htmlFor="det-code">Code</Label>
          <Input id="det-code" name="code" required maxLength={60} placeholder="wordpress-rest" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="det-name">Technologie</Label>
          <Input id="det-name" name="name" required maxLength={80} placeholder="WordPress" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="det-kind">Famille</Label>
          <Input id="det-kind" name="kind" maxLength={40} placeholder="plateforme" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="det-target">Où chercher</Label>
          <select
            id="det-target"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            className="h-10 w-full rounded-md border border-border bg-card px-3 text-sm text-foreground"
          >
            {Object.entries(TARGET_LABEL).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        {target !== "html" ? (
          <div className="space-y-1.5">
            <Label htmlFor="det-selector">
              {target === "path" ? "Chemin (ex. /wp-json/)" : "Nom de l'en-tête"}
            </Label>
            <Input id="det-selector" name="selector" required maxLength={200} />
          </div>
        ) : null}
        <div className="space-y-1.5">
          <Label htmlFor="det-pattern">
            {target === "html"
              ? "Motif (expression régulière)"
              : "Motif facultatif (valeur ou type de contenu)"}
          </Label>
          <Input id="det-pattern" name="pattern" required={target === "html"} maxLength={500} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="det-weight">Poids d'empreinte (0 = simple détection)</Label>
          <Input id="det-weight" name="weight" type="number" min="0" max="100" defaultValue="0" />
        </div>
        <div className="sm:col-span-3">
          <Button type="submit" title="Ajouter cette règle de détection">
            Ajouter la règle
          </Button>
        </div>
      </form>
      <p className="mt-3 text-xs text-muted-foreground">
        Le score d'empreinte d'un site est la somme des poids des règles qu'il déclenche. Il est
        comparé au seuil des réglages. Les règles de départ reprennent les empreintes Lovable de
        l'annuaire des sites.
      </p>
      {rows === null ? (
        <p className="mt-4 text-sm text-muted-foreground">Chargement…</p>
      ) : (
        <ul className="mt-4 divide-y divide-border rounded-xl border border-border bg-card">
          {rows.map((row) => (
            <li key={row.id} className="flex flex-wrap items-center gap-2 p-3 text-sm">
              <span className="font-medium text-foreground">{row.name}</span>
              <code className="rounded bg-muted px-1.5 py-0.5 text-xs text-foreground">
                {row.code}
              </code>
              <span className="text-xs text-muted-foreground">
                {TARGET_LABEL[row.target] ?? row.target}
                {row.selector ? ` ${row.selector}` : ""}
                {row.weight > 0 ? ` · poids ${row.weight}` : ""}
              </span>
              <label className="ml-auto flex min-h-11 items-center gap-2 text-xs text-muted-foreground">
                <Switch
                  checked={row.enabled}
                  onCheckedChange={(on) => void toggle(row, on)}
                  aria-label={`Activer la règle ${row.code}`}
                />
                Active
              </label>
              <ConfirmButton
                title={`Supprimer la règle ${row.code}`}
                question={`Supprimer la règle « ${row.code} » ?`}
                onConfirm={() => remove(row)}
              />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

// Réglages -------------------------------------------------------------------------------------------

const SETTING_FIELDS: Array<{ key: keyof WatchSettings; label: string; min: number; max: number }> =
  [
    {
      key: "gate_min_score",
      label: "Score d'empreinte minimal pour retenir un site (0 = tout accepter)",
      min: 0,
      max: 500,
    },
    {
      key: "prefilter_min_score",
      label: "Préfiltre réseau avant la lecture payante (0 = aucun)",
      min: 0,
      max: 500,
    },
    {
      key: "min_language_score",
      label: "Score de francophonie minimal (si la langue n'est pas déclarée)",
      min: 0,
      max: 100,
    },
    { key: "search_limit", label: "Résultats par recherche web", min: 1, max: 20 },
    { key: "sources_per_run", label: "Sources lancées par passage planifié", min: 0, max: 10 },
    { key: "checks_per_run", label: "Sites contrôlés par passage planifié", min: 0, max: 60 },
    {
      key: "submissions_per_run",
      label: "Propositions traitées par passage planifié",
      min: 0,
      max: 10,
    },
  ];

function SettingsTab() {
  const [settings, setSettings] = useState<WatchSettings | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void supabase
      .from("site_settings")
      .select("value")
      .eq("key", WATCH_SETTINGS_KEY)
      .maybeSingle()
      .then(({ data }) => setSettings(normalizeWatchSettings(data?.value)));
  }, []);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!settings) return;
    const next = normalizeWatchSettings(settings);
    setSaving(true);
    const { data: userData } = await supabase.auth.getUser();
    const { error } = await supabase.from("site_settings").upsert(
      {
        key: WATCH_SETTINGS_KEY,
        value: next as unknown as Json,
        updated_at: new Date().toISOString(),
        updated_by: userData.user?.id ?? null,
      },
      { onConflict: "key" },
    );
    setSaving(false);
    if (error) toast.error("Réglages non enregistrés.");
    else {
      setSettings(next);
      toast.success("Réglages enregistrés.");
    }
  }

  if (!settings) return <p className="text-sm text-muted-foreground">Chargement…</p>;

  return (
    <form
      onSubmit={save}
      className="grid max-w-[720px] gap-4 rounded-xl border border-border bg-card p-5"
    >
      {SETTING_FIELDS.map((field) => (
        <div key={field.key} className="space-y-1.5">
          <Label htmlFor={`watch-${field.key}`}>{field.label}</Label>
          <Input
            id={`watch-${field.key}`}
            type="number"
            min={field.min}
            max={field.max}
            value={String(settings[field.key] ?? "")}
            onChange={(e) =>
              setSettings({ ...settings, [field.key]: Math.floor(Number(e.target.value)) })
            }
          />
        </div>
      ))}
      <label className="flex min-h-11 items-center gap-2 text-sm text-foreground">
        <input
          type="checkbox"
          className="size-4"
          checked={settings.language === "fr"}
          onChange={(e) => setSettings({ ...settings, language: e.target.checked ? "fr" : null })}
        />
        Ne retenir que les sites francophones
      </label>
      <p className="text-xs text-muted-foreground">
        Pour l'annuaire des sites Lovable : seuil 50 et préfiltre 50 (l'empreinte /~flock.js suffit
        à passer le préfiltre et économise la lecture payante des autres sites).
      </p>
      <div>
        <Button type="submit" disabled={saving} title="Enregistrer les réglages de la veille">
          {saving ? "Enregistrement…" : "Enregistrer"}
        </Button>
      </div>
    </form>
  );
}
