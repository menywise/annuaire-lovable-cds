/**
 * Garde d'adresse : la veille ne visite que des sites publics (reprise de l'annuaire).
 * Refuse localhost, les adresses IP écrites en clair (le réseau interne du serveur),
 * les noms sans point et les domaines réservés aux réseaux privés.
 * Fichier sans dépendance (testé par tests/unit/url-guard.test.ts).
 */
const RESERVED_SUFFIXES = [
  ".localhost",
  ".local",
  ".internal",
  ".lan",
  ".home",
  ".corp",
  ".intranet",
];

export function isPublicHost(host: string): boolean {
  const h = host.toLowerCase().replace(/\.$/, "");
  if (!h || h === "localhost") return false;
  // Adresse IP en clair (IPv4, IPv6 entre crochets ou non) : jamais un site à visiter.
  if (/^[0-9.]+$/.test(h) || h.includes(":") || h.startsWith("[")) return false;
  if (!h.includes(".")) return false;
  if (RESERVED_SUFFIXES.some((s) => h.endsWith(s))) return false;
  return /^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(h);
}

export function assertPublicUrl(url: URL): void {
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("Adresse refusée : seuls http et https sont acceptés.");
  }
  if (url.username || url.password) throw new Error("Adresse refusée : identifiants dans l'URL.");
  if (url.port && url.port !== "80" && url.port !== "443") {
    throw new Error("Adresse refusée : port non standard.");
  }
  if (!isPublicHost(url.hostname)) {
    throw new Error("Adresse refusée : domaine public attendu (pas d'adresse interne ni d'IP).");
  }
}
