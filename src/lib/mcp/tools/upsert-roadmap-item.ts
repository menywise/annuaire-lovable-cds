import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { requireAdmin } from "../guard";
import { errorResult, textResult } from "../supabase";

export default defineTool({
  name: "upsert_roadmap_item",
  title: "Créer ou modifier un élément de feuille de route",
  description:
    "Crée un nouvel élément de feuille de route, ou met à jour un élément existant à partir de son identifiant.",
  inputSchema: {
    id: z.string().uuid().optional().describe("Identifiant d'un élément existant à modifier."),
    title: z.string().min(1).optional().describe("Intitulé de l'élément."),
    description: z.string().optional(),
    lot: z.string().optional().describe("Lot ou chantier de rattachement."),
    status: z.enum(["a_faire", "en_cours", "fait"]).optional(),
    priority: z.enum(["normale", "haute", "bloque"]).optional(),
    public_visible: z.boolean().optional(),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async (input, ctx) => {
    try {
      const supabase = await requireAdmin(ctx);
      const { id, ...rest } = input;
      const patch = Object.fromEntries(Object.entries(rest).filter(([, v]) => v !== undefined)) as {
        title?: string;
        description?: string;
        lot?: string;
        status?: string;
        priority?: string;
        public_visible?: boolean;
      };
      const columns = "id, title, description, lot, status, priority, position, public_visible";
      if (id) {
        if (Object.keys(patch).length === 0) return errorResult("Rien à mettre à jour.");
        const { data, error } = await supabase
          .from("roadmap_items")
          .update(patch)
          .eq("id", id)
          .select(columns)
          .maybeSingle();
        if (error) return errorResult(error.message);
        if (!data) return errorResult("Élément introuvable.");
        return textResult(data);
      }
      if (!input.title) return errorResult("Un intitulé est requis pour créer un élément.");
      const { data, error } = await supabase
        .from("roadmap_items")
        .insert({ ...patch, title: input.title })
        .select(columns)
        .single();
      if (error) return errorResult(error.message);
      return textResult(data);
    } catch (e) {
      return errorResult((e as Error).message);
    }
  },
});
