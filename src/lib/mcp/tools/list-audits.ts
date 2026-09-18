import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { requireAdmin } from "../guard";
import { errorResult, textResult } from "../supabase";

export default defineTool({
  name: "list_audits",
  title: "Historique des audits",
  description:
    "Liste les audits déjà enregistrés (date, score, résumé) et, au besoin, le détail des anomalies d'un audit précis.",
  inputSchema: {
    limit: z.number().int().min(1).max(50).default(10).describe("Nombre d'audits à retourner."),
    audit_id: z.string().uuid().optional().describe("Identifiant d'un audit dont on veut le détail."),
  },
  annotations: { readOnlyHint: true, openWorldHint: false },
  handler: async ({ limit, audit_id }, ctx) => {
    try {
      const supabase = await requireAdmin(ctx);
      if (audit_id) {
        const { data: audit, error } = await supabase
          .from("audits")
          .select("id, label, score, max_score, summary, performed_at")
          .eq("id", audit_id)
          .maybeSingle();
        if (error) return errorResult(error.message);
        if (!audit) return errorResult("Audit introuvable.");
        const { data: findings } = await supabase
          .from("audit_findings")
          .select("code, severity, location, description, resolved")
          .eq("audit_id", audit_id)
          .order("severity", { ascending: true });
        return textResult({ audit, anomalies: findings ?? [] });
      }
      const { data, error } = await supabase
        .from("audits")
        .select("id, label, score, max_score, summary, performed_at")
        .order("performed_at", { ascending: false })
        .limit(limit);
      if (error) return errorResult(error.message);
      return textResult({ audits: data ?? [] });
    } catch (e) {
      return errorResult((e as Error).message);
    }
  },
});
