import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { requireAdmin } from "../guard";
import { errorResult, textResult } from "../supabase";

export default defineTool({
  name: "record_audit",
  title: "Enregistrer un audit daté",
  description:
    "Enregistre un audit daté du site (libellé, score, résumé) et ses anomalies, afin de garder une mémoire entre deux audits.",
  inputSchema: {
    label: z.string().min(1).describe("Libellé de l'audit, par exemple « Audit Claude du 18/09 »."),
    score: z.number().int().min(0).max(100).optional().describe("Score obtenu sur 100."),
    summary: z.string().optional().describe("Résumé en français, sans jargon."),
    findings: z
      .array(
        z.object({
          code: z.string().min(1).describe("Code du point concerné, par exemple SEO-2."),
          severity: z.enum(["bloquant", "majeur", "mineur"]),
          location: z.string().describe("Fichier + ligne, ou page + élément visible."),
          description: z.string().describe("Anomalie constatée."),
        }),
      )
      .default([])
      .describe("Anomalies relevées."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async ({ label, score, summary, findings }, ctx) => {
    try {
      const supabase = await requireAdmin(ctx);
      const { data: audit, error } = await supabase
        .from("audits")
        .insert({
          label,
          max_score: 100,
          ...(score === undefined ? {} : { score }),
          ...(summary === undefined ? {} : { summary }),
        })
        .select("id, label, score, max_score, summary, performed_at")
        .single();
      if (error || !audit) return errorResult(error?.message ?? "Enregistrement impossible.");
      if (findings.length) {
        const { error: fErr } = await supabase.from("audit_findings").insert(
          findings.map((f) => ({
            audit_id: audit.id,
            code: f.code,
            severity: f.severity,
            location: f.location,
            description: f.description,
          })),
        );
        if (fErr)
          return errorResult(`Audit créé mais anomalies non enregistrées : ${fErr.message}`);
      }
      return textResult({ audit, anomalies_enregistrees: findings.length });
    } catch (e) {
      return errorResult((e as Error).message);
    }
  },
});
