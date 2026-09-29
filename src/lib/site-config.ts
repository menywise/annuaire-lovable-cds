import { brandFallback } from "@/config/brand";
import { defaultModuleStates, normalizeModules, type ModuleStates } from "@/config/modules";

/**
 * CDS — Configuration du site : source unique = table `site_settings`.
 *
 * Cycle de vie :
 * 1. Serveur : la route racine lit la base dans `beforeLoad` (avant toute autre
 *    route) et appelle `setSiteConfig`. Les `head()`, `seo()`, `isFeatureOn()`
 *    et le rendu HTML utilisent donc les valeurs saisies en admin.
 * 2. La route racine écrit la configuration dans la page (`window.__CDS_SITE__`),
 *    exécutée avant le code du navigateur : l'hydratation voit les mêmes valeurs.
 * 3. Après un enregistrement en admin, `setSiteConfig` puis rechargement.
 *
 * Toutes les requêtes d'un même serveur lisent la même ligne : la valeur partagée
 * entre requêtes simultanées est identique, sauf pendant une modification en admin.
 */

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

export type SiteConfig = {
  brand: BrandSettings;
  modules: ModuleStates;
};

export const BRAND_SETTINGS_KEY = "brand";
export const MODULES_SETTINGS_KEY = "modules";

export const defaultBrandSettings: BrandSettings = {
  ...brandFallback,
  legal: { ...brandFallback.legal },
  host: { ...brandFallback.host },
};

/** Fusionne une valeur lue en base avec les valeurs de repli (champs manquants ou mal typés ignorés). */
export function normalizeBrand(value: unknown): BrandSettings {
  const v = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
  const pick = <T extends Record<string, string>>(base: T, raw: unknown): T => {
    const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
    const out = { ...base };
    for (const k of Object.keys(base) as Array<keyof T>) {
      if (typeof r[k as string] === "string") out[k] = r[k as string] as T[keyof T];
    }
    return out;
  };
  const top = pick(
    {
      shortName: defaultBrandSettings.shortName,
      name: defaultBrandSettings.name,
      tagline: defaultBrandSettings.tagline,
      url: defaultBrandSettings.url,
    },
    v,
  );
  return {
    ...top,
    url: top.url.trim().replace(/\/+$/, ""),
    legal: pick(defaultBrandSettings.legal, v["legal"]),
    host: pick(defaultBrandSettings.host, v["host"]),
  };
}

export function buildSiteConfig(rows: Array<{ key: string; value: unknown }>): SiteConfig {
  const byKey = new Map(rows.map((r) => [r.key, r.value]));
  return {
    brand: normalizeBrand(byKey.get(BRAND_SETTINGS_KEY)),
    modules: normalizeModules(byKey.get(MODULES_SETTINGS_KEY)),
  };
}

export const fallbackSiteConfig: SiteConfig = {
  brand: defaultBrandSettings,
  modules: { ...defaultModuleStates },
};

declare global {
  interface Window {
    __CDS_SITE__?: SiteConfig;
  }
}

function initialConfig(): SiteConfig {
  if (typeof window !== "undefined" && window.__CDS_SITE__) {
    const c = window.__CDS_SITE__;
    return { brand: normalizeBrand(c.brand), modules: normalizeModules(c.modules) };
  }
  return fallbackSiteConfig;
}

let current: SiteConfig = initialConfig();

export function getSiteConfig(): SiteConfig {
  return current;
}

export function setSiteConfig(next: SiteConfig) {
  current = next;
  if (typeof window !== "undefined") window.__CDS_SITE__ = next;
}

/** Script à placer dans la page : transmet la configuration au navigateur avant l'hydratation. */
export function siteConfigScript(config: SiteConfig = current) {
  return `window.__CDS_SITE__=${JSON.stringify(config).replace(/</g, "\\u003c")};`;
}

/** Construit une URL absolue à partir d'un chemin interne (relative tant que l'URL n'est pas saisie). */
export function absoluteUrl(path: string) {
  return `${current.brand.url}${path.startsWith("/") ? path : `/${path}`}`;
}
