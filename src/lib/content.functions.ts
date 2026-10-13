import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { check } from "@/lib/check";

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

export const listFaq = createServerFn({ method: "GET" }).handler(async () => {
  const data = check(
    await publicClient()
      .from("faq_items")
      .select("id, question, answer, category, position")
      .eq("published", true)
      .order("position", { ascending: true }),
    { contexte: "faq_items" },
  );
  return data ?? [];
});

export const listPlans = createServerFn({ method: "GET" }).handler(async () => {
  const data = check(
    await publicClient()
      .from("pricing_plans")
      .select(
        "id, name, tagline, price_cents, currency, period, features, cta_label, highlighted, position",
      )
      .eq("active", true)
      .order("position", { ascending: true }),
    { contexte: "pricing_plans" },
  );
  return data ?? [];
});

export const listPosts = createServerFn({ method: "GET" }).handler(async () => {
  const data = check(
    await publicClient()
      .from("blog_posts")
      .select("id, slug, title, excerpt, content, cover_url, published_at, tags")
      .eq("published", true)
      .order("published_at", { ascending: false }),
    { contexte: "blog_posts" },
  );
  return data ?? [];
});

export const getPost = createServerFn({ method: "GET" })
  .inputValidator((input: { slug: string }) => input)
  .handler(async ({ data: input }) => {
    const client = publicClient();
    const post = check(
      await client
        .from("blog_posts")
        .select("id, slug, title, excerpt, content, cover_url, published_at, tags")
        .eq("published", true)
        .eq("slug", input.slug)
        .maybeSingle(),
      { contexte: "blog_posts" },
    );
    if (!post) return null;
    const comments = check(
      await client
        .from("blog_comments")
        .select("id, author_name, content, created_at, moderation_note, moderated_at")
        .eq("post_id", post.id)
        .eq("approved", true)
        .order("created_at", { ascending: true }),
      { contexte: "blog_comments" },
    );
    const others = check(
      await client
        .from("blog_posts")
        .select("id, slug, title, excerpt, published_at, tags")
        .eq("published", true)
        .neq("id", post.id)
        .order("published_at", { ascending: false })
        .limit(12),
      { contexte: "blog_posts" },
    );
    const tags = post.tags ?? [];
    const related = (others ?? [])
      .map((item) => ({
        item,
        shared: (item.tags ?? []).filter((tag) => tags.includes(tag)).length,
      }))
      .sort((a, b) => b.shared - a.shared)
      .slice(0, 3)
      .map((entry) => entry.item);
    return { post, comments: comments ?? [], related };
  });

/** Grille de conformité du modèle : sert au pilotage et aux audits. */
export const listTemplateChecks = createServerFn({ method: "GET" }).handler(async () => {
  const data = check(
    await publicClient()
      .from("template_checks")
      .select(
        "id, code, area, label, requirement, status, severity, evidence, position, updated_at",
      )
      .order("position", { ascending: true }),
    { contexte: "template_checks" },
  );
  return data ?? [];
});

export const listReviews = createServerFn({ method: "GET" }).handler(async () => {
  const data = check(
    await publicClient()
      .from("reviews")
      .select("id, author_name, rating, title, content, created_at, moderation_note, moderated_at")
      .eq("approved", true)
      .order("created_at", { ascending: false }),
    { contexte: "reviews" },
  );
  return data ?? [];
});

export const listTopics = createServerFn({ method: "GET" }).handler(async () => {
  const data = check(
    await publicClient()
      .from("forum_topics")
      .select("id, title, content, author_name, locked, created_at")
      .order("created_at", { ascending: false }),
    { contexte: "forum_topics" },
  );
  return data ?? [];
});

export const getTopic = createServerFn({ method: "GET" })
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data: input }) => {
    const client = publicClient();
    const topic = check(
      await client
        .from("forum_topics")
        .select("id, title, content, author_name, locked, created_at")
        .eq("id", input.id)
        .maybeSingle(),
      { contexte: "forum_topics" },
    );
    if (!topic) return null;
    const replies = check(
      await client
        .from("forum_replies")
        .select("id, author_name, content, created_at, moderation_note, moderated_at")
        .eq("topic_id", topic.id)
        .order("created_at", { ascending: true }),
      { contexte: "forum_replies" },
    );
    return { topic, replies: replies ?? [] };
  });

/* Pages libres (module « pages ») : la base ne renvoie que les pages publiées, module allumé.
   Le contenu brut (`data`) est normalisé par `toPageRow` (src/lib/pages.ts) côté route. */
const PAGE_COLUMNS = "id, slug, title, description, data, is_home, published, published_at, updated_at";

export const getHomePage = createServerFn({ method: "GET" }).handler(async () => {
  return check(
    await publicClient()
      .from("pages")
      .select(PAGE_COLUMNS)
      .eq("is_home", true)
      .eq("published", true)
      .maybeSingle(),
    { contexte: "pages" },
  );
});

export const getPublicPage = createServerFn({ method: "GET" })
  .inputValidator((input: { slug: string }) => input)
  .handler(async ({ data: input }) => {
    return check(
      await publicClient()
        .from("pages")
        .select(PAGE_COLUMNS)
        .eq("slug", input.slug)
        .eq("published", true)
        .maybeSingle(),
      { contexte: "pages" },
    );
  });

export const listPublicPages = createServerFn({ method: "GET" }).handler(async () => {
  const data = check(
    await publicClient()
      .from("pages")
      .select("slug, title, is_home, updated_at")
      .eq("published", true)
      .order("title", { ascending: true }),
    { contexte: "pages" },
  );
  return data ?? [];
});
