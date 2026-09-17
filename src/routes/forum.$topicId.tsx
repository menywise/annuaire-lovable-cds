import { createFileRoute, Link, notFound, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { PageShell } from "@/components/cds/SiteHeader";
import { ShareButtons } from "@/components/cds/ShareButtons";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { getTopic } from "@/lib/content.functions";
import { breadcrumbJsonLd, seo } from "@/lib/seo";

export const Route = createFileRoute("/forum/$topicId")({
  loader: async ({ params }) => {
    const data = await getTopic({ data: { id: params.topicId } });
    if (!data) throw notFound();
    return data;
  },
  head: ({ loaderData, params }) => {
    const topic = loaderData?.topic;
    const base = seo({
      title: topic?.title ?? "Discussion",
      description: (topic?.content ?? "Discussion du forum.").slice(0, 155),
      path: `/forum/${params.topicId}`,
      type: "article",
    });
    return {
      ...base,
      scripts: [
        breadcrumbJsonLd([
          { name: "Accueil", path: "/" },
          { name: "Forum", path: "/forum" },
          { name: topic?.title ?? "Discussion", path: `/forum/${params.topicId}` },
        ]),
      ],
    };
  },
  errorComponent: () => (
    <PageShell>
      <p className="text-sm text-muted-foreground">Cette discussion n'a pas pu être chargée.</p>
    </PageShell>
  ),
  notFoundComponent: () => (
    <PageShell>
      <h1 className="text-2xl font-bold text-foreground">Discussion introuvable</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        <Link to="/forum" title="Revenir à la liste des discussions" className="text-primary hover:underline">
          Revenir au forum
        </Link>
      </p>
    </PageShell>
  ),
  component: TopicPage,
});

function TopicPage() {
  const { topic, replies } = Route.useLoaderData();
  const { user } = useAuth();
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function reply(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!user) return;
    const form = e.currentTarget;
    const data = new FormData(form);
    setBusy(true);
    const { error } = await supabase.from("forum_replies").insert({
      topic_id: topic.id,
      author_id: user.id,
      author_name: (user.user_metadata?.["full_name"] as string) || user.email?.split("@")[0] || "Membre",
      content: String(data.get("content") ?? "").trim(),
    });
    setBusy(false);
    if (error) {
      toast.error("Réponse non enregistrée.", { description: "Réessayez dans un instant." });
      return;
    }
    form.reset();
    toast.success("Votre réponse est publiée.");
    router.invalidate();
  }

  return (
    <PageShell>
      <article className="mx-auto max-w-[760px]">
        <Link to="/forum" title="Revenir à la liste des discussions" className="text-xs font-medium text-primary hover:underline">
          ← Forum
        </Link>
        <h1 className="mt-3 text-2xl font-bold text-foreground">{topic.title}</h1>
        <p className="mt-1 text-xs text-muted-foreground">
          {topic.author_name} — {new Date(topic.created_at).toLocaleDateString("fr-FR")}
        </p>
        <p className="mt-4 whitespace-pre-line text-sm text-muted-foreground">{topic.content}</p>

        <div className="mt-6 border-t border-border pt-5">
          <ShareButtons path={`/forum/${topic.id}`} title={topic.title} />
        </div>

        <h2 className="mt-10 text-lg font-semibold text-foreground">
          Réponses ({replies.length})
        </h2>
        {replies.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">
            Aucune réponse pour l'instant. La vôtre sera la bienvenue.
          </p>
        ) : (
          <ul className="mt-4 space-y-3">
            {replies.map((item) => (
              <li key={item.id} className="rounded-lg border border-border bg-card p-4">
                <p className="text-sm font-medium text-foreground">{item.author_name}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {new Date(item.created_at).toLocaleDateString("fr-FR")}
                </p>
                <p className="mt-2 whitespace-pre-line text-sm text-muted-foreground">{item.content}</p>
              </li>
            ))}
          </ul>
        )}

        {topic.locked ? (
          <p className="mt-6 rounded-lg border border-border bg-muted p-4 text-sm text-muted-foreground">
            Cette discussion est close : elle reste consultable, mais n'accepte plus de réponse.
          </p>
        ) : user ? (
          <form onSubmit={reply} className="mt-6 space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="reply">Votre réponse</Label>
              <Textarea id="reply" name="content" rows={4} required placeholder="Votre contribution…" />
            </div>
            <Button type="submit" disabled={busy} title="Publier votre réponse">
              {busy ? "Envoi…" : "Répondre"}
            </Button>
          </form>
        ) : (
          <p className="mt-6 rounded-lg border border-dashed border-border p-5 text-sm text-muted-foreground">
            <Link to="/login" title="Se connecter pour répondre" className="text-primary hover:underline">
              Connectez-vous
            </Link>{" "}
            pour participer à cette discussion.
          </p>
        )}
      </article>
    </PageShell>
  );
}
