import { createFileRoute, Link } from "@tanstack/react-router";
import { AuthLayout } from "@/components/cds/AuthLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/forgot-password")({
  head: () => ({
    meta: [
      { title: "Mot de passe oublié — CDS" },
      { name: "description", content: "Gabarit CDS : demande de lien de réinitialisation du mot de passe." },
      { property: "og:title", content: "Mot de passe oublié — CDS" },
      { property: "og:description", content: "Gabarit CDS de récupération de mot de passe." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
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
      <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
        <div className="space-y-1.5">
          <Label htmlFor="email">Adresse e-mail</Label>
          <Input id="email" type="email" autoComplete="email" placeholder="nom@exemple.fr" />
        </div>
        <Button type="submit" className="w-full">
          Envoyer le lien
        </Button>
      </form>
    </AuthLayout>
  );
}
