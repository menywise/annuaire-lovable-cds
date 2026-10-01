import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { AuthLayout } from "@/components/cds/AuthLayout";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";

/**
 * Liste blanche finale stricte des hostnames autorisés pour les redirections OAuth absolues.
 */
const ALLOWED_REDIRECT_HOSTNAMES = new Set(["lovable.dev", "lovable.app"]);

/**
 * Valide et assainit une URL de redirection pour prévenir les attaques Open Redirect.
 *
 * Règles strictes :
 * 1. URL relative : doit commencer par "/" mais PAS par "//" ni "/\"
 * 2. URL absolue :
 *    - Localhost (127.0.0.1 / localhost) est autorisé UNIQUEMENT en mode développement (import.meta.env.DEV === true).
 *    - Pour tous les autres domaines distants, le protocole HTTPS est EXIGÉ STRICTEMENT (http:// rejeté).
 *    - Le hostname doit appartenir à ALLOWED_REDIRECT_HOSTNAMES (ou sous-domaine direct).
 * 3. En cas d'URL non autorisée ou malformée : repli sur "/tableau-de-bord" + log de sécurité.
 */
export function getSafeRedirectUrl(
  target: string | null | undefined,
  fallback = "/tableau-de-bord",
): string {
  if (!target || typeof target !== "string") return fallback;

  const trimmed = target.trim();

  // 1. URL relative (ex: "/tableau-de-bord")
  if (trimmed.startsWith("/") && !trimmed.startsWith("//") && !trimmed.startsWith("/\\")) {
    return trimmed;
  }

  // 2. URL absolue avec parsing new URL()
  try {
    const parsed = new URL(trimmed);
    const hostname = parsed.hostname.toLowerCase();

    // Localhost autorisé uniquement en développement
    const isLocalhost = hostname === "localhost" || hostname === "127.0.0.1";
    if (isLocalhost) {
      if (import.meta.env.DEV) {
        return parsed.toString();
      }
      console.warn("[OAuth Security] Tentative de redirection localhost bloquée en production.");
      return fallback;
    }

    // Domaines distants : HTTPS obligatoire
    if (parsed.protocol !== "https:") {
      console.warn(
        "[OAuth Security] Protocole non sécurisé rejeté (HTTPS requis) :",
        parsed.protocol,
      );
      return fallback;
    }

    // Vérification de la liste blanche (plus le site lui-même, quel que soit son domaine)
    const sameSite = typeof window !== "undefined" && hostname === window.location.hostname;
    const isAllowed =
      sameSite ||
      Array.from(ALLOWED_REDIRECT_HOSTNAMES).some(
        (domain) => hostname === domain || hostname.endsWith("." + domain),
      );

    if (isAllowed) {
      return parsed.toString();
    }
  } catch {
    console.warn("[OAuth Security] URL de redirection malformée :", target);
    return fallback;
  }

  console.warn("[OAuth Security] Redirection non autorisée interceptée vers :", target);
  return fallback;
}

type AuthorizationData = {
  client?: { name?: string };
  redirect_url?: string;
  redirect_to?: string;
};

type OauthApi = {
  getAuthorizationDetails: (
    id: string,
  ) => Promise<{ data: AuthorizationData | null; error: { message: string } | null }>;
  approveAuthorization: (
    id: string,
  ) => Promise<{ data: AuthorizationData | null; error: { message: string } | null }>;
  denyAuthorization: (
    id: string,
  ) => Promise<{ data: AuthorizationData | null; error: { message: string } | null }>;
};

function oauthApi(): OauthApi {
  return (supabase.auth as unknown as { oauth: OauthApi }).oauth;
}

export const Route = createFileRoute("/.lovable/oauth/consent")({
  ssr: false,
  validateSearch: (s: Record<string, unknown>) => ({
    authorization_id: typeof s["authorization_id"] === "string" ? s["authorization_id"] : "",
  }),
  beforeLoad: async ({ search, location }) => {
    if (!search.authorization_id) throw new Error("Demande d'autorisation incomplète.");
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      const next = location.pathname + location.searchStr;
      throw redirect({ to: "/login", search: { next } });
    }
  },
  loader: async ({ location }) => {
    const authorizationId = new URLSearchParams(location.search).get("authorization_id")!;
    const { data, error } = await oauthApi().getAuthorizationDetails(authorizationId);
    if (error) throw error;
    const immediate = data?.redirect_url ?? data?.redirect_to;
    if (immediate && !data?.client) {
      const safeTarget = getSafeRedirectUrl(immediate);
      if (typeof window !== "undefined") {
        window.location.href = safeTarget;
      }
      return data;
    }
    return data;
  },
  component: ConsentPage,
  errorComponent: ({ error }) => (
    <AuthLayout title="Autorisation impossible" subtitle="Cette demande n'a pas pu être chargée.">
      <p className="text-sm text-light">{String((error as Error)?.message ?? error)}</p>
    </AuthLayout>
  ),
});

function ConsentPage() {
  const details = Route.useLoaderData() as AuthorizationData;
  const { authorization_id } = Route.useSearch();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const clientName = details?.client?.name ?? "cette application";

  async function decide(approve: boolean) {
    setBusy(true);
    setError(null);
    const api = oauthApi();
    const { data, error: err } = approve
      ? await api.approveAuthorization(authorization_id)
      : await api.denyAuthorization(authorization_id);
    if (err) {
      setBusy(false);
      setError(err.message);
      return;
    }
    const target = data?.redirect_url ?? data?.redirect_to;
    if (!target) {
      setBusy(false);
      setError("Aucune adresse de retour fournie par le serveur d'autorisation.");
      return;
    }

    const safeTarget = getSafeRedirectUrl(target);
    window.location.href = safeTarget;
  }

  return (
    <AuthLayout
      title={`Autoriser ${clientName}`}
      subtitle="Cette application agira en votre nom, avec vos droits sur ce site."
    >
      <div className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertTitle>Autorisation impossible</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <p className="text-sm text-light">
          En autorisant, {clientName} pourra lire et écrire les données auxquelles votre compte a
          déjà accès.
        </p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            className="flex-1"
            disabled={busy}
            onClick={() => decide(true)}
            title="Autoriser l'accès"
          >
            {busy ? "Un instant…" : "Autoriser"}
          </Button>
          <Button
            variant="outline"
            className="flex-1"
            disabled={busy}
            onClick={() => decide(false)}
            title="Refuser l'accès"
          >
            Refuser
          </Button>
        </div>
      </div>
    </AuthLayout>
  );
}
