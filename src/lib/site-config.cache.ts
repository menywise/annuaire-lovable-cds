// Chemins relatifs : le fichier est aussi chargé tel quel par les tests unitaires (node --test).
import type { SiteConfig } from "./site-config.ts";

/**
 * Cache en mémoire de la configuration du site, côté serveur.
 *
 * Sans lui, chaque page rendue par le serveur attend une lecture de `site_settings` avant de
 * s'afficher. Avec lui, une lecture sert toutes les requêtes pendant `duree` millisecondes.
 *
 * - Une seule requête en vol à la fois : les appels simultanés attendent la même lecture.
 * - Erreur de base : la dernière valeur connue est servie si elle existe ; sinon l'erreur remonte.
 *   Après une erreur, la base n'est réinterrogée qu'au bout de `reprise` millisecondes.
 * - `oublier()` vide le cache (la lecture suivante interroge la base).
 *
 * L'administrateur qui enregistre un réglage voit son changement tout de suite dans sa propre
 * session (`setSiteConfig` côté navigateur) ; les autres visiteurs le voient sous `duree`.
 */

/** Durée de validité d'une lecture : une minute. */
export const DUREE_CACHE_SITE_MS = 60_000;

/** Délai avant de réinterroger la base après une erreur, pendant que la dernière valeur est servie. */
export const DELAI_REPRISE_SITE_MS = 5_000;

export type OptionsCacheSite = {
  /** Lecture en base (sans cache). */
  charger: () => Promise<SiteConfig>;
  /** Durée de validité d'une lecture, en millisecondes. */
  duree?: number;
  /** Délai avant une nouvelle tentative après une erreur, en millisecondes. */
  reprise?: number;
  /** Horloge, remplaçable par les tests. */
  maintenant?: () => number;
};

export type CacheSite = {
  /** Configuration à jour (au plus `duree` millisecondes d'âge), ou dernière connue en cas d'erreur. */
  lire: () => Promise<SiteConfig>;
  /** Vide le cache : la prochaine lecture interroge la base. */
  oublier: () => void;
};

export function creerCacheSite(options: OptionsCacheSite): CacheSite {
  const {
    charger,
    duree = DUREE_CACHE_SITE_MS,
    reprise = DELAI_REPRISE_SITE_MS,
    maintenant = Date.now,
  } = options;

  let valeur: SiteConfig | null = null;
  /** Date de la lecture qui a produit `valeur` (ou de la dernière erreur, pour espacer les reprises). */
  let date = 0;
  let enVol: Promise<SiteConfig> | null = null;

  async function recharger(): Promise<SiteConfig> {
    try {
      const lue = await charger();
      valeur = lue;
      date = maintenant();
      return lue;
    } catch (error) {
      if (!valeur) throw error;
      // Panne de base : la dernière valeur connue reste servie, nouvelle tentative plus tard.
      date = maintenant() - duree + reprise;
      return valeur;
    } finally {
      enVol = null;
    }
  }

  return {
    lire() {
      if (valeur && maintenant() - date < duree) return Promise.resolve(valeur);
      if (!enVol) enVol = recharger();
      return enVol;
    },
    oublier() {
      valeur = null;
      date = 0;
    },
  };
}
