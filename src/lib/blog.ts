/**
 * CDS — Liste des articles (/blog) : taille de page et nettoyage des paramètres d'adresse.
 * Fichier sans dépendance serveur : partagé par la route (navigateur et serveur) et par
 * `src/lib/content.functions.ts`, où la liste est filtrée et paginée en base.
 */

/** Articles par page sur /blog. */
export const BLOG_PAGE_SIZE = 12;

/** Longueur maximale d'une recherche sur /blog (au-delà, coupée). */
export const BLOG_SEARCH_MAX_LENGTH = 100;

/** Longueur maximale d'une étiquette dans l'adresse. */
const TAG_MAX_LENGTH = 60;

/** Plafond du numéro de page accepté dans l'adresse. */
const PAGE_MAX = 100000;

/**
 * Saisie de recherche nettoyée pour un motif `ilike` dans un filtre `or` de PostgREST :
 * les caractères qui y ont un sens (jokers % _ *, virgule, parenthèses, guillemets, barre
 * oblique inverse) deviennent des espaces, les espaces sont réduits, la longueur bornée.
 */
export function cleanBlogSearch(q: unknown) {
  return String(q ?? "")
    .replace(/[%_*,()"\\]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, BLOG_SEARCH_MAX_LENGTH);
}

/** Étiquette nettoyée : une ligne, sans virgule, accolade ni guillemet (filtre `cs` de PostgREST). */
export function cleanBlogTag(tag: unknown) {
  return String(tag ?? "")
    .replace(/[",{}\\]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, TAG_MAX_LENGTH);
}

/** Numéro de page borné : entier, 1 au minimum. */
export function cleanBlogPage(page: unknown) {
  const n = Math.floor(Number(page));
  return Number.isFinite(n) && n >= 1 ? Math.min(n, PAGE_MAX) : 1;
}

/** Paramètres de la liste, tels que la base les reçoit. */
export type BlogListInput = { page: number; q: string; tag: string };

/** Article tel qu'il est envoyé à la liste /blog : sans le texte, avec la durée de lecture. */
export type BlogListPost = {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  cover_url: string | null;
  published_at: string | null;
  tags: string[] | null;
  /** Durée de lecture en minutes, calculée sur le serveur à partir du texte. */
  reading_minutes: number;
};
