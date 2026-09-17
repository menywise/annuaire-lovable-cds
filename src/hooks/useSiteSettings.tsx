import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { brand } from "@/config/brand";

/** Paramètres de marque modifiables depuis l'espace d'administration. */
export type BrandSettings = {
  shortName: string;
  name: string;
  tagline: string;
  url: string;
  legal: {
    company: string;
    form: string;
    capital: string;
    rcs: string;
    address: string;
    country: string;
    publisher: string;
  };
  host: {
    name: string;
    detail: string;
    address: string;
    phone: string;
  };
};

export const BRAND_SETTINGS_KEY = "brand";

/** Valeurs par défaut : le fichier de marque sert uniquement de repli. */
export const defaultBrandSettings: BrandSettings = {
  shortName: brand.shortName,
  name: brand.name,
  tagline: brand.tagline,
  url: brand.url,
  legal: { ...brand.legal },
  host: { ...brand.host },
};

function merge(value: unknown): BrandSettings {
  const v = (value ?? {}) as Partial<BrandSettings>;
  return {
    ...defaultBrandSettings,
    ...v,
    legal: { ...defaultBrandSettings.legal, ...(v.legal ?? {}) },
    host: { ...defaultBrandSettings.host, ...(v.host ?? {}) },
  };
}

export async function fetchBrandSettings(): Promise<BrandSettings> {
  const { data, error } = await supabase
    .from("site_settings")
    .select("value")
    .eq("key", BRAND_SETTINGS_KEY)
    .maybeSingle();
  if (error) throw error;
  return merge(data?.value);
}

export async function saveBrandSettings(next: BrandSettings) {
  const { data: userData } = await supabase.auth.getUser();
  const { error } = await supabase.from("site_settings").upsert(
    {
      key: BRAND_SETTINGS_KEY,
      value: next as unknown as Record<string, unknown>,
      updated_at: new Date().toISOString(),
      updated_by: userData.user?.id ?? null,
    },
    { onConflict: "key" },
  );
  if (error) throw error;
}

/** Marque effective du site : paramètres enregistrés, sinon valeurs par défaut. */
export function useBrandSettings() {
  const [settings, setSettings] = useState<BrandSettings>(defaultBrandSettings);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(() => {
    setLoading(true);
    fetchBrandSettings()
      .then(setSettings)
      .catch(() => setSettings(defaultBrandSettings))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  return { settings, loading, reload, setSettings };
}
