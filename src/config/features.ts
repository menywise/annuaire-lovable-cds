import { redirect } from "@tanstack/react-router";

/**
 * CDS — Interrupteurs des briques optionnelles.
 *
 * Point de modification UNIQUE pour activer un module lors de la réutilisation
 * du modèle sur un nouveau projet. Tout est éteint par défaut : CDS reste un
 * design system nu.
 *
 * Quand un module est éteint :
 * - ses pages renvoient vers l'accueil (jamais d'erreur) ;
 * - ses liens disparaissent des menus, du pied de page et de l'administration ;
 * - ses tables existent en base mais restent vides.
 */
export const features = {
  /** Brique 11 — Pages par département et commune (dépend de `directory`). */
  geo: false,
  /** Brique 12 — Annuaire de fiches métier (professionnels, entreprises). */
  directory: false,
  /** Brique 13 — Suivi de prospects (mini-CRM privé). */
  crm: false,
  /** Brique 15 — Formations en ligne. */
  lms: false,
  /** Brique 16 — Petites annonces entre membres. */
  marketplace: false,
  /** Brique 17 — Régie publicitaire et affiliation. */
  adNetwork: false,
} as const;

export type FeatureKey = keyof typeof features;

/** Vrai si la brique est active (la géographie exige aussi l'annuaire). */
export function isFeatureOn(key: FeatureKey) {
  if (key === "geo") return features.geo && features.directory;
  return features[key];
}

/** À appeler dans `beforeLoad` : renvoie à l'accueil si la brique est éteinte. */
export function requireFeature(key: FeatureKey) {
  if (!isFeatureOn(key)) throw redirect({ to: "/" });
}
