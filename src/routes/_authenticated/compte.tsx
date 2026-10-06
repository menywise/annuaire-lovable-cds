import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PageShell } from "@/components/cds/SiteHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { bootstrapCurrentUser, useAuth } from "@/hooks/useAuth";
import { seo } from "@/lib/seo";
import { isFeatureOn } from "@/config/features";

export const Route = createFileRoute("/_authenticated/compte")({
  head: () =>
    seo({
      title: "Mon compte",
      description:
        "Espace personnel : informations du compte et messages reçus pour les administrateurs.",
      path: "/compte",
      noindex: true,
    }),
  component: ComptePage,
});


function ComptePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [role, setRole] = useState<"admin" | "user" | null>(null);
  const [newMessages, setNewMessages] = useState<number | null>(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      try {
        const nextRole = await bootstrapCurrentUser();
        if (cancelled) return;
        setRole(nextRole);
        if (nextRole === "admin") {
          const { count } = await supabase
            .from("contact_messages")
            .select("id", { count: "exact", head: true })
            .eq("status", "nouveau");
          if (!cancelled) setNewMessages(count ?? 0);
        }
      } catch {
        if (!cancelled) setRole("user");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/login" });
  }

  return (
    <PageShell>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Mon compte</h1>
          <p className="mt-2 text-sm text-muted-foreground">{user?.email}</p>
        </div>
        <div className="flex items-center gap-3">
          {role && (
            <Badge variant={role === "admin" ? "default" : "secondary"}>
              {role === "admin" ? "Administrateur" : "Utilisateur"}
            </Badge>
          )}
          <Link
            to="/profil"
            title="Modifier mon nom et mon mot de passe"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Mon profil
          </Link>
          <Link
            to="/profil"
            hash="mot-de-passe"
            title="Choisir un nouveau mot de passe"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent max-md:min-h-11"
          >
            Changer mon mot de passe
          </Link>
          <Button variant="outline" onClick={signOut} title="Fermer la session en cours">
            Se déconnecter
          </Button>
        </div>
      </div>

      {role === "admin" && isFeatureOn("contact") && (
        <section className="mt-10 rounded-xl border border-border bg-card p-5">
          <h2 className="text-lg font-semibold text-foreground">Messages reçus</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {newMessages === null
              ? "Messages envoyés depuis le formulaire de contact du site."
              : newMessages === 0
                ? "Aucun nouveau message : tout est traité."
                : `${newMessages} nouveau${newMessages > 1 ? "x" : ""} message${newMessages > 1 ? "s" : ""} à traiter.`}
          </p>
          <Link
            to="/admin/messages"
            title="Ouvrir la boîte de réception"
            className="mt-4 inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Ouvrir la boîte de réception
          </Link>
        </section>
      )}
    </PageShell>
  );
}
