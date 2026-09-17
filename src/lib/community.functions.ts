import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

/** Client public (lecture seule) utilisable pendant le rendu serveur. */
function publicClient() {
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
  const url = process.env["SUPABASE_URL"]!;
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) {
          h.delete("Authorization");
        }
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
}

export type ForumCategory = {
  id: string;
  slug: string;
  name: string;
  description: string;
  color: string;
  position: number;
};

export const listCategories = createServerFn({ method: "GET" }).handler(async () => {
  const { data } = await publicClient()
    .from("forum_categories")
    .select("id, slug, name, description, color, position")
    .order("position", { ascending: true });
  return (data ?? []) as ForumCategory[];
});

/** Vue d'ensemble du forum : thématiques, discussions, activité récente. */
export const getForumOverview = createServerFn({ method: "GET" })
  .inputValidator((input: { category?: string } | undefined) => input ?? {})
  .handler(async ({ data: input }) => {
    const client = publicClient();

    const [{ data: categories }, { data: allTopics }, { data: replies }, { data: likes }] =
      await Promise.all([
        client
          .from("forum_categories")
          .select("id, slug, name, description, color, position")
          .order("position", { ascending: true }),
        client
          .from("forum_topics")
          .select("id, title, content, author_id, author_name, locked, views, category_id, created_at, last_activity_at")
          .order("last_activity_at", { ascending: false })
          .limit(200),
        client
          .from("forum_replies")
          .select("id, topic_id, author_name, created_at")
          .order("created_at", { ascending: false })
          .limit(500),
        client.from("forum_likes").select("id, topic_id, reply_id"),
      ]);

    const cats = (categories ?? []) as ForumCategory[];
    const topics = allTopics ?? [];
    const replyCount = new Map<string, number>();
    for (const reply of replies ?? []) {
      replyCount.set(reply.topic_id, (replyCount.get(reply.topic_id) ?? 0) + 1);
    }
    const likeCount = new Map<string, number>();
    for (const like of likes ?? []) {
      if (like.topic_id) likeCount.set(like.topic_id, (likeCount.get(like.topic_id) ?? 0) + 1);
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

    const counts = new Map<string, number>();
    for (const topic of enriched) {
      if (topic.category_id) counts.set(topic.category_id, (counts.get(topic.category_id) ?? 0) + 1);
    }

    const recentReplies = (replies ?? []).slice(0, 6).map((reply) => ({
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
      totals: {
        topics: enriched.length,
        replies: (replies ?? []).length,
        likes: (likes ?? []).length,
      },
    };
  });

export const getTopMembers = createServerFn({ method: "GET" }).handler(async () => {
  const client = publicClient();
  const now = Date.now();
  const week = new Date(now - 7 * 864e5).toISOString();
  const month = new Date(now - 30 * 864e5).toISOString();

  const [all, last30, last7] = await Promise.all([
    client.rpc("forum_top_members", { _since: null }),
    client.rpc("forum_top_members", { _since: month }),
    client.rpc("forum_top_members", { _since: week }),
  ]);

  return {
    always: all.data ?? [],
    month: last30.data ?? [],
    week: last7.data ?? [],
  };
});

/** Détail d'une discussion : contenu, réponses, mentions « j'aime ». */
export const getTopicDetail = createServerFn({ method: "GET" })
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data: input }) => {
    const client = publicClient();
    const { data: topic } = await client
      .from("forum_topics")
      .select("id, title, content, author_id, author_name, locked, views, category_id, created_at, last_activity_at")
      .eq("id", input.id)
      .maybeSingle();
    if (!topic) return null;

    const [{ data: replies }, { data: likes }, { data: category }] = await Promise.all([
      client
        .from("forum_replies")
        .select("id, author_id, author_name, content, accepted, created_at")
        .eq("topic_id", topic.id)
        .order("created_at", { ascending: true }),
      client.from("forum_likes").select("id, topic_id, reply_id, user_id"),
      topic.category_id
        ? client
            .from("forum_categories")
            .select("id, slug, name, color")
            .eq("id", topic.category_id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

    const allLikes = likes ?? [];
    const countFor = (key: "topic_id" | "reply_id", id: string) =>
      allLikes.filter((l) => l[key] === id).length;

    const sorted = [...(replies ?? [])].sort((a, b) => Number(b.accepted) - Number(a.accepted));

    return {
      topic: { ...topic, likes: countFor("topic_id", topic.id) },
      category: category ?? null,
      replies: sorted.map((reply) => ({ ...reply, likes: countFor("reply_id", reply.id) })),
    };
  });

/** Annuaire public des membres ayant accepté d'y figurer. */
export const listMembers = createServerFn({ method: "GET" }).handler(async () => {
  const client = publicClient();
  const [{ data: members }, { data: ranking }] = await Promise.all([
    client
      .from("member_profiles")
      .select("user_id, display_name, avatar_url, bio, job_title, website, accepts_messages, created_at")
      .eq("listed", true)
      .order("created_at", { ascending: true }),
    client.rpc("forum_top_members", { _since: null }),
  ]);

  const scores = new Map<string, number>();
  for (const row of ranking ?? []) scores.set(row.user_id, Number(row.score));

  return (members ?? []).map((m) => ({ ...m, score: scores.get(m.user_id) ?? 0 }));
});

/** Profil public d'un membre et ses dernières contributions. */
export const getMember = createServerFn({ method: "GET" })
  .inputValidator((input: { userId: string }) => input)
  .handler(async ({ data: input }) => {
    const client = publicClient();
    const { data: profile } = await client
      .from("member_profiles")
      .select("user_id, display_name, avatar_url, bio, job_title, website, listed, accepts_messages, created_at")
      .eq("user_id", input.userId)
      .maybeSingle();
    if (!profile) return null;

    const [{ data: topics }, { data: replies }] = await Promise.all([
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

    return { profile, topics: topics ?? [], replies: replies ?? [] };
  });

/** Témoignages validés, du plus mis en avant au plus récent. */
export const listTestimonials = createServerFn({ method: "GET" }).handler(async () => {
  const { data } = await publicClient()
    .from("testimonials")
    .select("id, author_name, role_title, company, avatar_url, content, outcome, featured, position, created_at")
    .eq("approved", true)
    .order("featured", { ascending: false })
    .order("position", { ascending: true })
    .order("created_at", { ascending: false });
  return data ?? [];
});

/** Feuille de route et plan directeur publics. */
export const getPilotage = createServerFn({ method: "GET" }).handler(async () => {
  const client = publicClient();
  const [{ data: items }, { data: sections }] = await Promise.all([
    client
      .from("roadmap_items")
      .select("id, title, description, lot, status, priority, position")
      .eq("public_visible", true)
      .order("position", { ascending: true }),
    client
      .from("masterplan_sections")
      .select("id, title, content, position")
      .order("position", { ascending: true }),
  ]);
  return { roadmap: items ?? [], masterplan: sections ?? [] };
});
