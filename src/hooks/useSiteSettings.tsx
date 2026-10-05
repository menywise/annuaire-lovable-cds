import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { normalizeModules, type ModuleStates } from "@/config/modules";
import {
  ANNUAIRE_SETTINGS_KEY,
  BRAND_SETTINGS_KEY,
  MODULES_SETTINGS_KEY,
  getSiteConfig,
  normalizeAnnuaire,
  normalizeBrand,
  setSiteConfig,
  type AnnuaireSettings,
  type BrandSettings,
} from "@/lib/site-config";

export type { BrandSettings } from "@/lib/site-config";
export { defaultBrandSettings, BRAND_SETTINGS_KEY } from "@/lib/site-config";

async function readSetting(key: string) {
  const { data, error } = await supabase
    .from("site_settings")
    .select("value")
    .eq("key", key)
    .maybeSingle();
  if (error) throw error;
  return data?.value;
}

async function writeSetting(key: string, value: unknown) {
  const { data: userData } = await supabase.auth.getUser();
  const { error } = await supabase.from("site_settings").upsert(
    {
      key,
      value: value as Json,
      updated_at: new Date().toISOString(),
      updated_by: userData.user?.id ?? null,
    },
    { onConflict: "key" },
  );
  if (error) throw error;
}

export async function fetchBrandSettings(): Promise<BrandSettings> {
  return normalizeBrand(await readSetting(BRAND_SETTINGS_KEY));
}

export async function saveBrandSettings(next: BrandSettings) {
  const clean = normalizeBrand(next);
  await writeSetting(BRAND_SETTINGS_KEY, clean);
  setSiteConfig({ ...getSiteConfig(), brand: clean });
}

export async function fetchModuleStates(): Promise<ModuleStates> {
  return normalizeModules(await readSetting(MODULES_SETTINGS_KEY));
}

/** Vrai si un administrateur a déjà enregistré le choix des modules (date posée par la base). */
export async function fetchModulesChosen(): Promise<boolean> {
  const value = (await readSetting("demarrage")) as { modules_choisis_le?: unknown } | null;
  return Boolean(value && value.modules_choisis_le);
}

export async function saveModuleStates(next: ModuleStates) {
  await writeSetting(MODULES_SETTINGS_KEY, next);
  setSiteConfig({ ...getSiteConfig(), modules: next });
}

export async function fetchAnnuaireSettings(): Promise<AnnuaireSettings> {
  return normalizeAnnuaire(await readSetting(ANNUAIRE_SETTINGS_KEY));
}

export async function saveAnnuaireSettings(next: AnnuaireSettings) {
  const clean = normalizeAnnuaire(next);
  await writeSetting(ANNUAIRE_SETTINGS_KEY, clean);
  setSiteConfig({ ...getSiteConfig(), annuaire: clean });
}

/** Marque effective du site (lue côté serveur au chargement de la page). */
export function useBrandSettings() {
  return { settings: getSiteConfig().brand };
}

/** Formulaire d'administration : relit la base pour éditer la dernière version enregistrée. */
export function useEditableBrandSettings() {
  const [settings, setSettings] = useState<BrandSettings>(() => getSiteConfig().brand);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(() => {
    setLoading(true);
    fetchBrandSettings()
      .then(setSettings)
      .catch(() => setSettings(getSiteConfig().brand))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  return { settings, loading, reload, setSettings };
}
