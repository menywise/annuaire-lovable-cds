import { createFileRoute } from "@tanstack/react-router";
import { fallbackSiteConfig } from "@/lib/site-config";
import { loadSiteConfig } from "@/lib/site-config.functions";

/** robots.txt : l'adresse du sitemap suit l'URL saisie en admin. */
export const Route = createFileRoute("/robots.txt")({
  server: {
    handlers: {
      GET: async () => {
        const site = await loadSiteConfig().catch(() => fallbackSiteConfig);
        const lines = [
          "User-agent: *",
          "Allow: /",
          "Disallow: /admin",
          "Disallow: /compte",
          "Disallow: /profil",
          "Disallow: /reset-password",
          "Disallow: /merci",
          "Disallow: /maintenance",
          "",
          ...(site.brand.url ? [`Sitemap: ${site.brand.url}/sitemap.xml`] : []),
        ];
        return new Response(`${lines.join("\n")}\n`, {
          headers: {
            "Content-Type": "text/plain; charset=utf-8",
            "Cache-Control": "public, max-age=3600",
          },
        });
      },
    },
  },
});
