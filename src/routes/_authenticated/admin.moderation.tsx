import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { ConfirmButton } from "@/components/cds/ConfirmButton";
import { AdminShell, useIsAdmin } from "@/components/cds/AdminShell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { seo } from "@/lib/seo";
import { isFeatureOn, requireAnyFeature } from "@/config/features";

export const Route = createFileRoute("/_authenticated/admin/moderation")({
  head: () =>
    seo({
      title: "Modération",
      description: "Validation des avis, des commentaires et gestion des discussions du forum.",
      path: "/admin/moderation",
      noindex: true,
    }),
  beforeLoad: () => requireAnyFeature(["reviews", "blog", "forum"]),
  component: AdminModerationPage,
});

type Review = {
  id: string;
  author_name: string;
  rating: number;
  title: string;
  content: string;
  approved: boolean;
  created_at: string;
};

type Comment = {
  id: string;
  author_name: string;
  content: string;
  approved: boolean;
  created_at: string;
};

type Topic = {
  id: string;
  title: string;
  author_name: string;
  locked: boolean;
  created_at: string;
};

type Reply = {
  id: string;
  topic_id: string;
  author_name: string;
  content: string;
  created_at: string;
  forum_topics: { title: string } | null;
};

/** Texte brut d'une réponse enregistrée en HTML, pour un aperçu court et sûr. */
function plainText(html: string) {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function AdminModerationPage() {
  const isAdmin = useIsAdmin();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [replies, setReplies] = useState<Reply[]>([]);
  const [loadError, setLoadError] = useState(false);

  const reload = useCallback(async () => {
    const [r, c, t, rp] = await Promise.all([
      supabase.from("reviews").select("*").order("created_at", { ascending: false }),
      supabase.from("blog_comments").select("*").order("created_at", { ascending: false }),
      supabase.from("forum_topics").select("*").order("created_at", { ascending: false }),
      supabase
        .from("forum_replies")
        .select("id, topic_id, author_name, content, created_at, forum_topics(title)")
        .order("created_at", { ascending: false })
        .limit(200),
    ]);
    setLoadError(Boolean(r.error || c.error || t.error || rp.error));
    setReviews((r.data ?? []) as Review[]);
    setComments((c.data ?? []) as Comment[]);
    setTopics((t.data ?? []) as Topic[]);
    setReplies((rp.data ?? []) as Reply[]);
  }, []);

  useEffect(() => {
    if (isAdmin) void reload();
  }, [isAdmin, reload]);

  function done(error: unknown, message: string) {
    if (error) {
      toast.error("Action impossible.", { description: "Réessayez dans un instant." });
      return;
    }
    toast.success(message);
    void reload();
  }

  const pendingReviews = reviews.filter((r) => !r.approved).length;
  const pendingComments = comments.filter((c) => !c.approved).length;

  return (
    <AdminShell
      title="Modération"
      intro="Vous gardez la main sur ce qui apparaît publiquement : rien n'est publié tant que vous ne l'avez pas validé."
    >
      {loadError && (
        <div className="mb-6 rounded-lg border border-destructive/40 p-4 text-sm text-destructive">
          Une partie des contenus n'a pas pu être chargée.{" "}
          <button
            type="button"
            className="underline"
            onClick={() => void reload()}
            title="Recharger les contenus à modérer"
          >
            Réessayer
          </button>
        </div>
      )}
      <Tabs
        defaultValue={
          isFeatureOn("reviews") ? "avis" : isFeatureOn("blog") ? "commentaires" : "forum"
        }
      >
        <TabsList>
          {isFeatureOn("reviews") ? (
            <TabsTrigger value="avis">
              Avis {pendingReviews > 0 ? `(${pendingReviews})` : ""}
            </TabsTrigger>
          ) : null}
          {isFeatureOn("blog") ? (
            <TabsTrigger value="commentaires">
              Commentaires {pendingComments > 0 ? `(${pendingComments})` : ""}
            </TabsTrigger>
          ) : null}
          {isFeatureOn("forum") ? (
            <>
              <TabsTrigger value="forum">Discussions</TabsTrigger>
              <TabsTrigger value="reponses">Réponses</TabsTrigger>
            </>
          ) : null}
        </TabsList>

        <TabsContent value="avis" className="space-y-3 pt-6">
          {reviews.length === 0 && (
            <p className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
              Aucun avis reçu pour l'instant.
            </p>
          )}
          {reviews.map((review) => (
            <div key={review.id} className="rounded-xl border border-border bg-card p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold text-foreground">
                  {review.title || "Sans titre"} — {review.rating}/5
                </p>
                <Badge variant={review.approved ? "default" : "secondary"}>
                  {review.approved ? "Publié" : "En attente"}
                </Badge>
              </div>
              <p className="mt-2 whitespace-pre-line text-sm text-muted-foreground">
                {review.content}
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                {review.author_name} — {new Date(review.created_at).toLocaleString("fr-FR")}
              </p>
              <div className="mt-3 flex gap-2">
                <Button
                  size="sm"
                  onClick={async () =>
                    done(
                      (
                        await supabase
                          .from("reviews")
                          .update({ approved: !review.approved })
                          .eq("id", review.id)
                      ).error,
                      review.approved ? "Avis retiré." : "Avis publié.",
                    )
                  }
                  title={review.approved ? "Retirer cet avis du site" : "Publier cet avis"}
                >
                  {review.approved ? "Retirer" : "Publier"}
                </Button>
                <ConfirmButton
                  title="Supprimer définitivement cet avis"
                  question="Supprimer cet avis ?"
                  onConfirm={async () =>
                    done((await supabase.from("reviews").delete().eq("id", review.id)).error, "Avis supprimé.")
                  }
                />
              </div>
            </div>
          ))}
        </TabsContent>

        <TabsContent value="commentaires" className="space-y-3 pt-6">
          {comments.length === 0 && (
            <p className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
              Aucun commentaire reçu pour l'instant.
            </p>
          )}
          {comments.map((comment) => (
            <div key={comment.id} className="rounded-xl border border-border bg-card p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold text-foreground">{comment.author_name}</p>
                <Badge variant={comment.approved ? "default" : "secondary"}>
                  {comment.approved ? "Publié" : "En attente"}
                </Badge>
              </div>
              <p className="mt-2 whitespace-pre-line text-sm text-muted-foreground">
                {comment.content}
              </p>
              <div className="mt-3 flex gap-2">
                <Button
                  size="sm"
                  onClick={async () =>
                    done(
                      (
                        await supabase
                          .from("blog_comments")
                          .update({ approved: !comment.approved })
                          .eq("id", comment.id)
                      ).error,
                      comment.approved ? "Commentaire retiré." : "Commentaire publié.",
                    )
                  }
                  title={comment.approved ? "Retirer ce commentaire" : "Publier ce commentaire"}
                >
                  {comment.approved ? "Retirer" : "Publier"}
                </Button>
                <ConfirmButton
                  title="Supprimer définitivement ce commentaire"
                  question="Supprimer ce commentaire ?"
                  onConfirm={async () =>
                    done(
                      (await supabase.from("blog_comments").delete().eq("id", comment.id)).error,
                      "Commentaire supprimé.",
                    )
                  }
                />
              </div>
            </div>
          ))}
        </TabsContent>

        <TabsContent value="forum" className="space-y-3 pt-6">
          {topics.length === 0 && (
            <p className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
              Aucune discussion ouverte.
            </p>
          )}
          {topics.map((topic) => (
            <div key={topic.id} className="rounded-xl border border-border bg-card p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold text-foreground">{topic.title}</p>
                <Badge variant={topic.locked ? "secondary" : "default"}>
                  {topic.locked ? "Close" : "Ouverte"}
                </Badge>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                {topic.author_name} — {new Date(topic.created_at).toLocaleString("fr-FR")}
              </p>
              <div className="mt-3 flex gap-2">
                <Button
                  size="sm"
                  onClick={async () =>
                    done(
                      (
                        await supabase
                          .from("forum_topics")
                          .update({ locked: !topic.locked })
                          .eq("id", topic.id)
                      ).error,
                      topic.locked ? "Discussion rouverte." : "Discussion close.",
                    )
                  }
                  title={topic.locked ? "Rouvrir cette discussion" : "Clore cette discussion"}
                >
                  {topic.locked ? "Rouvrir" : "Clore"}
                </Button>
                <ConfirmButton
                  title="Supprimer définitivement cette discussion"
                  question={`Supprimer la discussion « ${topic.title} » ?`}
                  detail="La discussion et toutes ses réponses sont supprimées définitivement."
                  onConfirm={async () =>
                    done(
                      (await supabase.from("forum_topics").delete().eq("id", topic.id)).error,
                      "Discussion supprimée.",
                    )
                  }
                />
              </div>
            </div>
          ))}
        </TabsContent>

        <TabsContent value="reponses" className="space-y-3 pt-6">
          {replies.length === 0 && (
            <p className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
              Aucune réponse publiée.
            </p>
          )}
          {replies.map((reply) => (
            <div key={reply.id} className="rounded-xl border border-border bg-card p-5">
              <p className="text-xs text-muted-foreground">
                {reply.author_name} — {new Date(reply.created_at).toLocaleString("fr-FR")} — dans «{" "}
                {reply.forum_topics?.title ?? "discussion supprimée"} »
              </p>
              <p className="mt-2 line-clamp-3 text-sm text-foreground">
                {plainText(reply.content)}
              </p>
              <div className="mt-3 flex gap-2">
                <Button size="sm" variant="outline" asChild>
                  <Link
                    to="/forum/$topicId"
                    params={{ topicId: reply.topic_id }}
                    title="Voir la réponse dans sa discussion"
                  >
                    Voir
                  </Link>
                </Button>
                <ConfirmButton
                  title="Supprimer définitivement cette réponse"
                  question="Supprimer cette réponse ?"
                  onConfirm={async () =>
                    done(
                      (await supabase.from("forum_replies").delete().eq("id", reply.id)).error,
                      "Réponse supprimée.",
                    )
                  }
                />
              </div>
            </div>
          ))}
        </TabsContent>
      </Tabs>
    </AdminShell>
  );
}
