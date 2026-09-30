import { createFileRoute } from "@tanstack/react-router";

/**
 * API des agents (Letta, tâche Cowork…) pour la veille de sites : /api/hooks/veille.
 * En-tête obligatoire : « x-hook-secret: <WATCH_HOOKS_SECRET> » (ou Authorization: Bearer).
 *
 * GET                      règles et seuils appliqués (catalogue)
 * GET ?host=exemple.fr     état d'un domaine : suivi, refusé (motifs), proposé
 * POST {"action": "soumettre", "urls": ["exemple.fr"]}   analyse (5 adresses au plus, portiers appliqués)
 * POST {"action": "decouvrir", "query": "…", "limit": 8}                 recherche puis analyse
 * POST {"action": "sources"}                                               sources actives les plus anciennes
 * POST {"action": "controler", "limit": 25}                               disponibilité des sites suivis
 * POST {"action": "file"}                                                 propositions des membres
 * POST {"action": "etat"}                                                 tableau de bord
 */

type Body = Record<string, unknown>;

async function guard(request: Request) {
  const { authorizeHook, jsonResponse } = await import("@/lib/hooks-auth.server");
  const denied = await authorizeHook(request);
  if (denied) return denied;
  const { loadSiteConfig } = await import("@/lib/site-config.functions");
  const { isModuleOn } = await import("@/config/modules");
  const site = await loadSiteConfig().catch(() => null);
  if (!site || !isModuleOn(site.modules, "watch")) {
    return jsonResponse({ error: "Module Veille de sites éteint" }, 404);
  }
  return null;
}

const int = (value: unknown, min: number, max: number, fallback: number) => {
  const n = Number(value);
  return Number.isInteger(n) ? Math.min(max, Math.max(min, n)) : fallback;
};

export const Route = createFileRoute("/api/hooks/veille")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const denied = await guard(request);
        if (denied) return denied;
        const { jsonResponse } = await import("@/lib/hooks-auth.server");
        const { catalogue, domainState } = await import("@/lib/watch.server");
        const host = new URL(request.url).searchParams.get("host");
        try {
          return jsonResponse(host ? await domainState(host.slice(0, 300)) : await catalogue());
        } catch (error) {
          return jsonResponse(
            { error: error instanceof Error ? error.message : "Consultation impossible" },
            400,
          );
        }
      },
      POST: async ({ request }) => {
        const denied = await guard(request);
        if (denied) return denied;
        const { jsonResponse } = await import("@/lib/hooks-auth.server");
        let body: Body;
        try {
          const text = await request.text();
          body = (text ? JSON.parse(text) : {}) as Body;
          if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error();
        } catch {
          return jsonResponse({ error: "Corps JSON invalide" }, 400);
        }
        const server = await import("@/lib/watch.server");
        try {
          switch (body["action"]) {
            case "soumettre": {
              const urls = Array.isArray(body["urls"])
                ? body["urls"].filter(
                    (u): u is string => typeof u === "string" && u.length >= 3 && u.length <= 300,
                  )
                : [];
              if (urls.length === 0 || urls.length > 5) {
                return jsonResponse({ error: "De 1 à 5 adresses dans « urls »" }, 400);
              }
              const { results, postponed } = await server.analyzeMany(urls, {
                // Pas de « forcer » pour un agent : seul l'admin passe outre les portiers.
                source: "agent",
              });
              return jsonResponse({
                retenus: results.filter((r) => r.decision === "retenu").length,
                refuses: results.filter((r) => r.decision === "refuse").length,
                erreurs: results.filter((r) => r.decision === "erreur").length,
                resultats: results,
                reportes: postponed,
              });
            }
            case "decouvrir": {
              const query = typeof body["query"] === "string" ? body["query"].trim() : "";
              if (query.length < 3 || query.length > 300) {
                return jsonResponse({ error: "Requête de 3 à 300 caractères dans « query »" }, 400);
              }
              return jsonResponse(
                await server.discover({ query, limit: int(body["limit"], 1, 20, 8) }),
              );
            }
            case "sources": {
              const settings = await server.loadWatchSettings();
              const runs = await server.runDueSources(
                int(body["maxSources"], 1, 10, Math.max(1, settings.sources_per_run)),
                int(body["limit"], 1, 20, settings.search_limit),
              );
              return jsonResponse({ campagnes: runs });
            }
            case "controler":
              return jsonResponse(await server.checkSites(int(body["limit"], 1, 60, 25)));
            case "file":
              return jsonResponse(await server.processSubmissions(int(body["limit"], 1, 10, 5)));
            case "etat": {
              const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
              const { data, error } = await supabaseAdmin.rpc("watch_status");
              if (error) throw new Error(error.message);
              return jsonResponse(data);
            }
            default:
              return jsonResponse(
                {
                  error: "Action attendue : soumettre, decouvrir, sources, controler, file ou etat",
                },
                400,
              );
          }
        } catch (error) {
          return jsonResponse(
            { error: error instanceof Error ? error.message : "Échec de la veille" },
            500,
          );
        }
      },
    },
  },
});
