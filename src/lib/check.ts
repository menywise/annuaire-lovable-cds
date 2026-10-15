/**
 * Lecture d'un résultat Supabase (`{ data, error }`) côté serveur.
 *
 * Une panne de base (réseau coupé, table absente, délai dépassé, droits mal réglés) lève une
 * erreur : la page affiche son état d'erreur et un bouton « Réessayer », jamais une liste vide
 * en code 200. Le détail technique est journalisé côté serveur ; le visiteur reçoit un message
 * fixe et neutre, qui ne cite ni table, ni colonne, ni message brut de PostgreSQL.
 *
 * Les messages métier écrits dans les fonctions SQL du socle (`RAISE EXCEPTION 'Panier vide'`)
 * s'adressent au visiteur : `check(result, { metier: true })` les laisse passer tels quels.
 */

/** Message affiché au visiteur quand la base ne répond pas. Jamais le message brut. */
export const MESSAGE_PANNE_BASE =
  "Les données du site sont indisponibles pour le moment. Réessayez dans un instant.";

export type ErreurBase = {
  message: string;
  code?: string | null;
  details?: string | null;
  hint?: string | null;
};

export type ResultatBase<T> = { data: T; error: ErreurBase | null };

export type OptionsCheck = {
  /** Repère dans le journal serveur (nom de la fonction ou de la table). */
  contexte?: string;
  /** Vrai pour une fonction SQL du socle dont les `RAISE EXCEPTION` parlent au visiteur. */
  metier?: boolean;
};

/**
 * Codes SQLSTATE employés par les `RAISE EXCEPTION` du socle (supabase/migrations) : P0001 par
 * défaut, P0002 (introuvable), 22023 (paramètre), 23505 (déjà fait), 23514 (règle métier),
 * 42501 (réservé), 54000 (limite). Toute autre valeur (42P01 table absente, 57014 délai, 08xxx
 * connexion, 53xxx ressources, PGRSTxxx, absence de code sur une panne réseau…) est une panne.
 */
const CODES_METIER = new Set(["P0001", "P0002", "22023", "23505", "23514", "42501", "54000"]);

/**
 * Messages que PostgreSQL lui-même produit sous ces mêmes codes (contrainte, droit, doublon) :
 * un texte anglais qui cite une table, jamais un message voulu pour le visiteur.
 */
const MESSAGE_BRUT_POSTGRES =
  /^(permission denied|new row |duplicate key value|null value in column|insert or update on table|update or delete on table|value too long|query has no destination)/i;

/** Vrai si l'erreur vient d'un `RAISE EXCEPTION` du socle et porte un message pour le visiteur. */
export function estMessageMetier(error: ErreurBase): boolean {
  if (!error.code || !CODES_METIER.has(error.code)) return false;
  return !MESSAGE_BRUT_POSTGRES.test(error.message.trim());
}

/** Une ligne de journal par panne, lisible dans les journaux du serveur. */
export function decrireErreurBase(error: ErreurBase, contexte?: string): string {
  const parts = [`[base]${contexte ? ` ${contexte}` : ""} : ${error.message}`];
  if (error.code) parts.push(`code ${error.code}`);
  if (error.details) parts.push(`détail : ${error.details}`);
  if (error.hint) parts.push(`indice : ${error.hint}`);
  return parts.join(" — ");
}

/**
 * Renvoie `data` si la requête a réussi ; sinon journalise et lève une erreur au message neutre
 * (ou au message métier du socle quand `metier` est vrai et que l'erreur en porte un).
 */
export function check<T>(result: ResultatBase<T>, options: OptionsCheck = {}): T {
  const { error } = result;
  if (!error) return result.data;
  console.error(decrireErreurBase(error, options.contexte));
  if (options.metier && estMessageMetier(error)) throw new Error(error.message);
  throw new Error(MESSAGE_PANNE_BASE);
}
