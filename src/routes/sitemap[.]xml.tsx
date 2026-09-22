import { createFileRoute } from "@tanstack/react-router";
import { brand } from "@/config/brand";
import { listPosts, listTopics } from "@/lib/content.functions";
import { isFeatureOn } from "@/config/features";


/** Pages publiques indexables, avec leur priorité de référencement. */
const pages: Array<{ path: string; priority: string; changefreq: string }> = [
  { path: "/", priority: "1.0", changefreq: "weekly" },
  { path: "/a-propos", priority: "0.8", changefreq: "monthly" },
  { path: "/demarrer", priority: "0.9", changefreq: "monthly" },
  { path: "/composants", priority: "0.9", changefreq: "weekly" },
  { path: "/tarifs", priority: "0.9", changefreq: "monthly" },
  { path: "/blog", priority: "0.9", changefreq: "weekly" },
  { path: "/faq", priority: "0.8", changefreq: "monthly" },
  { path: "/forum", priority: "0.8", changefreq: "daily" },
  { path: "/membres", priority: "0.7", changefreq: "weekly" },
  { path: "/temoignages", priority: "0.8", changefreq: "weekly" },
  { path: "/avis", priority: "0.8", changefreq: "weekly" },
  { path: "/guide", priority: "0.9", changefreq: "monthly" },
  { path: "/plan-du-site", priority: "0.6", changefreq: "monthly" },
  { path: "/contact", priority: "0.7", changefreq: "yearly" },
  { path: "/login", priority: "0.5", changefreq: "yearly" },
  { path: "/signup", priority: "0.5", changefreq: "yearly" },
  { path: "/verification-email", priority: "0.3", changefreq: "yearly" },
  { path: "/forgot-password", priority: "0.3", changefreq: "yearly" },
  { path: "/legal/mentions-legales", priority: "0.4", changefreq: "yearly" },
  { path: "/legal/confidentialite", priority: "0.4", changefreq: "yearly" },
  { path: "/legal/cgu", priority: "0.4", changefreq: "yearly" },
  { path: "/legal/cgv", priority: "0.4", changefreq: "yearly" },
  { path: "/legal/cookies", priority: "0.4", changefreq: "yearly" },
];

/** Pages ajoutées seulement quand la brique correspondante est active. */
const optionalPages: Array<{ path: string; priority: string; changefreq: string }> = [
  ...(isFeatureOn("directory")
    ? [
        { path: "/annuaire", priority: "0.9", changefreq: "daily" },
        { path: "/annuaire/soumettre", priority: "0.6", changefreq: "monthly" },
      ]
    : []),
  ...(isFeatureOn("geo") ? [{ path: "/annuaire/departements", priority: "0.8", changefreq: "weekly" }] : []),
  ...(isFeatureOn("lms") ? [{ path: "/formations", priority: "0.9", changefreq: "weekly" }] : []),
  ...(isFeatureOn("marketplace")
    ? [
        { path: "/marketplace", priority: "0.9", changefreq: "daily" },
        { path: "/marketplace/publier", priority: "0.6", changefreq: "monthly" },
      ]
    : []),
  ...(isFeatureOn("adNetwork") ? [{ path: "/publicite", priority: "0.6", changefreq: "monthly" }] : []),
];


export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        const lastmod = new Date().toISOString().slice(0, 10);
        const dynamic: Array<{ path: string; priority: string; changefreq: string }> = [];
        try {
          const [posts, topics] = await Promise.all([listPosts(), listTopics()]);
          for (const post of posts) {
            dynamic.push({ path: `/blog/${post.slug}`, priority: "0.8", changefreq: "monthly" });
          }
          for (const topic of topics) {
            dynamic.push({ path: `/forum/${topic.id}`, priority: "0.6", changefreq: "weekly" });
          }
        } catch {
          /* le plan du site reste valide avec les pages statiques */
        }
        const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${[...pages, ...dynamic]
  .map(
    (page) =>
      `  <url>\n    <loc>${brand.url}${page.path === "/" ? "/" : page.path}</loc>\n    <lastmod>${lastmod}</lastmod>\n    <changefreq>${page.changefreq}</changefreq>\n    <priority>${page.priority}</priority>\n  </url>`,
  )
  .join("\n")}
</urlset>
`;

        return new Response(body, {
          headers: {
            "Content-Type": "application/xml; charset=utf-8",
            "Cache-Control": "public, max-age=3600",
          },
        });
      },
    },
  },
});
