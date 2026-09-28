import { redirect } from "@tanstack/react-router";
import { getSiteConfig } from "@/lib/site-config";
import { isModuleOn, onlyActive, type FeatureKey } from "@/config/modules";

export type { FeatureKey } from "@/config/modules";

/**
 * CDS — Interrupteurs des modules (V0.md §2).
 *
 * L'état est stocké en base (`site_settings`, clé « modules »), lu côté serveur
 * au chargement de la route racine, et se règle dans l'écran d'administration
 * « Modules ». La liste des modules et leurs dépendances : `src/config/modules.ts`.
 *
 * Quand un module est éteint :
 * - ses pages renvoient vers l'accueil (jamais d'erreur) ;
 * - ses liens disparaissent des menus, du pied de page, du plan du site,
 *   du sitemap et de l'administration ;
 * - ses tables existent en base mais restent inutilisées.
 */

/** Vrai si le module est actif sur le site (état lu en base, côté serveur puis navigateur). */
export function isFeatureOn(key: FeatureKey) {
  return isModuleOn(getSiteConfig().modules, key);
}

/** À appeler dans `beforeLoad` : renvoie à l'accueil si le module est éteint. */
export function requireFeature(key: FeatureKey) {
  if (!isFeatureOn(key)) throw redirect({ to: "/" });
}

/** Variante pour les écrans partagés par plusieurs modules (au moins un actif). */
export function requireAnyFeature(keys: readonly FeatureKey[]) {
  if (!keys.some((key) => isFeatureOn(key))) throw redirect({ to: "/" });
}

/** Filtre une liste de liens selon les modules actifs sur le site. */
export function withActiveModules<T extends object>(items: readonly T[]): T[] {
  return onlyActive(getSiteConfig().modules, items);
}
