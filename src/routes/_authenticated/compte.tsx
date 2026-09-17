import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PageShell } from "@/components/cds/SiteHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { bootstrapCurrentUser, useAuth } from "@/hooks/useAuth";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/_authenticated/compte")({
  head: () =>
    seo({
      title: "Mon compte",
      description: "Espace personnel : informations du compte et messages reçus pour les administrateurs.",
      path: "/compte",
      noindex: true,
    }),
  component: ComptePage,
});

type ContactMessage = {
  id: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  created_at: string;
};

function ComptePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [role, setRole] = useState<"admin" | "user" | null>(null);
  const [messages, setMessages] = useState<ContactMessage[]>([]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      try {
        const nextRole = await bootstrapCurrentUser();
        if (cancelled) return;
        setRole(nextRole);
        if (nextRole === "admin") {
          const { data } = await supabase
            .from("contact_messages")
            .select("id, name, email, subject, message, created_at")
            .order("created_at", { ascending: false })
            .limit(50);
          if (!cancelled && data) setMessages(data as ContactMessage[]);
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
          <Button variant="outline" onClick={signOut} title="Fermer la session en cours">
            Se déconnecter
          </Button>
        </div>
      </div>

      {role === "admin" && (
        <section className="mt-10">
          <h2 className="text-lg font-semibold text-foreground">Messages reçus</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Messages envoyés depuis le formulaire de contact du site.
          </p>
          <div className="mt-4 space-y-3">
            {messages.length === 0 && (
              <p className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
                Aucun message pour le moment.
              </p>
            )}
            {messages.map((m) => (
              <Card key={m.id}>
                <CardHeader>
                  <CardTitle className="text-base">{m.subject}</CardTitle>
                  <CardDescription>
                    {m.name} — {m.email} —{" "}
                    {new Date(m.created_at).toLocaleString("fr-FR")}
                  </CardDescription>
                </CardHeader>
                <CardContent className="whitespace-pre-line text-sm text-muted-foreground">
                  {m.message}
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}
    </PageShell>
  );
}
