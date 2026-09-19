import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Clock, GraduationCap, Users } from "lucide-react";
import { PageShell } from "@/components/cds/SiteHeader";
import { AdSlot } from "@/components/cds/AdSlot";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { requireFeature } from "@/config/features";
import { listCourses } from "@/lib/lms.functions";
import { seo } from "@/lib/seo";
import { formatDuration, formatPrice } from "@/lib/format";

const LEVELS = [
  ["", "Tous les niveaux"],
  ["debutant", "Débutant"],
  ["intermediaire", "Intermédiaire"],
  ["avance", "Avancé"],
] as const;

const LEVEL_LABEL: Record<string, string> = {
  debutant: "Débutant",
  intermediaire: "Intermédiaire",
  avance: "Avancé",
};

export const Route = createFileRoute("/formations/")({
  beforeLoad: () => requireFeature("lms"),
  loader: () => listCourses(),
  head: () =>
    seo({
      title: "Formations",
      description:
        "Des parcours courts et concrets pour avancer à votre rythme : certains gratuits, d'autres payants, tous découpés en leçons faciles à reprendre.",
      path: "/formations",
    }),
  errorComponent: () => (
    <PageShell>
      <p className="text-sm text-muted-foreground">Le catalogue n'a pas pu être chargé.</p>
    </PageShell>
  ),
  notFoundComponent: () => (
    <PageShell>
      <p className="text-sm text-muted-foreground">Cette page n'existe pas.</p>
    </PageShell>
  ),
  component: CoursesPage,
});

function CoursesPage() {
  const courses = Route.useLoaderData();
  const [query, setQuery] = useState("");
  const [level, setLevel] = useState("");
  const [price, setPrice] = useState("");
  const [sort, setSort] = useState("ordre");

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const rows = courses.filter((course) => {
      if (level && course.level !== level) return false;
      if (price === "gratuit" && course.price_cents > 0) return false;
      if (price === "payant" && course.price_cents === 0) return false;
      if (!needle) return true;
      return `${course.title} ${course.excerpt ?? ""}`.toLowerCase().includes(needle);
    });
    const sorted = [...rows];
    if (sort === "populaire") sorted.sort((a, b) => b.learners - a.learners);
    if (sort === "duree")
      sorted.sort((a, b) => (a.duration_minutes ?? 0) - (b.duration_minutes ?? 0));
    if (sort === "prix") sorted.sort((a, b) => a.price_cents - b.price_cents);
    return sorted;
  }, [courses, query, level, price, sort]);

  return (
    <PageShell>
      <div className="mx-auto max-w-[1000px]">
        <p className="text-xs font-medium uppercase tracking-wide text-primary-text">Formations</p>
        <h1 className="mt-2 text-3xl font-bold text-foreground">
          Apprenez ce qui vous sert, dans l'ordre qui vous arrange
        </h1>
        <p className="mt-2 max-w-[65ch] text-sm text-muted-foreground">
          Chaque parcours est découpé en leçons courtes. Vous reprenez là où vous vous étiez arrêté,
          et vous voyez votre progression avancer à chaque séance.
        </p>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1.5">
            <Label htmlFor="c-search">Rechercher</Label>
            <Input
              id="c-search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Un mot-clé…"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="c-level">Niveau</Label>
            <select
              id="c-level"
              value={level}
              onChange={(e) => setLevel(e.target.value)}
              className="h-11 w-full rounded-md border border-border bg-card px-3 text-sm text-foreground"
            >
              {LEVELS.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="c-price">Accès</Label>
            <select
              id="c-price"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className="h-11 w-full rounded-md border border-border bg-card px-3 text-sm text-foreground"
            >
              <option value="">Tout</option>
              <option value="gratuit">Gratuit</option>
              <option value="payant">Payant</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="c-sort">Trier</Label>
            <select
              id="c-sort"
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              className="h-11 w-full rounded-md border border-border bg-card px-3 text-sm text-foreground"
            >
              <option value="ordre">Ordre conseillé</option>
              <option value="populaire">Les plus suivies</option>
              <option value="duree">Les plus courtes</option>
              <option value="prix">Prix croissant</option>
            </select>
          </div>
        </div>

        <p className="mt-4 text-xs text-muted-foreground" aria-live="polite">
          {visible.length} formation{visible.length > 1 ? "s" : ""} disponible
          {visible.length > 1 ? "s" : ""}.
        </p>

        {visible.length === 0 ? (
          <p className="mt-6 rounded-lg border border-border bg-card p-6 text-sm text-muted-foreground">
            Aucune formation ne correspond à ces critères pour l'instant.
          </p>
        ) : (
          <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {visible.map((course) => (
              <li
                key={course.id}
                className="flex flex-col rounded-xl border border-border bg-card p-5 shadow-sm"
              >
                {course.cover_url ? (
                  <img
                    src={course.cover_url}
                    alt={`Illustration de la formation ${course.title}`}
                    loading="lazy"
                    className="mb-3 aspect-video w-full rounded-lg object-cover"
                  />
                ) : null}
                <h2 className="text-base font-semibold text-foreground">
                  <Link
                    to="/formation/$slug"
                    params={{ slug: course.slug }}
                    title={`Voir le programme de ${course.title}`}
                    className="hover:underline"
                  >
                    {course.title}
                  </Link>
                </h2>
                {course.excerpt ? (
                  <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">
                    {course.excerpt}
                  </p>
                ) : null}
                <ul className="mt-3 flex flex-wrap gap-3 text-xs text-muted-foreground">
                  <li className="inline-flex items-center gap-1">
                    <GraduationCap className="size-3.5" aria-hidden="true" />
                    {LEVEL_LABEL[course.level] ?? "Tous niveaux"}
                  </li>
                  <li className="inline-flex items-center gap-1">
                    <Clock className="size-3.5" aria-hidden="true" />
                    {formatDuration(course.duration_minutes ?? 0)}
                  </li>
                  <li className="inline-flex items-center gap-1">
                    <Users className="size-3.5" aria-hidden="true" />
                    {course.learners} inscrit{course.learners > 1 ? "s" : ""}
                  </li>
                </ul>
                <p className="mt-4 text-sm font-semibold text-primary-text">
                  {formatPrice(course.price_cents, course.currency ?? "EUR")}
                </p>
              </li>
            ))}
          </ul>
        )}

        <AdSlot placement="formations" className="mt-10" />
      </div>
    </PageShell>
  );
}
