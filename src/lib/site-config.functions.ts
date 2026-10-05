import { createServerFn } from "@tanstack/react-start";
import { publicClient } from "@/lib/supabase-public";
import {
  ANNUAIRE_SETTINGS_KEY,
  BRAND_SETTINGS_KEY,
  MODULES_SETTINGS_KEY,
  buildSiteConfig,
} from "@/lib/site-config";

/** Lit la marque, les modules et les réglages de l'annuaire dans `site_settings` (lecture publique, côté serveur). */
export const loadSiteConfig = createServerFn({ method: "GET" }).handler(async () => {
  const { data, error } = await publicClient()
    .from("site_settings")
    .select("key, value")
    .in("key", [BRAND_SETTINGS_KEY, MODULES_SETTINGS_KEY, ANNUAIRE_SETTINGS_KEY]);
  if (error) throw new Error(error.message);
  return buildSiteConfig(data ?? []);
});
