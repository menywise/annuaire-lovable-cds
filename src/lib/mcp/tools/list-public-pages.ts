import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { requireAdmin } from "../guard";
import { errorResult, siteBaseUrl, textResult } from "../supabase";

export default defineTool({
  name: "list_public_pages",
  title: "Pages publiques",
  description:
    "Lit le plan du site (sitemap.xml) et retourne toutes les adresses publiques du site, prêtes à être auditées une par une.",
  inputSchema: {
    base_url: z
      .string()
      .url()
      .optional()
      .describe("Adresse du site : celle réglée en admin ou celle de ce serveur (préproduction)."),
  },
  annotations: { readOnlyHint: true, openWorldHint: true },
  handler: async ({ base_url }, ctx) => {
    let base: string;
    try {
      await requireAdmin(ctx);
      base = await siteBaseUrl(base_url);
    } catch (e) {
      return errorResult((e as Error).message);
    }
    try {
      const res = await fetch(`${base}/sitemap.xml`, { signal: ctx.signal });
      if (!res.ok) return errorResult(`Plan du site inaccessible (${res.status}).`);
      const xml = await res.text();
      const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
      return textResult({ base, nombre: urls.length, adresses: urls });
    } catch (e) {
      return errorResult(`Lecture impossible : ${(e as Error).message}`);
    }
  },
});
