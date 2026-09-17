import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { PageShell } from "@/components/cds/SiteHeader";
import { CategoryBadge, TopicMeta } from "@/components/cds/ForumParts";
import { richTextToPlain } from "@/lib/richtext";
import { getForumOverview } from "@/lib/community.functions";
import { breadcrumbJsonLd, seo } from "@/lib/seo";

export const Route = createFileRoute("/forum/categorie/$slug")({
  loader: async ({ params }) => {
    const overview = await getForumOverview({ data: { category: params.slug } });
    if (!overview.activeCategory) throw notFound();
    return overview;
  },
  head: ({ loaderData, params }) => {
    const category = loaderData?.activeCategory;
    const base = seo({
      title: category ? `Forum — ${category.name}` : "Thématique du forum",
      description:
        category?.description ||
        "Les discussions de la communauté classées par thématique : posez votre question et trouvez des réponses concrètes.",
      path: `/forum/categorie/${params.slug}`,
      type: "website",
    });
    return {
      ...base,
      scripts: [
        breadcrumbJsonLd([
          { name: "Accueil", path: "/" },
          { name: "Forum", path: "/forum" },
          { name: category?.name ?? "Thématique", path: `/forum/categorie/${params.slug}` },
        ]),
      ],
    };
  },
  errorComponent: () => (
    <PageShell>
      <p className="text-sm text-muted-foreground">Cette thématique n'a pas pu être chargée.</p>
    </PageShell>
  ),
  notFoundComponent: () => (
    <PageShell>
      <h1 className="text-2xl font-bold text-foreground">Thématique introuvable</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        <Link to="/forum" title="Revenir au forum" className="text-primary-text hover:underline">
          Revenir au forum
        </Link>
      </p>
    </PageShell>
  ),
  component: CategoryPage,
});

function CategoryPage() {
  const { activeCategory, topics, categories } = Route.useLoaderData();

  return (
    <PageShell>
      <div className="mx-auto max-w-[900px]">
        <Link to="/forum" title="Revenir à toutes les discussions" className="text-xs font-medium text-primary-text hover:underline">
          ← Forum
        </Link>
        <h1 className="mt-3 text-3xl font-bold text-foreground">{activeCategory?.name}</h1>
        <p className="mt-2 max-w-[70ch] text-sm text-muted-foreground">{activeCategory?.description}</p>

        <nav aria-label="Autres thématiques" className="mt-5 flex flex-wrap gap-2">
          {categories.map((category) => (
            <Link
              key={category.id}
              to="/forum/categorie/$slug"
              params={{ slug: category.slug }}
              title={`Voir les discussions de la thématique ${category.name}`}
              className="inline-flex min-h-11 items-center rounded-md border border-border px-3 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              activeProps={{ className: "border-primary bg-accent text-foreground" }}
            >
              {category.name} ({category.topics})
            </Link>
          ))}
        </nav>

        {topics.length === 0 ? (
          <p className="mt-8 rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
            Aucune discussion dans cette thématique. La vôtre ouvrira la voie.
          </p>
        ) : (
          <ul className="mt-6 space-y-3">
            {topics.map((topic) => (
              <li key={topic.id} className="rounded-xl border border-border bg-card p-5">
                {topic.category ? (
                  <CategoryBadge name={topic.category.name} color={topic.category.color} />
                ) : null}
                <h2 className="mt-2 text-base font-semibold text-foreground">
                  <Link
                    to="/forum/$topicId"
                    params={{ topicId: topic.id }}
                    title={`Ouvrir la discussion : ${topic.title}`}
                    className="hover:text-primary-text"
                  >
                    {topic.title}
                  </Link>
                </h2>
                <p className="mt-1.5 line-clamp-2 text-sm text-muted-foreground">
                  {richTextToPlain(topic.content)}
                </p>
                <div className="mt-3">
                  <TopicMeta replies={topic.replies} likes={topic.likes} views={topic.views} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </PageShell>
  );
}
