import { createFileRoute, Link } from "@tanstack/react-router";
import { AuthLayout } from "@/components/cds/AuthLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Nouveau mot de passe — CDS" },
      { name: "description", content: "Gabarit CDS : définition d'un nouveau mot de passe après réinitialisation." },
      { property: "og:title", content: "Nouveau mot de passe — CDS" },
      { property: "og:description", content: "Gabarit CDS de définition d'un nouveau mot de passe." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  return (
    <AuthLayout
      title="Nouveau mot de passe"
      subtitle="Choisissez un mot de passe d'au moins 8 caractères."
      footer={
        <Link to="/login" className="font-medium text-primary hover:underline">
          Retour à la connexion
        </Link>
      }
    >
      <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
        <div className="space-y-1.5">
          <Label htmlFor="password">Nouveau mot de passe</Label>
          <Input id="password" type="password" autoComplete="new-password" placeholder="••••••••" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="confirm">Confirmer le mot de passe</Label>
          <Input id="confirm" type="password" autoComplete="new-password" placeholder="••••••••" />
        </div>
        <Button type="submit" className="w-full">
          Enregistrer
        </Button>
      </form>
    </AuthLayout>
  );
}
