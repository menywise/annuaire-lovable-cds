import { createServerFn } from "@tanstack/react-start";
import { publicClient } from "@/lib/supabase-public";
import { check } from "@/lib/check";

export type ForumCategory = {
  id: string;
  slug: string;
  name: string;
  description: string;
  color: string;
  position: number;
};

/** Nombre de sujets affichés dans la vue d'ensemble (les plus récemment actifs). */
const OVERVIEW_TOPICS = 200;
/** Dernières réponses affichées dans la vue d'ensemble. */
const OVERVIEW_RECENT_REPLIES = 6;

/**
 * Vue d'ensemble du forum : thématiques, discussions, activité récente.
 * Les compteurs (réponses et « j'aime » par sujet, sujets par thématique, totaux) sont calculés par
 * la base (forum_topic_counts, forum_category_counts) : jamais une table entière ni un échantillon.
 */
export const getForumOverview = createServerFn({ method: "GET" })
  .inputValidator((input: { category?: string } | undefined) => input ?? {})
  .handler(async ({ data: input }) => {
    const client = publicClient();

    const [categoriesRes, topicsRes, repliesRes, categoryCountsRes] = await Promise.all([
      client
        .from("forum_categories")
        .select("id, slug, name, description, color, position")
        .order("position", { ascending: true }),
      client
        .from("forum_topics")
        .select(
          "id, title, content, author_id, author_name, locked, views, category_id, created_at, last_activity_at, moderation_note, moderated_at",
        )
        .order("last_activity_at", { ascending: false })
        .limit(OVERVIEW_TOPICS),
      client
        .from("forum_replies")
        .select("id, topic_id, author_name, created_at")
        .order("created_at", { ascending: false })
        .limit(OVERVIEW_RECENT_REPLIES),
      client.rpc("forum_category_counts"),
    ]);
    const categories = check(categoriesRes, { contexte: "forum_categories" });
    const allTopics = check(topicsRes, { contexte: "forum_topics" });
    const replies = check(repliesRes, { contexte: "forum_replies" });
    const categoryCounts = check(categoryCountsRes, { contexte: "forum_category_counts" }) ?? [];

    const cats = (categories ?? []) as ForumCategory[];
    const topics = allTopics ?? [];

    const topicCounts = topics.length
      ? (check(await client.rpc("forum_topic_counts", { _topic_ids: topics.map((t) => t.id) }), {
          contexte: "forum_topic_counts",
        }) ?? [])
      : [];
    const replyCount = new Map<string, number>();
    const likeCount = new Map<string, number>();
    for (const row of topicCounts) {
      replyCount.set(row.topic_id, Number(row.replies));
      likeCount.set(row.topic_id, Number(row.likes));
    }

    const activeCategory = input.category
      ? (cats.find((c) => c.slug === input.category) ?? null)
      : null;

    const enriched = topics.map((topic) => ({
      ...topic,
      replies: replyCount.get(topic.id) ?? 0,
      likes: likeCount.get(topic.id) ?? 0,
      category: cats.find((c) => c.id === topic.category_id) ?? null,
    }));

    const visible = activeCategory
      ? enriched.filter((t) => t.category_id === activeCategory.id)
      : enriched;

    // Une ligne par thématique (category_id nul : sujets sans thématique) ; les totaux en sont la somme.
    const counts = new Map<string, number>();
    const totals = { topics: 0, replies: 0, likes: 0 };
    for (const row of categoryCounts) {
      if (row.category_id) counts.set(row.category_id, Number(row.topics));
      totals.topics += Number(row.topics);
      totals.replies += Number(row.replies);
      totals.likes += Number(row.likes);
    }

    const recentReplies = (replies ?? []).map((reply) => ({
      id: reply.id,
      topicId: reply.topic_id,
      authorName: reply.author_name,
      createdAt: reply.created_at,
      topicTitle: topics.find((t) => t.id === reply.topic_id)?.title ?? "Discussion",
    }));

    return {
      categories: cats.map((c) => ({ ...c, topics: counts.get(c.id) ?? 0 })),
      activeCategory,
      topics: visible,
      recentTopics: enriched.slice(0, 6),
      recentReplies,
      totals,
    };
  });

export const getTopMembers = createServerFn({ method: "GET" }).handler(async () => {
  const client = publicClient();
  const now = Date.now();
  const week = new Date(now - 7 * 864e5).toISOString();
  const month = new Date(now - 30 * 864e5).toISOString();

  const [all, last30, last7] = await Promise.all([
    client.rpc("forum_top_members", {}),
    client.rpc("forum_top_members", { _since: month }),
    client.rpc("forum_top_members", { _since: week }),
  ]);

  return {
    always: check(all, { contexte: "forum_top_members" }) ?? [],
    month: check(last30, { contexte: "forum_top_members" }) ?? [],
    week: check(last7, { contexte: "forum_top_members" }) ?? [],
  };
});

