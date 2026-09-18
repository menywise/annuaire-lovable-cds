import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { requireAdmin } from "../guard";
import { errorResult, textResult } from "../supabase";

export default defineTool({
  name: "list_template_checks",
  title: "Grille de conformité",
  description:
    "Liste les points de contrôle du modèle CDS (domaine, exigence, état, gravité, constat) et calcule le score de conformité.",
  inputSchema: {
    area: z.string().optional().describe("Filtrer sur un domaine (NAV, CNT, SEO, DES...)."),
    status: z
      .enum(["conforme", "a_corriger", "a_verifier", "non_applicable"])
      .optional()
      .describe("Filtrer sur un état."),
  },
  annotations: { readOnlyHint: true, openWorldHint: false },
  handler: async ({ area, status }, ctx) => {
    try {
      const supabase = await requireAdmin(ctx);
      let query = supabase
        .from("template_checks")
        .select("code, area, label, requirement, status, severity, evidence, position")
        .order("area", { ascending: true })
        .order("position", { ascending: true });
      if (area) query = query.ilike("area", `${area}%`);
      if (status) query = query.eq("status", status);
      const { data, error } = await query;
      if (error) return errorResult(error.message);
      const rows = data ?? [];
      const applicable = rows.filter((r) => r.status !== "non_applicable");
      const conforme = applicable.filter((r) => r.status === "conforme").length;
      return textResult({
        total: rows.length,
        applicables: applicable.length,
        conformes: conforme,
        score_sur_100: applicable.length ? Math.round((conforme / applicable.length) * 100) : null,
        points: rows,
      });
    } catch (e) {
      return errorResult((e as Error).message);
    }
  },
});
