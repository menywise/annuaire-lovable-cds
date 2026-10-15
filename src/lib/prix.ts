/**
 * CDS — Lecture d'un prix saisi dans un formulaire (annonce, formation, offre, produit).
 * Fichier sans dépendance. La base refuse de toute façon un prix négatif (contraintes
 * `*_price_check`) : ce qui est contrôlé ici sert à répondre avec un message clair avant
 * l'envoi, pas à protéger la base.
 */

export const PRIX_INVALIDE = "Prix invalide.";
export const PRIX_INVALIDE_DETAIL = "Exemple : 19,90";
export const PRIX_NEGATIF = "Le prix ne peut pas être négatif.";

export type Prix =
  { cents: number; erreur: null } | { cents: null; erreur: string; detail: string | undefined };

/**
 * Convertit un texte saisi en euros (« 19,90 », « 25 », « 0 », vide = 0) en centimes.
 * Refuse un texte qui n'est pas un nombre et un montant négatif, avec le message à afficher.
 * Le détail (exemple de saisie) n'accompagne que le texte illisible : pour un montant négatif,
 * l'écran précise lui-même ce que vaut zéro (annonce donnée, formation ou offre gratuite).
 */
export function lirePrix(texte: string): Prix {
  const propre = String(texte ?? "")
    .trim()
    .replace(/\s/g, "")
    .replace(",", ".");
  if (propre === "") return { cents: 0, erreur: null };
  const euros = Number(propre);
  if (!Number.isFinite(euros)) {
    return { cents: null, erreur: PRIX_INVALIDE, detail: PRIX_INVALIDE_DETAIL };
  }
  const cents = Math.round(euros * 100);
  if (cents < 0) return { cents: null, erreur: PRIX_NEGATIF, detail: undefined };
  return { cents: cents === 0 ? 0 : cents, erreur: null };
}
