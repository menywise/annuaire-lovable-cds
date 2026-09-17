import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { AuthLayout } from "@/components/cds/AuthLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/forgot-password")({
  head: () => ({
    meta: [
      { title: "Mot de passe oublié — PMM RDS" },
      { name: "description", content: "Recevez un lien par e-mail pour choisir un nouveau mot de passe." },
      { property: "og:title", content: "Mot de passe oublié — PMM RDS" },
      { property: "og:description", content: "Récupération de mot de passe." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setBusy(false);
    setSent(true);
  }

  return (
    <AuthLayout
      title="Mot de passe oublié"
      subtitle="Indiquez votre adresse e-mail : vous recevrez un lien pour choisir un nouveau mot de passe."
      footer={
        <Link to="/login" className="font-medium text-primary hover:underline">
          Retour à la connexion
        </Link>
      }
    >
      {sent ? (
        <Alert>
          <AlertTitle>E-mail envoyé</AlertTitle>
          <AlertDescription>
            Si un compte existe avec cette adresse, un lien de réinitialisation vient d'être envoyé.
          </AlertDescription>
        </Alert>
      ) : (
        <form className="space-y-4" onSubmit={onSubmit}>
          <div className="space-y-1.5">
            <Label htmlFor="email">Adresse e-mail</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="nom@exemple.fr"
            />
          </div>
          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? "Envoi…" : "Envoyer le lien"}
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}
