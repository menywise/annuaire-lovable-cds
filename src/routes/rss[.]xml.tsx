import { createFileRoute } from "@tanstack/react-router";
import { brand } from "@/config/brand";
import { listPosts } from "@/lib/content.functions";

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** Flux de syndication des articles du blog. */
export const Route = createFileRoute("/rss.xml")({
  server: {
    handlers: {
      GET: async () => {
        let items = "";
        try {
          const posts = await listPosts();
          items = posts
            .map((post) => {
              const url = `${brand.url}/blog/${post.slug}`;
              const date = post.published_at
                ? new Date(post.published_at).toUTCString()
                : new Date().toUTCString();
              return `    <item>\n      <title>${escapeXml(post.title)}</title>\n      <link>${url}</link>\n      <guid isPermaLink="true">${url}</guid>\n      <pubDate>${date}</pubDate>\n      <description>${escapeXml(post.excerpt)}</description>\n    </item>`;
            })
            .join("\n");
        } catch {
          /* le flux reste valide même sans article */
        }

        const body = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(brand.name)} — Blog</title>
    <link>${brand.url}/blog</link>
    <atom:link href="${brand.url}/rss.xml" rel="self" type="application/rss+xml" />
    <description>Méthodes concrètes pour les indépendants, artisans et solopreneurs qui lancent un site qui tient debout.</description>
    <language>fr-FR</language>
${items}
  </channel>
</rss>
`;

        return new Response(body, {
          headers: {
            "Content-Type": "application/rss+xml; charset=utf-8",
            "Cache-Control": "public, max-age=3600",
          },
        });
      },
    },
  },
});
