import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PageShell } from "@/components/cds/SiteHeader";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { requireFeature } from "@/config/features";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { seo } from "@/lib/seo";
import { formatDuration } from "@/lib/format";

type Row = {
  id: string;
  title: string;
  slug: string;
  duration: number;
  total: number;
  done: number;
};

export const Route = createFileRoute("/_authenticated/mes-formations")({
  beforeLoad: () => requireFeature("lms"),
  head: () =>
    seo({
      title: "Mes formations",
      description: "Vos formations en cours et votre progression, leçon par leçon.",
      path: "/mes-formations",
      noindex: true,
    }),
  component: MyCoursesPage,
});

function MyCoursesPage() {
  const { user } = useAuth();
  const [rows, setRows] = useState<Row[] | null>(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    void (async () => {
      const { data: enrollments } = await supabase
        .from("lms_enrollments")
        .select("course_id, lms_courses(id, title, slug, duration_minutes)")
        .eq("user_id", user.id);
      const courseIds = (enrollments ?? []).map((row) => row.course_id);
      if (courseIds.length === 0) {
        if (!cancelled) setRows([]);
        return;
      }
      const { data: modules } = await supabase
        .from("lms_modules")
        .select("id, course_id")
        .in("course_id", courseIds);
      const moduleIds = (modules ?? []).map((m) => m.id);
      const { data: lessons } = moduleIds.length
        ? await supabase.from("lms_lessons").select("id, module_id").in("module_id", moduleIds)
        : { data: [] };
      const { data: progress } = await supabase
        .from("lms_progress")
        .select("lesson_id")
        .eq("user_id", user.id);
      const doneSet = new Set((progress ?? []).map((row) => row.lesson_id));
      const moduleCourse = new Map((modules ?? []).map((m) => [m.id, m.course_id]));

      const result: Row[] = (enrollments ?? []).flatMap((row) => {
        const course = row.lms_courses as unknown as {
          id: string;
          title: string;
          slug: string;
          duration_minutes: number | null;
        } | null;
        if (!course) return [];
        const courseLessons = (lessons ?? []).filter(
          (lesson) => moduleCourse.get(lesson.module_id) === course.id,
        );
        return [
          {
            id: course.id,
            title: course.title,
            slug: course.slug,
            duration: course.duration_minutes ?? 0,
            total: courseLessons.length,
            done: courseLessons.filter((lesson) => doneSet.has(lesson.id)).length,
          },
        ];
      });
      if (!cancelled) setRows(result);
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  return (
    <PageShell>
      <div className="mx-auto max-w-[800px]">
        <h1 className="text-3xl font-bold text-foreground">Mes formations</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Reprenez où vous en étiez : chaque leçon terminée fait avancer la barre.
        </p>

        {rows === null ? (
          <div className="mt-6 space-y-3">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : rows.length === 0 ? (
          <p className="mt-6 rounded-lg border border-border bg-card p-6 text-sm text-muted-foreground">
            Vous n'êtes inscrit à aucune formation.{" "}
            <Link to="/formations" title="Parcourir le catalogue des formations" className="text-primary-text hover:underline">
              Parcourir le catalogue
            </Link>
          </p>
        ) : (
          <ul className="mt-6 space-y-3">
            {rows.map((row) => {
              const percent = row.total ? Math.round((row.done / row.total) * 100) : 0;
              return (
                <li key={row.id} className="rounded-xl border border-border bg-card p-5">
                  <h2 className="text-base font-semibold text-foreground">
                    <Link
                      to="/formation/$slug"
                      params={{ slug: row.slug }}
                      title={`Reprendre la formation ${row.title}`}
                      className="hover:underline"
                    >
                      {row.title}
                    </Link>
                  </h2>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {row.done} / {row.total} leçons · {formatDuration(row.duration)}
                  </p>
                  <Progress value={percent} className="mt-3" />
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </PageShell>
  );
}
