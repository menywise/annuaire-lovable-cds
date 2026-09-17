/**
 * CDS — Configuration de marque
 * Point de modification UNIQUE pour réutiliser le design system sur un nouveau projet :
 * nom, URL publique, coordonnées légales, hébergeur, adresses administratrices.
 */

export const brand = {
  /** Nom court affiché dans l'en-tête et le logo. */
  shortName: "CDS",
  /** Nom complet utilisé dans les titres et métadonnées. */
  name: "Consensus Design System",
  /** Signature affichée dans le pied de page. */
  tagline: "Consensus Design System — GNOSIA",
  /** URL publique du site (sans slash final) — utilisée pour canonical, og:url, sitemap. */
  url: "https://cds-mac97000.lovable.app",
  /** Langue du document. */
  locale: "fr-FR",
  lang: "fr",

  /** Éditeur du site (mentions légales). */
  legal: {
    company: "PMM RDS",
    form: "SAS",
    capital: "1 000 €",
    rcs: "RCS Limoges",
    address: "Rue du Champfour, 87000 Limoges",
    country: "France",
    publisher: "Manuel ROHAUT",
  },

  /** Hébergeur. */
  host: {
    name: "OVH SAS",
    detail: "424 761 419 RCS Lille Métropole",
    address: "2 rue Kellermann, 59100 Roubaix, France",
    phone: "1007",
  },

  /** Adresses obtenant automatiquement le rôle administrateur. */
  adminEmails: ["manuel.rohaut@gmail.com", "ac.rohaut@gmail.com"],
} as const;

/** Construit une URL absolue à partir d'un chemin interne. */
export function absoluteUrl(path: string) {
  return `${brand.url}${path.startsWith("/") ? path : `/${path}`}`;
}
