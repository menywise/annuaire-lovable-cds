import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { requireAdmin } from "../guard";
import { errorResult, textResult } from "../supabase";

export default defineTool({
  name: "list_roadmap",
  title: "Feuille de route et plan directeur",
  description:
    "Retourne la feuille de route (lots, statuts, priorités) et les sections du plan directeur du modèle CDS.",
  inputSchema: {
    status: z.enum(["a_faire", "en_cours", "fait"]).optional().describe("Filtrer sur un statut."),
  },
  annotations: { readOnlyHint: true, openWorldHint: false },
  handler: async ({ status }, ctx) => {
    try {
      const supabase = await requireAdmin(ctx);
      let query = supabase
        .from("roadmap_items")
        .select("id, title, description, lot, status, priority, position, public_visible")
        .order("position", { ascending: true });
      if (status) query = query.eq("status", status);
      const [{ data: items, error }, { data: sections }] = await Promise.all([
        query,
        supabase.from("masterplan_sections").select("title, content, position").order("position"),
      ]);
      if (error) return errorResult(error.message);
      return textResult({ feuille_de_route: items ?? [], plan_directeur: sections ?? [] });
    } catch (e) {
      return errorResult((e as Error).message);
    }
  },
});
