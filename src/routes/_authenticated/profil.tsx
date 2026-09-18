import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { PageShell } from "@/components/cds/SiteHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/_authenticated/profil")({
  head: () =>
    seo({
      title: "Mon profil",
      description: "Modifier son nom affiché et son mot de passe.",
      path: "/profil",
      noindex: true,
    }),
  component: ProfilPage,
});

function ProfilPage() {
  const { user } = useAuth();
  const [fullName, setFullName] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", user.id)
        .maybeSingle();
      if (!cancelled && data?.full_name) setFullName(data.full_name);
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  async function saveName(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setSavingName(true);
    const { error } = await supabase
      .from("profiles")
      .update({ full_name: fullName.trim() })
      .eq("id", user.id);
    setSavingName(false);
    if (error) toast.error("Le nom n'a pas pu être enregistré.");
    else toast.success("Nom mis à jour.");
  }

  async function savePassword(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const password = String(form.get("password") ?? "");
    const confirm = String(form.get("confirm") ?? "");
    if (password.length < 8) {
      toast.error("Le mot de passe doit contenir au moins 8 caractères.");
      return;
    }
    if (password !== confirm) {
      toast.error("Les deux mots de passe ne correspondent pas.");
      return;
    }
    setSavingPassword(true);
    const { error } = await supabase.auth.updateUser({ password });
    setSavingPassword(false);
    if (error) toast.error("Le mot de passe n'a pas pu être modifié.");
    else {
      toast.success("Mot de passe modifié.");
      e.currentTarget.reset();
    }
  }

  return (
    <PageShell>
      <div className="mx-auto max-w-[620px]">
        <nav aria-label="Fil d'Ariane" className="text-xs text-muted-foreground">
          <Link to="/compte" title="Revenir à mon compte" className="hover:text-foreground">
            Mon compte
          </Link>
          <span aria-hidden="true"> / </span>
          <span className="text-foreground">Mon profil</span>
        </nav>

        <h1 className="mt-2 text-3xl font-bold text-foreground">Mon profil</h1>
        <p className="mt-2 text-sm text-muted-foreground">{user?.email}</p>

        <Card className="mt-8">
          <CardHeader>
            <CardTitle className="text-base">Nom affiché</CardTitle>
            <CardDescription>Le nom utilisé dans l'interface et les échanges.</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={saveName}>
              <div className="space-y-1.5">
                <Label htmlFor="full_name">Nom complet</Label>
                <Input
                  id="full_name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  autoComplete="name"
                  placeholder="Prénom Nom"
                />
              </div>
              <Button type="submit" disabled={savingName}>
                {savingName ? "Enregistrement…" : "Enregistrer"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <PublicProfileCard />

        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-base">Mot de passe</CardTitle>
            <CardDescription>8 caractères minimum.</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={savePassword}>
              <div className="space-y-1.5">
                <Label htmlFor="password">Nouveau mot de passe</Label>
                <Input id="password" name="password" type="password" autoComplete="new-password" required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="confirm">Confirmer le mot de passe</Label>
                <Input id="confirm" name="confirm" type="password" autoComplete="new-password" required />
              </div>
              <Button type="submit" disabled={savingPassword}>
                {savingPassword ? "Modification…" : "Modifier le mot de passe"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </PageShell>
  );
}
