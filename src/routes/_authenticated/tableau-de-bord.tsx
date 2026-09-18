import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PageShell } from "@/components/cds/SiteHeader";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { bootstrapCurrentUser, useAuth } from "@/hooks/useAuth";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/_authenticated/tableau-de-bord")({
  head: () =>
    seo({
      title: "Tableau de bord",
      description: "Vue d'ensemble de votre activité et de celle du site.",
      path: "/tableau-de-bord",
      noindex: true,
    }),
  component: DashboardPage,
});

type Stats = {
  messages: number | null;
  subscribers: number | null;
  reviews: number | null;
  topics: number | null;
  posts: number | null;
  comments: number | null;
};

const raccourcis = [
  { to: "/admin", label: "Paramètres du site", desc: "Nom, coordonnées légales, hébergeur", title: "Régler les paramètres du site" },
  { to: "/compte", label: "Messages reçus", desc: "Demandes envoyées par le formulaire", title: "Consulter les messages reçus" },
  { to: "/profil", label: "Mon profil", desc: "Nom affiché, profil public et mot de passe", title: "Modifier mon profil" },
  { to: "/decouvrir", label: "Découvrir", desc: "Tout ce que votre espace permet déjà", title: "Faire le tour des fonctionnalités actives" },
  { to: "/messagerie", label: "Messagerie", desc: "Vos échanges privés", title: "Ouvrir ma messagerie" },
  { to: "/membres", label: "Annuaire", desc: "Les membres de la communauté", title: "Parcourir l'annuaire" },
  { to: "/forum", label: "Forum", desc: "Discussions en cours", title: "Ouvrir le forum" },
] as const;

function DashboardPage() {
  const { user } = useAuth();
  const [role, setRole] = useState<"admin" | "user" | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      let nextRole: "admin" | "user" = "user";
      try {
        nextRole = await bootstrapCurrentUser();
      } catch {
        nextRole = "user";
      }
      if (cancelled) return;
      setRole(nextRole);

      const count = async (table: "contact_messages" | "newsletter_subscribers" | "reviews" | "forum_topics" | "blog_posts" | "blog_comments") => {
        const { count: value } = await supabase.from(table).select("id", { count: "exact", head: true });
        return value ?? null;
      };

      const [messages, subscribers, reviews, topics, posts, comments] = await Promise.all([
        nextRole === "admin" ? count("contact_messages") : Promise.resolve(null),
        nextRole === "admin" ? count("newsletter_subscribers") : Promise.resolve(null),
        count("reviews"),
        count("forum_topics"),
        count("blog_posts"),
        count("blog_comments"),
      ]);
      if (!cancelled) setStats({ messages, subscribers, reviews, topics, posts, comments });
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const cards = [
    { label: "Messages reçus", value: stats?.messages, adminOnly: true },
    { label: "Abonnés à la lettre", value: stats?.subscribers, adminOnly: true },
    { label: "Avis publiés", value: stats?.reviews, adminOnly: false },
    { label: "Discussions", value: stats?.topics, adminOnly: false },
    { label: "Articles", value: stats?.posts, adminOnly: false },
    { label: "Commentaires", value: stats?.comments, adminOnly: false },
  ].filter((card) => !card.adminOnly || role === "admin");

  return (
    <PageShell>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Tableau de bord</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Bonjour {user?.email}. Voici où en est votre espace, en un coup d'œil.
          </p>
        </div>
        {role && (
          <Badge variant={role === "admin" ? "default" : "secondary"}>
            {role === "admin" ? "Administrateur" : "Utilisateur"}
          </Badge>
        )}
      </div>

      <section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {stats === null
          ? Array.from({ length: 3 }).map((_, index) => (
              <Skeleton key={index} className="h-24 w-full rounded-xl" />
            ))
          : cards.map((card) => (
              <Card key={card.label}>
                <CardHeader className="pb-2">
                  <CardDescription>{card.label}</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold text-foreground">{card.value ?? 0}</p>
                </CardContent>
              </Card>
            ))}
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold text-foreground">Vos raccourcis</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {raccourcis
            .filter((item) => role === "admin" || (item.to !== "/admin" && item.to !== "/compte"))
            .map((item) => (
              <Link
                key={item.to}
                to={item.to}
                title={item.title}
                className="rounded-xl border border-border bg-card p-5 transition-colors hover:border-primary"
              >
                <p className="text-sm font-semibold text-foreground">{item.label}</p>
                <p className="mt-1 text-sm text-muted-foreground">{item.desc}</p>
              </Link>
            ))}
        </div>
      </section>
    </PageShell>
  );
}
