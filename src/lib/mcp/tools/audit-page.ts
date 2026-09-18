import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { errorResult, siteBaseUrl, textResult } from "../supabase";

function all(html: string, re: RegExp) {
  return [...html.matchAll(re)];
}

function meta(html: string, attr: "name" | "property", value: string) {
  const re = new RegExp(`<meta[^>]+${attr}=["']${value}["'][^>]*>`, "i");
  const tag = html.match(re)?.[0];
  return tag?.match(/content=["']([^"']*)["']/i)?.[1] ?? null;
}

export default defineTool({
  name: "audit_page",
  title: "Auditer une page",
  description:
    "Charge une page publique et retourne ses éléments auditables : statut HTTP, langue, titre, description, balises Open Graph, canonique, nombre de H1/H2, images sans texte alternatif, liens sans attribut title, traces de thème sombre et mots anglais résiduels.",
  inputSchema: {
    path: z.string().min(1).describe("Chemin de la page, par exemple /tarifs."),
    base_url: z.string().url().optional().describe("Adresse du site, si différente de la production."),
  },
  annotations: { readOnlyHint: true, openWorldHint: true },
  handler: async ({ path, base_url }, ctx) => {
    const url = `${siteBaseUrl(base_url)}${path.startsWith("/") ? path : `/${path}`}`;
    try {
      const res = await fetch(url, { signal: ctx.signal, redirect: "follow" });
      const html = await res.text();
      const links = all(html, /<a\b[^>]*>/gi);
      const images = all(html, /<img\b[^>]*>/gi);
      return textResult({
        url,
        statut: res.status,
        langue: html.match(/<html[^>]+lang=["']([^"']+)["']/i)?.[1] ?? null,
        titre: html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1] ?? null,
        description: meta(html, "name", "description"),
        og_title: meta(html, "property", "og:title"),
        og_description: meta(html, "property", "og:description"),
        og_image: meta(html, "property", "og:image"),
        twitter_card: meta(html, "name", "twitter:card"),
        robots: meta(html, "name", "robots"),
        canonique: html.match(/<link[^>]+rel=["']canonical["'][^>]*href=["']([^"']+)["']/i)?.[1] ?? null,
        h1: all(html, /<h1\b/gi).length,
        h2: all(html, /<h2\b/gi).length,
        liens: links.length,
        liens_sans_title: links.filter((l) => !/\btitle=/i.test(l[0])).length,
        images: images.length,
        images_sans_alt: images.filter((i) => !/\balt=/i.test(i[0])).length,
        traces_theme_sombre: all(html, /(class=["'][^"']*\bdark\b|prefers-color-scheme:\s*dark)/gi).length,
        mentions_lovable: all(html, /lovable/gi).length,
        poids_html_octets: html.length,
      });
    } catch (e) {
      return errorResult(`Page injoignable : ${(e as Error).message}`);
    }
  },
});
