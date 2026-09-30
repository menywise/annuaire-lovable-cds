import { createFileRoute } from "@tanstack/react-router";

/**
 * Passage planifié de la veille de sites : POST /api/cron/veille, appelé par les tâches
 * planifiées de Lovable (en-tête « Authorization: Bearer <LOVABLE_CRON_SECRET> »), par exemple
 * toutes les heures. Traite les propositions des membres, lance les sources les plus anciennes
 * et contrôle la disponibilité des sites, selon les volumes réglés dans l'écran Veille.
 */
export const Route = createFileRoute("/api/cron/veille")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { authenticateCronRequest } = await import("@/integrations/supabase/cron-auth");
        const denied = await authenticateCronRequest(request);
        if (denied) return denied;
        const { jsonResponse } = await import("@/lib/hooks-auth.server");
        const { loadSiteConfig } = await import("@/lib/site-config.functions");
        const { isModuleOn } = await import("@/config/modules");
        const site = await loadSiteConfig().catch(() => null);
        if (!site || !isModuleOn(site.modules, "watch")) {
          return jsonResponse({ skipped: "Module Veille de sites éteint" });
        }
        try {
          const { runScheduled } = await import("@/lib/watch.server");
          return jsonResponse(await runScheduled());
        } catch (error) {
          return jsonResponse({ error: error instanceof Error ? error.message : "Échec" }, 500);
        }
      },
    },
  },
});
