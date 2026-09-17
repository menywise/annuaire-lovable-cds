import { createFileRoute, Link } from "@tanstack/react-router";
import { PageShell } from "@/components/cds/SiteHeader";
import { NewsletterForm } from "@/components/cds/NewsletterForm";
import { listPosts } from "@/lib/content.functions";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/blog/")({
  loader: () => listPosts(),
  head: () =>
    seo({
      title: "Blog",
      description:
        "Méthodes concrètes pour lancer un site qui tient debout : socle réutilisable, conformité, référencement, conversion. Des retours d'expérience, pas des généralités.",
      path: "/blog",
      type: "website",
    }),
  errorComponent: () => (
    <PageShell>
      <p className="text-sm text-muted-foreground">Les articles n'ont pas pu être chargés.</p>
    </PageShell>
  ),
  notFoundComponent: () => (
    <PageShell>
      <p className="text-sm text-muted-foreground">Cette page n'existe pas.</p>
    </PageShell>
  ),
  component: BlogIndex,
});

function BlogIndex() {
  const posts = Route.useLoaderData();

  return (
    <PageShell>
      <div className="mx-auto max-w-[820px]">
        <p className="text-xs font-medium uppercase tracking-wide text-primary">Blog</p>
        <h1 className="mt-2 text-3xl font-bold text-foreground">
          Ce qui fait vraiment avancer un projet web
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Vous cherchez des repères fiables plutôt que des avis tranchés. Chaque article part d'une
          situation réelle et se termine par ce que vous pouvez appliquer aujourd'hui.
        </p>

        {posts.length === 0 ? (
          <p className="mt-10 rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
            Le premier article arrive bientôt.
          </p>
        ) : (
          <div className="mt-8 space-y-4">
            {posts.map((post) => (
              <article key={post.id} className="rounded-xl border border-border bg-card p-6">
                <h2 className="text-lg font-semibold text-foreground">
                  <Link
                    to="/blog/$slug"
                    params={{ slug: post.slug }}
                    title={`Lire l'article : ${post.title}`}
                    className="hover:text-primary"
                  >
                    {post.title}
                  </Link>
                </h2>
                {post.published_at ? (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {new Date(post.published_at).toLocaleDateString("fr-FR", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}
                  </p>
                ) : null}
                <p className="mt-2 text-sm text-muted-foreground">{post.excerpt}</p>
                <Link
                  to="/blog/$slug"
                  params={{ slug: post.slug }}
                  title={`Lire l'article : ${post.title}`}
                  className="mt-3 inline-block text-sm font-medium text-primary hover:underline"
                >
                  Lire la suite
                </Link>
              </article>
            ))}
          </div>
        )}

        <div className="mt-10">
          <NewsletterForm source="blog" />
        </div>
      </div>
    </PageShell>
  );
}
