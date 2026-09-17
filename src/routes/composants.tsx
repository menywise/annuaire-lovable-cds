import { createFileRoute } from "@tanstack/react-router";
import { PageShell } from "@/components/cds/SiteHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/composants")({
  head: () => ({
    meta: [
      { title: "Composants — CDS" },
      { name: "description", content: "Aperçu des composants CDS : boutons, champs, cartes, badges, alertes." },
      { property: "og:title", content: "Composants — CDS" },
      { property: "og:description", content: "Aperçu des composants du Consensus Design System." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ComposantsPage,
});

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="text-lg font-semibold text-foreground">{title}</h2>
      <div className="mt-4 rounded-xl border border-border bg-card p-6">{children}</div>
    </section>
  );
}

function ComposantsPage() {
  return (
    <PageShell>
      <h1 className="text-3xl font-bold text-foreground">Composants</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Composants shadcn/ui rendus avec les tokens CDS.
      </p>

      <Block title="Boutons">
        <div className="flex flex-wrap items-center gap-3">
          <Button>Principal</Button>
          <Button variant="secondary">Secondaire</Button>
          <Button variant="outline">Contour</Button>
          <Button variant="ghost">Discret</Button>
          <Button variant="destructive">Supprimer</Button>
          <Button size="sm">Petit</Button>
          <Button disabled>Désactivé</Button>
        </div>
      </Block>

      <Block title="Champs de formulaire">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="c-email">E-mail</Label>
            <Input id="c-email" placeholder="nom@exemple.fr" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="c-pass">Mot de passe</Label>
            <Input id="c-pass" type="password" placeholder="••••••••" />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="c-msg">Message</Label>
            <Textarea id="c-msg" placeholder="Votre message…" />
          </div>
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-2 text-sm text-muted-foreground">
              <Checkbox id="c-check" /> <Label htmlFor="c-check" className="font-normal">Case à cocher</Label>
            </span>
            <span className="flex items-center gap-2 text-sm text-muted-foreground">
              <Switch id="c-switch" /> <Label htmlFor="c-switch" className="font-normal">Interrupteur</Label>
            </span>
          </div>
        </div>
      </Block>

      <Block title="Badges">
        <div className="flex flex-wrap gap-2">
          <Badge>Par défaut</Badge>
          <Badge variant="secondary">Secondaire</Badge>
          <Badge variant="outline">Contour</Badge>
          <Badge variant="destructive">Erreur</Badge>
        </div>
      </Block>

      <Block title="Cartes">
        <div className="grid gap-4 sm:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Titre de carte</CardTitle>
              <CardDescription>Description courte de la carte.</CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Contenu de la carte, rayon 12px et ombre douce.
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Statistique</CardTitle>
              <CardDescription>Ce mois-ci</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-foreground">1 248</p>
            </CardContent>
          </Card>
        </div>
      </Block>

      <Block title="Alertes">
        <div className="space-y-3">
          <Alert>
            <AlertTitle>Information</AlertTitle>
            <AlertDescription>Message neutre à destination de l'utilisateur.</AlertDescription>
          </Alert>
          <Alert variant="destructive">
            <AlertTitle>Erreur</AlertTitle>
            <AlertDescription>Identifiants incorrects, veuillez réessayer.</AlertDescription>
          </Alert>
        </div>
      </Block>
    </PageShell>
  );
}
