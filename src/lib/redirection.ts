/**
 * Adresse de retour après connexion : uniquement une page du site lui-même.
 * Seule fonction du dépôt qui filtre une adresse de retour (connexion, Google, consentement OAuth).
 * Sans import : chargée telle quelle par les tests unitaires (node --test).
 */

// Origine fictive côté serveur : seule la comparaison avec la valeur résolue compte.
const ORIGINE_SERVEUR = "https://site.invalid";

/**
 * Renvoie chemin + paramètres + ancre si `valeur` mène à la même origine, sinon `undefined`.
 * Caractères de contrôle et antislash refusés : le navigateur retire tabulations et retours à la
 * ligne (« /\t/site.externe » devient « //site.externe ») et lit « \ » comme « / ».
 */
export function cheminInterne(valeur: unknown, origine?: string): string | undefined {
  if (typeof valeur !== "string" || valeur === "") return undefined;
  for (const caractere of valeur) {
    const code = caractere.charCodeAt(0);
    if (code <= 0x1f || (code >= 0x7f && code <= 0x9f) || caractere === "\\") return undefined;
  }
  const base =
    origine ?? (typeof window !== "undefined" ? window.location.origin : ORIGINE_SERVEUR);
  let url: URL;
  try {
    url = new URL(valeur, base);
  } catch {
    return undefined;
  }
  if (url.origin !== new URL(base).origin) return undefined;
  // « /.//site.externe » se résout en chemin « //site.externe » : relu seul, il quitterait le site.
  if (url.pathname.startsWith("//")) return undefined;
  return `${url.pathname}${url.search}${url.hash}`;
}
