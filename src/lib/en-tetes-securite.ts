/**
 * En-têtes de sécurité posés par src/server.ts sur chaque réponse HTML.
 * Un en-tête déjà présent (plateforme, route) n'est jamais écrasé.
 * Sans import : chargé tel quel par les tests unitaires (node --test).
 *
 * Encadrement (clickjacking) : hors des zones d'aperçu de Lovable, seule une page du site
 * peut en encadrer une autre (frame-ancestors 'self', X-Frame-Options SAMEORIGIN). Sur une zone
 * d'aperçu, l'éditeur Lovable affiche le site dans un cadre : on autorise en plus les origines
 * de l'éditeur, et rien d'autre. Zones et origines reprises de
 * src/integrations/supabase/previewAuthStorage.ts (fichier généré par Lovable).
 */

/** Hôtes (et sous-domaines) où Lovable affiche le site dans un cadre. */
export const ZONES_APERCU_LOVABLE = [
  "lovableproject.com",
  "lovableproject-dev.com",
  "lovable.app",
  "gpt-eng.com",
  "gptengineer.run",
] as const;

/** Zones de développement de Lovable : l'éditeur peut aussi tourner sur localhost:3000. */
const ZONES_APERCU_DEV = ["lovableproject-dev.com", "gpt-eng.com"] as const;

const EDITEUR_LOVABLE = [
  "https://lovable.dev",
  "https://*.lovable.dev",
  "https://gptengineer.app",
  "https://*.gptengineer.app",
] as const;

const EDITEUR_LOVABLE_DEV = ["http://localhost:3000"] as const;

/** Un an, sous-domaines compris : même valeur que celle posée par la plateforme. */
export const HSTS = "max-age=31536000; includeSubDomains";

function dansZone(hote: string, zones: readonly string[]): boolean {
  const h = hote.toLowerCase();
  return zones.some((zone) => h === zone || h.endsWith("." + zone));
}

/** Vrai si `hote` est une zone d'aperçu de Lovable (site affiché dans un cadre par l'éditeur). */
export function estZoneApercuLovable(hote: string): boolean {
  return dansZone(hote, ZONES_APERCU_LOVABLE);
}

/** Valeur de la directive frame-ancestors pour l'hôte servi. */
export function ancetresAutorises(hote: string): string {
  if (!estZoneApercuLovable(hote)) return "'self'";
  const origines: string[] = ["'self'", ...EDITEUR_LOVABLE];
  if (dansZone(hote, ZONES_APERCU_DEV)) origines.push(...EDITEUR_LOVABLE_DEV);
  return origines.join(" ");
}

/**
 * En-têtes à poser pour l'hôte servi, dans l'ordre : [nom, valeur].
 * Content-Security-Policy ne porte que frame-ancestors : la politique complète reste à écrire.
 */
export function enTetesSecurite(hote: string): Array<[string, string]> {
  const ancetres = ancetresAutorises(hote);
  const entetes: Array<[string, string]> = [
    ["X-Content-Type-Options", "nosniff"],
    ["Referrer-Policy", "strict-origin-when-cross-origin"],
    ["Strict-Transport-Security", HSTS],
    ["Content-Security-Policy", `frame-ancestors ${ancetres}`],
  ];
  // X-Frame-Options ne sait pas lister plusieurs origines : posé seulement quand 'self' suffit.
  if (ancetres === "'self'") entetes.push(["X-Frame-Options", "SAMEORIGIN"]);
  return entetes;
}

function contientFrameAncestors(politique: string): boolean {
  return politique
    .split(";")
    .some((directive) => directive.trim().toLowerCase().startsWith("frame-ancestors"));
}

/**
 * Pose les en-têtes manquants dans `entetes`. Un en-tête présent est gardé tel quel ; une
 * Content-Security-Policy présente sans frame-ancestors reçoit la directive en plus.
 */
export function poserEnTetesSecurite(entetes: Headers, hote: string): void {
  for (const [nom, valeur] of enTetesSecurite(hote)) {
    const actuel = entetes.get(nom);
    if (actuel === null) {
      entetes.set(nom, valeur);
    } else if (nom === "Content-Security-Policy" && !contientFrameAncestors(actuel)) {
      entetes.set(nom, `${actuel.trim().replace(/;\s*$/, "")}; ${valeur}`);
    }
  }
}

function estHtml(reponse: Response): boolean {
  return (reponse.headers.get("content-type") ?? "").toLowerCase().includes("text/html");
}

/**
 * Renvoie `reponse` avec les en-têtes de sécurité si elle est en HTML, sinon inchangée.
 * Une réponse aux en-têtes figés est recopiée (même corps, même statut).
 */
export function avecEnTetesSecurite(reponse: Response, requete: Request): Response {
  if (!estHtml(reponse)) return reponse;
  let hote: string;
  try {
    hote = new URL(requete.url).hostname;
  } catch {
    hote = "";
  }
  try {
    poserEnTetesSecurite(reponse.headers, hote);
    return reponse;
  } catch {
    const entetes = new Headers(reponse.headers);
    poserEnTetesSecurite(entetes, hote);
    return new Response(reponse.body, {
      status: reponse.status,
      statusText: reponse.statusText,
      headers: entetes,
    });
  }
}
