export type TemplateCheck = {
  id: string;
  code: string;
  area: string;
  label: string;
  requirement: string;
  status: string;
  severity: string;
  evidence: string;
  position: number;
};

export const checkStatusLabel: Record<string, string> = {
  conforme: "Conforme",
  a_corriger: "À corriger",
  a_verifier: "À vérifier",
  non_applicable: "Mis en pause",
};

const statusClass: Record<string, string> = {
  conforme: "border-success-text text-success-text",
  a_corriger: "border-destructive text-destructive-text",
  a_verifier: "border-warning-text text-warning-text",
  non_applicable: "border-border text-muted-foreground",
};

export function CheckStatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`rounded border px-2 py-0.5 text-[11px] font-medium ${
        statusClass[status] ?? statusClass["non_applicable"]
      }`}
    >
      {checkStatusLabel[status] ?? status}
    </span>
  );
}

/** Score de complétude : les points mis en pause sortent du calcul. */
export function conformityScore(checks: TemplateCheck[]) {
  const counted = checks.filter((check) => check.status !== "non_applicable");
  const ok = counted.filter((check) => check.status === "conforme").length;
  const percent = counted.length === 0 ? 0 : Math.round((ok / counted.length) * 100);
  return {
    ok,
    total: counted.length,
    percent,
    paused: checks.length - counted.length,
    toFix: checks.filter((check) => check.status === "a_corriger").length,
    toCheck: checks.filter((check) => check.status === "a_verifier").length,
  };
}

export function ConformitySummary({ checks }: { checks: TemplateCheck[] }) {
  const score = conformityScore(checks);
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex flex-wrap items-baseline gap-3">
        <p className="text-3xl font-bold text-primary-text">{score.percent}%</p>
        <p className="text-sm text-muted-foreground">
          {score.ok} points conformes sur {score.total} contrôlés
        </p>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        {score.toFix} à corriger — {score.toCheck} à vérifier — {score.paused} en pause
      </p>
      <div
        className="mt-3 h-2 w-full overflow-hidden rounded bg-muted"
        role="img"
        aria-label={`Complétude du modèle : ${score.percent} pour cent`}
      >
        <div className="h-full rounded bg-primary" style={{ width: `${score.percent}%` }} />
      </div>
    </div>
  );
}

export function groupByArea(checks: TemplateCheck[]) {
  const areas = [...new Set(checks.map((check) => check.area))];
  return areas.map((area) => ({ area, items: checks.filter((check) => check.area === area) }));
}
