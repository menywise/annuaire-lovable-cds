import { createFileRoute } from "@tanstack/react-router";
import { brand } from "@/config/brand";

/** Pages publiques indexables, avec leur priorité de référencement. */
const pages: Array<{ path: string; priority: string; changefreq: string }> = [
  { path: "/", priority: "1.0", changefreq: "weekly" },
  { path: "/composants", priority: "0.9", changefreq: "weekly" },
  { path: "/guide", priority: "0.9", changefreq: "monthly" },
  { path: "/contact", priority: "0.7", changefreq: "yearly" },
  { path: "/login", priority: "0.5", changefreq: "yearly" },
  { path: "/signup", priority: "0.5", changefreq: "yearly" },
  { path: "/forgot-password", priority: "0.3", changefreq: "yearly" },
  { path: "/legal/mentions-legales", priority: "0.4", changefreq: "yearly" },
  { path: "/legal/confidentialite", priority: "0.4", changefreq: "yearly" },
  { path: "/legal/cgu", priority: "0.4", changefreq: "yearly" },
  { path: "/legal/cookies", priority: "0.4", changefreq: "yearly" },
];

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: () => {
        const lastmod = new Date().toISOString().slice(0, 10);
        const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${pages
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
