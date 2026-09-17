import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { AuthLayout } from "@/components/cds/AuthLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/verification-email")({
  head: () =>
    seo({
      title: "Vérification de votre adresse",
      description: "Confirmez votre adresse e-mail pour activer votre compte.",
      path: "/verification-email",
      noindex: true,
    }),
  component: VerificationEmailPage,
});

function VerificationEmailPage() {
  const [busy, setBusy] = useState(false);

  async function resend(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const email = String(new FormData(e.currentTarget).get("email") ?? "").trim();
    setBusy(true);
    const { error } = await supabase.auth.resend({
      type: "signup",
      email,
      options: { emailRedirectTo: `${window.location.origin}/login` },
    });
    setBusy(false);
    if (error) {
      toast.error("Envoi impossible.", {
        description: "Vérifiez l'adresse saisie, puis réessayez dans un instant.",
      });
      return;
    }
    toast.success("Nouveau lien envoyé.", {
      description: "Regardez votre boîte de réception, et les indésirables au besoin.",
    });
  }

  return (
    <AuthLayout
      title="Confirmez votre adresse"
      subtitle="Un lien vous attend dans votre boîte e-mail. Un clic, et votre compte est actif."
    >
      <div className="space-y-4 text-sm text-muted-foreground">
        <p>
          Vous venez de créer votre compte : il ne manque qu'une confirmation pour protéger votre
          adresse. Ouvrez le message que nous venons de vous envoyer et cliquez sur le lien.
        </p>
        <p>
          Rien reçu au bout de quelques minutes ? Vérifiez le dossier des indésirables, puis
          demandez un nouveau lien ci-dessous.
        </p>
      </div>

      <form onSubmit={resend} className="mt-6 space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="verif-email">Votre adresse e-mail</Label>
          <Input
            id="verif-email"
            name="email"
            type="email"
            required
            autoComplete="email"
            placeholder="nom@exemple.fr"
          />
        </div>
        <Button type="submit" className="w-full" disabled={busy} title="Recevoir un nouveau lien de confirmation">
          {busy ? "Envoi…" : "Recevoir un nouveau lien"}
        </Button>
      </form>

      <p className="mt-6 text-sm text-muted-foreground">
        Adresse déjà confirmée ?{" "}
        <Link to="/login" title="Se connecter à son espace" className="text-primary-text hover:underline">
          Se connecter
        </Link>
      </p>
    </AuthLayout>
  );
}
