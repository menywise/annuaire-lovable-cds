import { createFileRoute } from "@tanstack/react-router";
import { listPosts, listPublicPages, listTopics } from "@/lib/content.functions";
import { isModuleOn, onlyActive, type FeatureKey } from "@/config/modules";
import { loadSiteConfig } from "@/lib/site-config.functions";
import { getShopCatalog } from "@/lib/shop.functions";
import { fallbackSiteConfig } from "@/lib/site-config";

type SitemapPage = { path: string; priority: string; changefreq: string; module?: FeatureKey };

/** Pages publiques indexables, avec leur priorité et le module dont elles dépendent. */
const pages: SitemapPage[] = [
  { path: "/", priority: "1.0", changefreq: "weekly" },
  { path: "/a-propos", priority: "0.8", changefreq: "monthly" },
  { path: "/demarrer", priority: "0.9", changefreq: "monthly", module: "onboarding" },
  { path: "/composants", priority: "0.9", changefreq: "weekly", module: "showcase" },
  { path: "/guide", priority: "0.9", changefreq: "monthly", module: "showcase" },
  { path: "/tarifs", priority: "0.9", changefreq: "monthly", module: "pricing" },
  { path: "/blog", priority: "0.9", changefreq: "weekly", module: "blog" },
  { path: "/faq", priority: "0.8", changefreq: "monthly", module: "faq" },
  { path: "/forum", priority: "0.8", changefreq: "daily", module: "forum" },
  { path: "/membres", priority: "0.7", changefreq: "weekly", module: "members" },
  { path: "/temoignages", priority: "0.8", changefreq: "weekly", module: "testimonials" },
  { path: "/avis", priority: "0.8", changefreq: "weekly", module: "reviews" },
  { path: "/plan-du-site", priority: "0.6", changefreq: "monthly" },
  { path: "/contact", priority: "0.7", changefreq: "yearly", module: "contact" },
  { path: "/login", priority: "0.5", changefreq: "yearly" },
  { path: "/signup", priority: "0.5", changefreq: "yearly" },
  { path: "/verification-email", priority: "0.3", changefreq: "yearly" },
  { path: "/forgot-password", priority: "0.3", changefreq: "yearly" },
  { path: "/legal/mentions-legales", priority: "0.4", changefreq: "yearly" },
  { path: "/legal/confidentialite", priority: "0.4", changefreq: "yearly" },
  { path: "/legal/cgu", priority: "0.4", changefreq: "yearly" },
  { path: "/legal/cgv", priority: "0.4", changefreq: "yearly" },
  { path: "/legal/cookies", priority: "0.4", changefreq: "yearly" },
  { path: "/annuaire", priority: "0.9", changefreq: "daily", module: "directory" },
  { path: "/annuaire/soumettre", priority: "0.6", changefreq: "monthly", module: "directory" },
  { path: "/annuaire/departements", priority: "0.8", changefreq: "weekly", module: "geo" },
  { path: "/formations", priority: "0.9", changefreq: "weekly", module: "lms" },
  { path: "/boutique", priority: "0.9", changefreq: "weekly", module: "shop" },
  { path: "/marketplace", priority: "0.9", changefreq: "daily", module: "marketplace" },
  { path: "/marketplace/publier", priority: "0.6", changefreq: "monthly", module: "marketplace" },
  { path: "/publicite", priority: "0.6", changefreq: "monthly", module: "adNetwork" },
];

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        const site = await loadSiteConfig().catch(() => fallbackSiteConfig);
        const lastmod = new Date().toISOString().slice(0, 10);
        const dynamic: SitemapPage[] = [];
        try {
          const [posts, topics, freePages, shop] = await Promise.all([
            isModuleOn(site.modules, "blog") ? listPosts() : Promise.resolve([]),
            isModuleOn(site.modules, "forum") ? listTopics() : Promise.resolve([]),
            isModuleOn(site.modules, "pages") ? listPublicPages() : Promise.resolve([]),
            isModuleOn(site.modules, "shop") ? getShopCatalog() : Promise.resolve(null),
          ]);
          for (const product of shop?.products ?? []) {
            dynamic.push({
              path: `/boutique/${product.slug}`,
              priority: "0.7",
              changefreq: "weekly",
            });
          }
          for (const page of freePages) {
            if (page.is_home) continue; // l'accueil est déjà « / »
            dynamic.push({ path: `/pages/${page.slug}`, priority: "0.7", changefreq: "monthly" });
          }
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
${[...onlyActive(site.modules, pages), ...dynamic]
  .map(
    (page) =>
      `  <url>\n    <loc>${site.brand.url}${page.path === "/" ? "/" : page.path}</loc>\n    <lastmod>${lastmod}</lastmod>\n    <changefreq>${page.changefreq}</changefreq>\n    <priority>${page.priority}</priority>\n  </url>`,
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
