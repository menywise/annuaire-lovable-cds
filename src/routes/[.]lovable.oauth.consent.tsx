import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { AuthLayout } from "@/components/cds/AuthLayout";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";

type OauthApi = {
  getAuthorizationDetails: (id: string) => Promise<{ data: any; error: any }>;
  approveAuthorization: (id: string) => Promise<{ data: any; error: any }>;
  denyAuthorization: (id: string) => Promise<{ data: any; error: any }>;
};

function oauthApi(): OauthApi {
  return (supabase.auth as unknown as { oauth: OauthApi }).oauth;
}

export const Route = createFileRoute("/.lovable/oauth/consent")({
  ssr: false,
  validateSearch: (s: Record<string, unknown>) => ({
    authorization_id: typeof s['authorization_id'] === "string" ? s['authorization_id'] : "",
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
    if (immediate && !data?.client) throw redirect({ href: immediate });
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
  const details = Route.useLoaderData() as any;
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
    window.location.href = target;
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
          En autorisant, {clientName} pourra lire et écrire les données auxquelles votre compte a déjà accès.
        </p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button className="flex-1" disabled={busy} onClick={() => decide(true)} title="Autoriser l'accès">
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
