/**
 * CDS — Valeurs de repli de la marque.
 *
 * La source unique est la table `site_settings` (clé « brand »), saisie dans
 * l'administration et lue côté serveur (voir `src/lib/site-config.ts`).
 * Ce fichier ne sert que si la base est vide ou injoignable : valeurs neutres,
 * aucune donnée propre à un projet.
 */

export const brandFallback = {
  /** Nom court affiché dans l'en-tête et le logo. */
  shortName: "Site",
  /** Nom complet utilisé dans les titres et métadonnées. */
  name: "Nouveau site",
  /** Signature affichée dans le pied de page. */
  tagline: "",
  /** URL publique du site (sans slash final) — vide tant qu'elle n'est pas saisie en admin. */
  url: "",
  legal: {
    company: "",
    form: "",
    capital: "",
    rcs: "",
    address: "",
    country: "France",
    publisher: "",
  },
  host: {
    name: "",
    detail: "",
    address: "",
    phone: "",
  },
};

/** Langue du document (multilingue hors périmètre). */
export const siteLocale = { locale: "fr-FR", lang: "fr", og: "fr_FR" } as const;
