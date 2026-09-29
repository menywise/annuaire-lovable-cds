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

export const listFaq = createServerFn({ method: "GET" }).handler(async () => {
  const { data } = await publicClient()
    .from("faq_items")
    .select("id, question, answer, category, position")
    .eq("published", true)
    .order("position", { ascending: true });
  return data ?? [];
});

export const listPlans = createServerFn({ method: "GET" }).handler(async () => {
  const { data } = await publicClient()
    .from("pricing_plans")
    .select(
      "id, name, tagline, price_cents, currency, period, features, cta_label, highlighted, position",
    )
    .eq("active", true)
    .order("position", { ascending: true });
  return data ?? [];
});

export const listPosts = createServerFn({ method: "GET" }).handler(async () => {
  const { data } = await publicClient()
    .from("blog_posts")
    .select("id, slug, title, excerpt, content, cover_url, published_at, tags")
    .eq("published", true)
    .order("published_at", { ascending: false });
  return data ?? [];
});

export const getPost = createServerFn({ method: "GET" })
  .inputValidator((input: { slug: string }) => input)
  .handler(async ({ data: input }) => {
    const client = publicClient();
    const { data: post } = await client
      .from("blog_posts")
      .select("id, slug, title, excerpt, content, cover_url, published_at, tags")
      .eq("published", true)
      .eq("slug", input.slug)
      .maybeSingle();
    if (!post) return null;
    const { data: comments } = await client
      .from("blog_comments")
      .select("id, author_name, content, created_at")
      .eq("post_id", post.id)
      .eq("approved", true)
      .order("created_at", { ascending: true });
    const { data: others } = await client
      .from("blog_posts")
      .select("id, slug, title, excerpt, published_at, tags")
      .eq("published", true)
      .neq("id", post.id)
      .order("published_at", { ascending: false })
      .limit(12);
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
  const { data } = await publicClient()
    .from("template_checks")
    .select("id, code, area, label, requirement, status, severity, evidence, position, updated_at")
    .order("position", { ascending: true });
  return data ?? [];
});

export const listReviews = createServerFn({ method: "GET" }).handler(async () => {
  const { data } = await publicClient()
    .from("reviews")
    .select("id, author_name, rating, title, content, created_at")
    .eq("approved", true)
    .order("created_at", { ascending: false });
  return data ?? [];
});

export const listTopics = createServerFn({ method: "GET" }).handler(async () => {
  const { data } = await publicClient()
    .from("forum_topics")
    .select("id, title, content, author_name, locked, created_at")
    .order("created_at", { ascending: false });
  return data ?? [];
});

export const getTopic = createServerFn({ method: "GET" })
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data: input }) => {
    const client = publicClient();
    const { data: topic } = await client
      .from("forum_topics")
      .select("id, title, content, author_name, locked, created_at")
      .eq("id", input.id)
      .maybeSingle();
    if (!topic) return null;
    const { data: replies } = await client
      .from("forum_replies")
      .select("id, author_name, content, created_at")
      .eq("topic_id", topic.id)
      .order("created_at", { ascending: true });
    return { topic, replies: replies ?? [] };
  });

/* Pages libres (module « pages ») : la base ne renvoie que les pages publiées, module allumé.
   Le contenu brut (`data`) est normalisé par `toPageRow` (src/lib/pages.ts) côté route. */
const PAGE_COLUMNS = "id, slug, title, description, data, is_home, published, published_at, updated_at";

export const getHomePage = createServerFn({ method: "GET" }).handler(async () => {
  const { data } = await publicClient()
    .from("pages")
    .select(PAGE_COLUMNS)
    .eq("is_home", true)
    .eq("published", true)
    .maybeSingle();
  return data;
});

export const getPublicPage = createServerFn({ method: "GET" })
  .inputValidator((input: { slug: string }) => input)
  .handler(async ({ data: input }) => {
    const { data } = await publicClient()
      .from("pages")
      .select(PAGE_COLUMNS)
      .eq("slug", input.slug)
      .eq("published", true)
      .maybeSingle();
    return data;
  });

export const listPublicPages = createServerFn({ method: "GET" }).handler(async () => {
  const { data } = await publicClient()
    .from("pages")
    .select("slug, title, is_home, updated_at")
    .eq("published", true)
    .order("title", { ascending: true });
  return data ?? [];
});
