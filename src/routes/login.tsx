import { createFileRoute, Link } from "@tanstack/react-router";
import { AuthLayout } from "@/components/cds/AuthLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Connexion — CDS" },
      { name: "description", content: "Gabarit CDS de page de connexion : e-mail, mot de passe, lien de récupération." },
      { property: "og:title", content: "Connexion — CDS" },
      { property: "og:description", content: "Gabarit CDS de page de connexion." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  return (
    <AuthLayout
      title="Connexion"
      subtitle="Accédez à votre espace."
      footer={
        <>
          Pas encore de compte ?{" "}
          <Link to="/signup" className="font-medium text-primary hover:underline">
            Créer un compte
          </Link>
        </>
      }
    >
      <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
        <div className="space-y-1.5">
          <Label htmlFor="email">Adresse e-mail</Label>
          <Input id="email" type="email" autoComplete="email" placeholder="nom@exemple.fr" />
        </div>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Mot de passe</Label>
            <Link to="/forgot-password" className="text-xs text-primary hover:underline">
              Mot de passe oublié ?
            </Link>
          </div>
          <Input id="password" type="password" autoComplete="current-password" placeholder="••••••••" />
        </div>
        <div className="flex items-center gap-2">
          <Checkbox id="remember" />
          <Label htmlFor="remember" className="text-sm font-normal text-muted-foreground">
            Rester connecté
          </Label>
        </div>
        <Button type="submit" className="w-full">
          Se connecter
        </Button>
      </form>
    </AuthLayout>
  );
}