/**
 * Détail d'une discussion : contenu, réponses, mentions « j'aime ».
 * Les « j'aime » sont comptés par la base (forum_topic_counts pour le sujet, forum_reply_like_counts
 * pour ses réponses) : la table forum_likes n'est plus chargée.
 */
export const getTopicDetail = createServerFn({ method: "GET" })
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data: input }) => {
    const client = publicClient();
    const topic = check(
      await client
        .from("forum_topics")
        .select(
          "id, title, content, author_id, author_name, locked, views, category_id, created_at, last_activity_at, moderation_note, moderated_at",
        )
        .eq("id", input.id)
        .maybeSingle(),
      { contexte: "forum_topics" },
    );
    if (!topic) return null;

    const [repliesRes, topicCountsRes, replyLikesRes, categoryRes] = await Promise.all([
      client
        .from("forum_replies")
        .select(
          "id, author_id, author_name, content, accepted, created_at, moderation_note, moderated_at",
        )
        .eq("topic_id", topic.id)
        .order("created_at", { ascending: true }),
      client.rpc("forum_topic_counts", { _topic_ids: [topic.id] }),
      client.rpc("forum_reply_like_counts", { _topic_id: topic.id }),
      topic.category_id
        ? client
            .from("forum_categories")
            .select("id, slug, name, color")
            .eq("id", topic.category_id)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
    ]);
    const replies = check(repliesRes, { contexte: "forum_replies" });
    const topicCounts = check(topicCountsRes, { contexte: "forum_topic_counts" }) ?? [];
    const replyLikes = check(replyLikesRes, { contexte: "forum_reply_like_counts" }) ?? [];
    const category = check(categoryRes, { contexte: "forum_categories" });

    const topicLikes = Number(topicCounts.find((row) => row.topic_id === topic.id)?.likes ?? 0);
    const likesByReply = new Map<string, number>();
    for (const row of replyLikes) likesByReply.set(row.reply_id, Number(row.likes));

    const sorted = [...(replies ?? [])].sort((a, b) => Number(b.accepted) - Number(a.accepted));

    return {
      topic: { ...topic, likes: topicLikes },
      category: category ?? null,
      replies: sorted.map((reply) => ({ ...reply, likes: likesByReply.get(reply.id) ?? 0 })),
    };
  });

/** Annuaire public des membres ayant accepté d'y figurer. */
export const listMembers = createServerFn({ method: "GET" }).handler(async () => {
  const client = publicClient();
  const [membersRes, rankingRes] = await Promise.all([
    client
      .from("member_profiles")
      .select(
        "user_id, display_name, avatar_url, bio, job_title, website, accepts_messages, created_at",
      )
      .eq("listed", true)
      .order("created_at", { ascending: true }),
    client.rpc("forum_top_members", {}),
  ]);
  const members = check(membersRes, { contexte: "member_profiles" });
  const ranking = check(rankingRes, { contexte: "forum_top_members" });

  const scores = new Map<string, number>();
  for (const row of ranking ?? []) scores.set(row.user_id, Number(row.score));

  return (members ?? []).map((m) => ({ ...m, score: scores.get(m.user_id) ?? 0 }));
});

/** Profil public d'un membre et ses dernières contributions. */
export const getMember = createServerFn({ method: "GET" })
  .inputValidator((input: { userId: string }) => input)
  .handler(async ({ data: input }) => {
    const client = publicClient();
    const profile = check(
      await client
        .from("member_profiles")
        .select(
          "user_id, display_name, avatar_url, bio, job_title, website, listed, accepts_messages, created_at",
        )
        .eq("user_id", input.userId)
        .maybeSingle(),
      { contexte: "member_profiles" },
    );
    if (!profile) return null;

    const [topicsRes, repliesRes] = await Promise.all([
      client
        .from("forum_topics")
        .select("id, title, created_at")
        .eq("author_id", input.userId)
        .order("created_at", { ascending: false })
        .limit(10),
      client
        .from("forum_replies")
        .select("id, topic_id, content, created_at")
        .eq("author_id", input.userId)
        .order("created_at", { ascending: false })
        .limit(10),
    ]);
    const topics = check(topicsRes, { contexte: "forum_topics" });
    const replies = check(repliesRes, { contexte: "forum_replies" });

    return { profile, topics: topics ?? [], replies: replies ?? [] };
  });

/** Témoignages validés, du plus mis en avant au plus récent. */
export const listTestimonials = createServerFn({ method: "GET" }).handler(async () => {
  const data = check(
    await publicClient()
      .from("testimonials")
      .select(
        "id, author_name, role_title, company, avatar_url, content, outcome, featured, position, created_at, moderation_note, moderated_at",
      )
      .eq("approved", true)
      .order("featured", { ascending: false })
      .order("position", { ascending: true })
      .order("created_at", { ascending: false }),
    { contexte: "testimonials" },
  );
  return data ?? [];
});
