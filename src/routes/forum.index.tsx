import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { PageShell } from "@/components/cds/SiteHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { listTopics } from "@/lib/content.functions";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/forum/")({
  loader: () => listTopics(),
  head: () =>
    seo({
      title: "Forum",
      description:
        "L'endroit où poser une question précise et obtenir une réponse utile : entraide entre personnes qui construisent des sites et des applications.",
      path: "/forum",
      type: "website",
    }),
  errorComponent: () => (
    <PageShell>
      <p className="text-sm text-muted-foreground">Les discussions n'ont pas pu être chargées.</p>
    </PageShell>
  ),
  notFoundComponent: () => (
    <PageShell>
      <p className="text-sm text-muted-foreground">Cette page n'existe pas.</p>
    </PageShell>
  ),
  component: ForumIndex,
});

function ForumIndex() {
  const topics = Route.useLoaderData();
  const { user } = useAuth();
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function createTopic(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!user) return;
    const form = e.currentTarget;
    const data = new FormData(form);
    setBusy(true);
    const { error } = await supabase.from("forum_topics").insert({
      author_id: user.id,
      author_name: (user.user_metadata?.["full_name"] as string) || user.email?.split("@")[0] || "Membre",
      title: String(data.get("title") ?? "").trim(),
      content: String(data.get("content") ?? "").trim(),
    });
    setBusy(false);
    if (error) {
      toast.error("Sujet non créé.", { description: "Réessayez dans un instant." });
      return;
    }
    form.reset();
    toast.success("Votre sujet est ouvert.", { description: "La communauté peut désormais y répondre." });
    router.invalidate();
  }

  return (
    <PageShell>
      <div className="mx-auto max-w-[820px]">
        <p className="text-xs font-medium uppercase tracking-wide text-primary">Forum</p>
        <h1 className="mt-2 text-3xl font-bold text-foreground">Posez votre question, on avance ensemble</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Vous bloquez sur un point précis ? Décrivez-le simplement : quelqu'un est probablement
          passé par là avant vous, et la réponse servira aussi aux suivants.
        </p>

        {topics.length === 0 ? (
          <p className="mt-8 rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
            Aucune discussion pour le moment. Ouvrez la première.
          </p>
        ) : (
          <ul className="mt-6 space-y-3">
            {topics.map((topic) => (
              <li key={topic.id} className="rounded-xl border border-border bg-card p-5">
                <h2 className="text-base font-semibold text-foreground">
                  <Link
                    to="/forum/$topicId"
                    params={{ topicId: topic.id }}
                    title={`Ouvrir la discussion : ${topic.title}`}
                    className="hover:text-primary"
                  >
                    {topic.title}
                  </Link>
                </h2>
                <p className="mt-1.5 line-clamp-2 text-sm text-muted-foreground">{topic.content}</p>
                <p className="mt-2 text-xs text-muted-foreground">
                  {topic.author_name} — {new Date(topic.created_at).toLocaleDateString("fr-FR")}
                  {topic.locked ? " — discussion close" : ""}
                </p>
              </li>
            ))}
          </ul>
        )}

        <section className="mt-10 rounded-xl border border-border bg-card p-6">
          <h2 className="text-base font-semibold text-foreground">Ouvrir une discussion</h2>
          {user ? (
            <form onSubmit={createTopic} className="mt-4 space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="topic-title">Sujet</Label>
                <Input id="topic-title" name="title" required placeholder="Votre question en une phrase" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="topic-content">Détails</Label>
                <Textarea
                  id="topic-content"
                  name="content"
                  rows={4}
                  required
                  placeholder="Le contexte, ce que vous avez déjà essayé…"
                />
              </div>
              <Button type="submit" disabled={busy} title="Publier votre discussion">
                {busy ? "Publication…" : "Publier ma question"}
              </Button>
            </form>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">
              Pour garder un espace sain, seuls les membres connectés publient.{" "}
              <Link to="/login" title="Se connecter pour participer au forum" className="text-primary hover:underline">
                Se connecter
              </Link>{" "}
              ou{" "}
              <Link to="/signup" title="Créer un compte pour participer au forum" className="text-primary hover:underline">
                créer un compte
              </Link>
              .
            </p>
          )}
        </section>
      </div>
    </PageShell>
  );
}
