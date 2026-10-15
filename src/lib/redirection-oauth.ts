import { cheminInterne } from "@/lib/redirection";

/**
 * Liste blanche finale stricte des hostnames autorisés pour les redirections OAuth absolues.
 */
const ALLOWED_REDIRECT_HOSTNAMES = new Set(["lovable.dev", "lovable.app"]);

/**
 * Valide et assainit une URL de redirection pour prévenir les attaques Open Redirect.
 *
 * Règles strictes :
 * 1. Page du site lui-même : chemin rendu par cheminInterne (même origine, sans caractère de
 *    contrôle ni antislash).
 * 2. URL absolue :
 *    - Localhost (127.0.0.1 / localhost) est autorisé UNIQUEMENT en mode développement (import.meta.env.DEV === true).
 *    - Pour tous les autres domaines distants, le protocole HTTPS est EXIGÉ STRICTEMENT (http:// rejeté).
 *    - Le hostname doit appartenir à ALLOWED_REDIRECT_HOSTNAMES (ou sous-domaine direct).
 * 3. En cas d'URL non autorisée ou malformée : repli sur "/tableau-de-bord" + log de sécurité.
 */
export function getSafeRedirectUrl(
  target: string | null | undefined,
  fallback = "/tableau-de-bord",
): string {
  if (!target || typeof target !== "string") return fallback;

  const trimmed = target.trim();

  // 1. Page du site lui-même (ex: "/tableau-de-bord")
  const interne = cheminInterne(trimmed);
  if (interne) return interne;

  // 2. URL absolue avec parsing new URL()
  try {
    const parsed = new URL(trimmed);
    const hostname = parsed.hostname.toLowerCase();

    // Localhost autorisé uniquement en développement
    const isLocalhost = hostname === "localhost" || hostname === "127.0.0.1";
    if (isLocalhost) {
      if (import.meta.env.DEV) {
        return parsed.toString();
      }
      console.warn("[OAuth Security] Tentative de redirection localhost bloquée en production.");
      return fallback;
    }

    // Domaines distants : HTTPS obligatoire
    if (parsed.protocol !== "https:") {
      console.warn(
        "[OAuth Security] Protocole non sécurisé rejeté (HTTPS requis) :",
        parsed.protocol,
      );
      return fallback;
    }

    // Vérification de la liste blanche (plus le site lui-même, quel que soit son domaine)
    const sameSite = typeof window !== "undefined" && hostname === window.location.hostname;
    const isAllowed =
      sameSite ||
      Array.from(ALLOWED_REDIRECT_HOSTNAMES).some(
        (domain) => hostname === domain || hostname.endsWith("." + domain),
      );

    if (isAllowed) {
      return parsed.toString();
    }
  } catch {
    console.warn("[OAuth Security] URL de redirection malformée :", target);
    return fallback;
  }

  console.warn("[OAuth Security] Redirection non autorisée interceptée vers :", target);
  return fallback;
}
