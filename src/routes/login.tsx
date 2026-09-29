import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { AuthLayout } from "@/components/cds/AuthLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { bootstrapCurrentUser } from "@/hooks/useAuth";
import { GoogleSignInButton } from "@/components/cds/GoogleSignInButton";

import { seo } from "@/lib/seo";
import { getSiteConfig } from "@/lib/site-config";

function safeNext(value: unknown): string | undefined {
  // Chemin interne uniquement : « // » et « /\ » mèneraient vers un autre site.
  return typeof value === "string" && /^\/(?![/\\])/.test(value) ? value : undefined;
}

export const Route = createFileRoute("/login")({
  validateSearch: (s: Record<string, unknown>): { next?: string } => {
    const next = safeNext(s["next"]);
    return next ? { next } : {};
  },
  head: () =>
    seo({
      title: "Connexion",
      description:
        `Connectez-vous à votre espace personnel ${getSiteConfig().brand.name} avec votre adresse e-mail et votre mot de passe.`,
      path: "/login",
      type: "website",
    }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const { next } = Route.useSearch();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (signInError) {
      setError("Adresse e-mail ou mot de passe incorrect.");
      setBusy(false);
      return;
    }
    try {
      await bootstrapCurrentUser();
    } catch {
      /* le profil sera recréé à la prochaine connexion */
    }
    if (next) {
      window.location.href = next;
      return;
    }
    navigate({ to: "/compte" });
  }

  return (
    <AuthLayout
      title="Connexion"
      subtitle="Accédez à votre espace."
      footer={
        <>
          Pas encore de compte ?{" "}
          <Link
            to="/signup"
            title="Créer un compte"
            className="font-medium text-primary-text hover:underline"
          >
            Créer un compte
          </Link>
        </>
      }
    >
      <form className="space-y-4" onSubmit={onSubmit}>
        {error && (
          <Alert variant="destructive">
            <AlertTitle>Connexion impossible</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
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
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Mot de passe</Label>
            <Link
              to="/forgot-password"
              title="Recevoir un lien de réinitialisation du mot de passe"
              className="text-xs text-primary-text hover:underline"
            >
              Mot de passe oublié ?
            </Link>
          </div>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
          />
        </div>
        <Button type="submit" className="w-full" disabled={busy}>
          {busy ? "Connexion…" : "Se connecter"}
        </Button>
        <GoogleSignInButton {...(next ? { redirectTo: next } : {})} />
      </form>
    </AuthLayout>
  );
}
