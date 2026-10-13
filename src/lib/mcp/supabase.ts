import { createClient } from "@supabase/supabase-js";
import type { ToolContext } from "@lovable.dev/mcp-js";
import type { Database } from "@/integrations/supabase/types";

type RuntimeGlobals = typeof globalThis & {
  Deno?: { env?: { get?: (name: string) => string | undefined } };
  process?: { env?: Record<string, string | undefined> };
};

function runtimeEnv(name: string): string | undefined {
  const runtime = globalThis as RuntimeGlobals;
  return runtime.Deno?.env?.get?.(name) ?? runtime.process?.env?.[name];
}

function configuredEnv(names: readonly string[]): string | undefined {
  for (const name of names) {
    const value = runtimeEnv(name)?.trim();
    if (value) return value;
  }
  return undefined;
}

function supabaseProjectUrl(): string {
  const url = configuredEnv(["SUPABASE_URL", "VITE_SUPABASE_URL"]);
  if (!url) throw new Error("SUPABASE_URL (ou VITE_SUPABASE_URL) est requis");
  return url;
}

function supabasePublishableKey(): string {
  const direct = configuredEnv(["SUPABASE_PUBLISHABLE_KEY", "VITE_SUPABASE_PUBLISHABLE_KEY"]);
  if (direct) return direct;
  const keyset = runtimeEnv("SUPABASE_PUBLISHABLE_KEYS");
  if (keyset) {
    try {
      const parsed: unknown = JSON.parse(keyset);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        const keys = parsed as Record<string, unknown>;
        const key = [keys["default"], ...Object.values(keys)]
          .find((v): v is string => typeof v === "string" && v.trim().startsWith("sb_publishable_"))
          ?.trim();
        if (key) return key;
      }
    } catch {
      /* dictionnaire illisible : on tente les noms historiques */
    }
  }
  const legacy = configuredEnv(["SUPABASE_ANON_KEY", "VITE_SUPABASE_ANON_KEY"]);
  if (legacy) return legacy;
  throw new Error("Aucune clé publique Supabase disponible");
}

/** Client sans identité : RLS appliquée au rôle anonyme (contenus publics). */
export function supabaseAnon() {
  return createClient<Database>(supabaseProjectUrl(), supabasePublishableKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Client portant le jeton vérifié de l'appelant : RLS appliquée à cet utilisateur. */
export function supabaseForUser(ctx: ToolContext) {
  const token = ctx.getToken();
  if (!token) throw new Error("Jeton OAuth vérifié requis");
  return createClient<Database>(supabaseProjectUrl(), supabasePublishableKey(), {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function origine(adresse: string | undefined): string | null {
  try {
    const url = new URL(adresse ?? "");
    return url.protocol === "https:" || url.protocol === "http:" ? url.origin : null;
  } catch {
    return null;
  }
}

/**
 * Adresse du site audité : SITE_URL, sinon l'adresse réglée en admin, sinon ce serveur.
 * `base_url` ne peut désigner que l'une de ces adresses : le serveur ne charge jamais une
 * adresse choisie librement par l'appelant.
 */
export async function siteBaseUrl(override?: string): Promise<string> {
  const { loadSiteConfig } = await import("@/lib/site-config.functions");
  const reglee = origine((await loadSiteConfig().catch(() => null))?.brand.url);
  let courante: string | null = null;
  try {
    const { getRequest } = await import("@tanstack/react-start/server");
    courante = origine(getRequest().url);
  } catch {
    /* hors requête : seule l'adresse réglée compte */
  }
  const autorisees = [origine(configuredEnv(["SITE_URL"])), reglee, courante].filter(
    (o): o is string => Boolean(o),
  );
  if (override?.trim()) {
    const demandee = origine(override.trim());
    if (!demandee || !autorisees.includes(demandee)) {
      throw new Error(
        `base_url refusée : seules l'adresse du site réglée en admin et celle de ce serveur sont acceptées (${autorisees.join(", ") || "aucune connue"}).`,
      );
    }
    return demandee;
  }
  const base = autorisees[0];
  if (!base) throw new Error("Adresse du site inconnue : réglez-la en admin.");
  return base;
}

export function textResult(payload: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(payload, null, 2) }] };
}

export function errorResult(message: string) {
  return { content: [{ type: "text" as const, text: message }], isError: true as const };
}
