/**
 * Authentification des agents (Letta, tâche Cowork…) sur /api/hooks/*.
 *
 * Secret dédié WATCH_HOOKS_SECRET (secret d'environnement du projet, jamais dans le code ni en
 * base), envoyé dans l'en-tête `x-hook-secret` ou `Authorization: Bearer …`. La clé publique
 * Supabase n'est jamais acceptée : elle se lit dans le code de toutes les pages.
 * Sans secret configuré, les routes répondent 503 (fermées), jamais ouvertes.
 */
export function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

export async function authorizeHook(request: Request): Promise<Response | null> {
  const secret = process.env["WATCH_HOOKS_SECRET"] ?? "";
  if (secret.length < 24) {
    return jsonResponse(
      { error: "Accès des agents non configuré (secret WATCH_HOOKS_SECRET)" },
      503,
    );
  }
  const provided =
    request.headers.get("x-hook-secret") ??
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
    "";
  const { createHash, timingSafeEqual } = await import("node:crypto");
  const digest = (value: string) => createHash("sha256").update(value, "utf8").digest();
  if (!provided || !timingSafeEqual(digest(provided), digest(secret))) {
    return jsonResponse({ error: "Non autorisé" }, 401);
  }
  return null;
}
