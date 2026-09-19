import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { requireAdmin } from "../guard";
import { errorResult, textResult } from "../supabase";

export default defineTool({
  name: "update_template_check",
  title: "Mettre à jour un point de contrôle",
  description:
    "Met à jour l'état et le constat d'un point de contrôle de la grille de conformité, à partir de son code (ex. SEO-2).",
  inputSchema: {
    code: z.string().min(1).describe("Code du point de contrôle, par exemple NAV-1."),
    status: z
      .enum(["conforme", "a_corriger", "a_verifier", "non_applicable"])
      .optional()
      .describe("Nouvel état."),
    severity: z.enum(["bloquant", "majeur", "mineur"]).optional().describe("Gravité constatée."),
    evidence: z
      .string()
      .optional()
      .describe("Constat : fichier + ligne, ou page + élément visible."),
  },
  annotations: {
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
  },
  handler: async ({ code, status, severity, evidence }, ctx) => {
    try {
      const supabase = await requireAdmin(ctx);
      const patch: { status?: string; severity?: string; evidence?: string } = {};
      if (status) patch.status = status;
      if (severity) patch.severity = severity;
      if (evidence !== undefined) patch.evidence = evidence;
      if (Object.keys(patch).length === 0) return errorResult("Rien à mettre à jour.");
      const { data, error } = await supabase
        .from("template_checks")
        .update(patch)
        .eq("code", code)
        .select("code, area, label, status, severity, evidence")
        .maybeSingle();
      if (error) return errorResult(error.message);
      if (!data) return errorResult(`Aucun point de contrôle avec le code ${code}.`);
      return textResult(data);
    } catch (e) {
      return errorResult((e as Error).message);
    }
  },
});
