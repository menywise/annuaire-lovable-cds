import { createServerFn } from "@tanstack/react-start";
import { publicClient } from "@/lib/supabase-public";
import { check } from "@/lib/check";
import {
  ANNUAIRE_SETTINGS_KEY,
  BRAND_SETTINGS_KEY,
  MODULES_SETTINGS_KEY,
  buildSiteConfig,
} from "@/lib/site-config";
import { creerCacheSite } from "@/lib/site-config.cache";

/** Lecture en base, sans cache. */
async function lireSiteConfig() {
  const data = check(
    await publicClient()
      .from("site_settings")
      .select("key, value")
      .in("key", [BRAND_SETTINGS_KEY, MODULES_SETTINGS_KEY, ANNUAIRE_SETTINGS_KEY]),
    { contexte: "site_settings" },
  );
  return buildSiteConfig(data ?? []);
}

/**
 * Cache du serveur : une lecture par minute, une seule requête en vol, dernière valeur connue
 * servie en cas de panne de base (voir `src/lib/site-config.cache.ts`).
 */
const cacheSite = creerCacheSite({ charger: lireSiteConfig });

/**
 * Lit la marque, les modules et les réglages de l'annuaire dans `site_settings` (lecture publique,
 * côté serveur), au plus une fois par minute par serveur.
 */
export const loadSiteConfig = createServerFn({ method: "GET" }).handler(() => cacheSite.lire());
