import { createFileRoute, Link } from "@tanstack/react-router";
import { AuthLayout } from "@/components/cds/AuthLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";

export const Route = createFileRoute("/signup")({
  head: () => ({
    meta: [
      { title: "Créer un compte — CDS" },
      { name: "description", content: "Gabarit CDS de page d'inscription avec acceptation des conditions." },
      { property: "og:title", content: "Créer un compte — CDS" },
      { property: "og:description", content: "Gabarit CDS de page d'inscription." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SignupPage,
});

function SignupPage() {
  return (
    <AuthLayout
      title="Créer un compte"
      subtitle="Quelques secondes suffisent."
      footer={
        <>
          Déjà inscrit ?{" "}
          <Link to="/login" className="font-medium text-primary hover:underline">
            Se connecter
          </Link>
        </>
      }
    >
      <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
        <div className="space-y-1.5">
          <Label htmlFor="name">Nom complet</Label>
          <Input id="name" autoComplete="name" placeholder="Prénom Nom" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="email">Adresse e-mail</Label>
          <Input id="email" type="email" autoComplete="email" placeholder="nom@exemple.fr" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password">Mot de passe</Label>
          <Input id="password" type="password" autoComplete="new-password" placeholder="8 caractères minimum" />
        </div>
        <div className="flex items-start gap-2">
          <Checkbox id="cgu" className="mt-0.5" />
          <Label htmlFor="cgu" className="text-xs font-normal leading-relaxed text-muted-foreground">
            J'accepte les{" "}
            <Link to="/legal/cgu" className="text-primary hover:underline">conditions générales</Link> et la{" "}
            <Link to="/legal/confidentialite" className="text-primary hover:underline">politique de confidentialité</Link>.
          </Label>
        </div>
        <Button type="submit" className="w-full">
          Créer mon compte
        </Button>
      </form>
    </AuthLayout>
  );
}
