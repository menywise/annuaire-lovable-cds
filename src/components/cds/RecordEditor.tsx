import { useState } from "react";
import { toast } from "sonner";
import { ImageField } from "@/components/cds/MediaPicker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

/**
 * CDS — Formulaire d'édition générique de l'administration.
 * Les champs sont décrits une fois ; les conversions (étiquettes, euros, dates, vide → null)
 * sont faites ici pour que chaque écran n'écrive que la description de ses champs.
 */

export type FieldSpec = {
  key: string;
  label: string;
  type:
    | "text"
    | "textarea"
    | "number"
    | "euros"
    | "url"
    | "email"
    | "select"
    | "image"
    | "tags"
    | "datetime"
    | "checkbox";
  options?: ReadonlyArray<{ value: string; label: string }>;
  required?: boolean;
  wide?: boolean;
  hint?: string;
  /** Champ texte facultatif : vide enregistré comme `null` (colonnes nullables). */
  nullable?: boolean;
};

type Values = Record<string, unknown>;

/** Valeur en base → valeur du champ. */
function toField(spec: FieldSpec, value: unknown): string | boolean {
  switch (spec.type) {
    case "checkbox":
      return Boolean(value);
    case "tags":
      return Array.isArray(value) ? value.join(", ") : "";
    case "euros":
      return typeof value === "number" ? String(value / 100) : "0";
    case "number":
      return typeof value === "number" ? String(value) : "";
    case "datetime": {
      if (typeof value !== "string" || !value) return "";
      const d = new Date(value);
      const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
      return local.toISOString().slice(0, 16);
    }
    default:
      return typeof value === "string" ? value : value == null ? "" : String(value);
  }
}

/** Valeur du champ → valeur en base. */
function fromField(spec: FieldSpec, value: string | boolean): unknown {
  if (spec.type === "checkbox") return Boolean(value);
  const text = String(value).trim();
  switch (spec.type) {
    case "tags":
      return text
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
    case "euros":
      return Math.max(0, Math.round(Number(text.replace(",", ".") || 0) * 100));
    case "number":
      return text === "" ? (spec.nullable ? null : 0) : Number(text);
    case "datetime":
      return text ? new Date(text).toISOString() : null;
    case "select":
      return text === "" && spec.nullable ? null : text;
    default:
      return text === "" && spec.nullable ? null : text;
  }
}

export function RecordEditor({
  idPrefix,
  fields,
  values,
  onSave,
  onCancel,
  submitLabel = "Enregistrer",
}: {
  idPrefix: string;
  fields: ReadonlyArray<FieldSpec>;
  values: Values;
  onSave: (changes: Values) => Promise<boolean>;
  onCancel?: () => void;
  submitLabel?: string;
}) {
  const [draft, setDraft] = useState<Record<string, string | boolean>>(() =>
    Object.fromEntries(fields.map((f) => [f.key, toField(f, values[f.key])])),
  );
  const [saving, setSaving] = useState(false);
  const id = (key: string) => `${idPrefix}-${key}`;
  const set = (key: string, value: string | boolean) => setDraft((d) => ({ ...d, [key]: value }));

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const missing = fields.find((f) => f.required && !String(draft[f.key] ?? "").trim());
    if (missing) {
      toast.error(`« ${missing.label} » est obligatoire.`);
      return;
    }
    const changes = Object.fromEntries(
      fields.map((f) => [f.key, fromField(f, draft[f.key] ?? "")]),
    );
    setSaving(true);
    await onSave(changes);
    setSaving(false);
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        {fields.map((f) => {
          const span = f.wide || f.type === "textarea" || f.type === "image" ? "sm:col-span-2" : "";
          const value = draft[f.key];
          if (f.type === "image") {
            return (
              <div key={f.key} className={span}>
                <ImageField
                  id={id(f.key)}
                  label={f.label}
                  value={String(value ?? "")}
                  onChange={(v) => set(f.key, v)}
                />
              </div>
            );
          }
          if (f.type === "checkbox") {
            return (
              <label
                key={f.key}
                className={`flex min-h-11 items-center gap-2 text-sm text-foreground ${span}`}
              >
                <input
                  type="checkbox"
                  className="h-4 w-4"
                  checked={Boolean(value)}
                  onChange={(e) => set(f.key, e.target.checked)}
                />
                {f.label}
              </label>
            );
          }
          return (
            <div key={f.key} className={`space-y-1.5 ${span}`}>
              <Label htmlFor={id(f.key)}>
                {f.label}
                {f.type === "euros" ? " (€)" : ""}
              </Label>
              {f.type === "textarea" ? (
                <Textarea
                  id={id(f.key)}
                  rows={5}
                  value={String(value ?? "")}
                  onChange={(e) => set(f.key, e.target.value)}
                />
              ) : f.type === "select" ? (
                <select
                  id={id(f.key)}
                  value={String(value ?? "")}
                  onChange={(e) => set(f.key, e.target.value)}
                  className="h-10 w-full rounded-md border border-border bg-card px-3 text-sm text-foreground"
                >
                  {f.nullable ? <option value="">—</option> : null}
                  {(f.options ?? []).map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              ) : (
                <Input
                  id={id(f.key)}
                  type={
                    f.type === "number" || f.type === "euros"
                      ? "number"
                      : f.type === "datetime"
                        ? "datetime-local"
                        : f.type === "url" || f.type === "email"
                          ? f.type
                          : "text"
                  }
                  step={f.type === "euros" ? "0.01" : undefined}
                  min={f.type === "euros" ? "0" : undefined}
                  value={String(value ?? "")}
                  onChange={(e) => set(f.key, e.target.value)}
                  required={f.required}
                />
              )}
              {f.hint || f.type === "tags" ? (
                <p className="text-xs text-muted-foreground">
                  {f.hint ?? "Séparées par des virgules."}
                </p>
              ) : null}
            </div>
          );
        })}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" size="sm" disabled={saving}>
          {saving ? "Enregistrement…" : submitLabel}
        </Button>
        {onCancel ? (
          <Button type="button" size="sm" variant="outline" onClick={onCancel}>
            Annuler
          </Button>
        ) : null}
      </div>
    </form>
  );
}
