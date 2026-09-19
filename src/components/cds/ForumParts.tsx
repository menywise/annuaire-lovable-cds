import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { Heart, MessageSquare, Eye, Bell, BellOff } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export function CategoryBadge({ name, color }: { name: string; color: string }) {
  return (
    <span
      className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium"
      style={{ borderColor: color, color }}
    >
      {name}
    </span>
  );
}

export function TopicMeta({
  replies,
  likes,
  views,
}: {
  replies: number;
  likes: number;
  views: number;
}) {
  return (
    <span className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
      <span className="inline-flex items-center gap-1">
        <MessageSquare className="size-3.5" aria-hidden="true" />
        {replies} réponse{replies > 1 ? "s" : ""}
      </span>
      <span className="inline-flex items-center gap-1">
        <Heart className="size-3.5" aria-hidden="true" />
        {likes} j'aime
      </span>
      <span className="inline-flex items-center gap-1">
        <Eye className="size-3.5" aria-hidden="true" />
        {views} vue{views > 1 ? "s" : ""}
      </span>
    </span>
  );
}

/** Bouton « j'aime » sur une discussion ou une réponse. */
export function LikeButton({
  topicId,
  replyId,
  initialCount,
}: {
  topicId?: string;
  replyId?: string;
  initialCount: number;
}) {
  const { user } = useAuth();
  const [count, setCount] = useState(initialCount);
  const [liked, setLiked] = useState(false);
  const [busy, setBusy] = useState(false);

  async function toggle() {
    if (!user) {
      toast.info("Connectez-vous pour aimer cette contribution.");
      return;
    }
    setBusy(true);
    if (liked) {
      const query = supabase.from("forum_likes").delete().eq("user_id", user.id);
      const { error } = topicId
        ? await query.eq("topic_id", topicId)
        : await query.eq("reply_id", replyId!);
      if (!error) {
        setLiked(false);
        setCount((c) => Math.max(0, c - 1));
      }
    } else {
      const { error } = await supabase.from("forum_likes").insert({
        user_id: user.id,
        ...(topicId ? { topic_id: topicId } : { reply_id: replyId! }),
      });
      if (!error) {
        setLiked(true);
        setCount((c) => c + 1);
      } else {
        setLiked(true);
      }
    }
    setBusy(false);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy}
      aria-pressed={liked}
      title={liked ? "Retirer mon j'aime" : "Aimer cette contribution"}
      className={`inline-flex min-h-11 items-center gap-1.5 rounded-md border px-3 text-xs font-medium transition-colors ${
        liked
          ? "border-primary bg-accent text-primary-text"
          : "border-border text-muted-foreground hover:bg-accent hover:text-foreground"
      }`}
    >
      <Heart className={`size-4 ${liked ? "fill-current" : ""}`} aria-hidden="true" />
      {count}
    </button>
  );
}

/** Suivre une discussion pour la retrouver dans son espace. */
export function FollowButton({ topicId }: { topicId: string }) {
  const { user } = useAuth();
  const [following, setFollowing] = useState(false);
  const [busy, setBusy] = useState(false);

  async function toggle() {
    if (!user) {
      toast.info("Connectez-vous pour suivre cette discussion.");
      return;
    }
    setBusy(true);
    if (following) {
      await supabase.from("forum_follows").delete().eq("user_id", user.id).eq("topic_id", topicId);
      setFollowing(false);
      toast.success("Vous ne suivez plus cette discussion.");
    } else {
      const { error } = await supabase
        .from("forum_follows")
        .insert({ user_id: user.id, topic_id: topicId });
      setFollowing(true);
      if (!error)
        toast.success("Discussion suivie.", { description: "Retrouvez-la dans votre espace." });
    }
    setBusy(false);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy}
      aria-pressed={following}
      title={following ? "Ne plus suivre cette discussion" : "Suivre cette discussion"}
      className={`inline-flex min-h-11 items-center gap-1.5 rounded-md border px-3 text-xs font-medium transition-colors ${
        following
          ? "border-primary bg-accent text-primary-text"
          : "border-border text-muted-foreground hover:bg-accent hover:text-foreground"
      }`}
    >
      {following ? (
        <BellOff className="size-4" aria-hidden="true" />
      ) : (
        <Bell className="size-4" aria-hidden="true" />
      )}
      {following ? "Suivi" : "Suivre"}
    </button>
  );
}

type Member = {
  user_id: string;
  display_name: string;
  score: number;
  topics: number;
  replies: number;
};

/** Classement des membres les plus actifs, sur trois périodes. */
export function TopMembers({
  data,
}: {
  data: { always: Member[]; month: Member[]; week: Member[] };
}) {
  const [period, setPeriod] = useState<"week" | "month" | "always">("month");
  const list = data[period];

  const tabs = [
    {
      key: "week" as const,
      label: "7 jours",
      title: "Membres les plus actifs sur les 7 derniers jours",
    },
    {
      key: "month" as const,
      label: "30 jours",
      title: "Membres les plus actifs sur les 30 derniers jours",
    },
    { key: "always" as const, label: "Toujours", title: "Membres les plus actifs depuis le début" },
  ];

  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <h2 className="text-sm font-semibold text-foreground">Membres les plus actifs</h2>
      <div className="mt-3 flex gap-1" role="group" aria-label="Période du classement">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            title={tab.title}
            onClick={() => setPeriod(tab.key)}
            className={`min-h-11 rounded-md px-2.5 text-xs font-medium transition-colors sm:min-h-9 ${
              period === tab.key
                ? "bg-accent text-foreground"
                : "text-muted-foreground hover:bg-accent hover:text-foreground"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {list.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">
          Pas encore d'activité sur cette période.
        </p>
      ) : (
        <ol className="mt-4 space-y-2">
          {list.slice(0, 8).map((member, index) => (
            <li key={member.user_id} className="flex items-center gap-3 text-sm">
              <span className="grid size-6 shrink-0 place-items-center rounded-full bg-muted text-xs font-semibold text-foreground">
                {index + 1}
              </span>
              <Link
                to="/membres/$memberId"
                params={{ memberId: member.user_id }}
                title={`Voir le profil de ${member.display_name}`}
                className="truncate text-foreground hover:text-primary-text"
              >
                {member.display_name}
              </Link>
              <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                {member.score} pts
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
