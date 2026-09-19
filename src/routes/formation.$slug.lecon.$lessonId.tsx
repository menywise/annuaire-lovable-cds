import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { PageShell } from "@/components/cds/SiteHeader";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { RichText } from "@/lib/richtext";
import { requireFeature } from "@/config/features";
import { getLesson } from "@/lib/lms.functions";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { seo } from "@/lib/seo";
import { formatDuration } from "@/lib/format";

export const Route = createFileRoute("/formation/$slug/lecon/$lessonId")({
  beforeLoad: () => requireFeature("lms"),
  loader: async ({ params }) => {
    const data = await getLesson({ data: { slug: params.slug, lessonId: params.lessonId } });
    if (!data) throw notFound();
    return data;
  },
  head: ({ loaderData }) => {
    if (!loaderData) {
      return { meta: [{ title: "Leçon introuvable" }, { name: "robots", content: "noindex" }] };
    }
    const { course, lesson } = loaderData;
    return seo({
      title: `${lesson.title} — ${course.title}`,
      description: `Leçon « ${lesson.title} » de la formation ${course.title}.`,
      path: `/formation/${course.slug}/lecon/${lesson.id}`,
      noindex: true,
    });
  },
  errorComponent: () => (
    <PageShell>
      <p className="text-sm text-muted-foreground">Cette leçon n'a pas pu être chargée.</p>
    </PageShell>
  ),
  notFoundComponent: () => (
    <PageShell>
      <p className="text-sm text-muted-foreground">
        Cette leçon n'existe pas.{" "}
        <Link to="/formations" title="Revenir au catalogue" className="underline">
          Revenir au catalogue
        </Link>
      </p>
    </PageShell>
  ),
  component: LessonPage,
});

function LessonPage() {
  const { course, lesson, lessons } = Route.useLoaderData();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [enrolled, setEnrolled] = useState(false);
  const [doneIds, setDoneIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    void (async () => {
      const [{ data: enrollment }, { data: progress }] = await Promise.all([
        supabase
          .from("lms_enrollments")
          .select("id")
          .eq("user_id", user.id)
          .eq("course_id", course.id)
          .maybeSingle(),
        supabase.from("lms_progress").select("lesson_id").eq("user_id", user.id),
      ]);
      if (cancelled) return;
      setEnrolled(Boolean(enrollment));
      setDoneIds((progress ?? []).map((row) => row.lesson_id));
    })();
    return () => {
      cancelled = true;
    };
  }, [user, course.id]);

  const index = lessons.findIndex((item) => item.id === lesson.id);
  const previous = index > 0 ? lessons[index - 1] : null;
  const next = index >= 0 && index < lessons.length - 1 ? lessons[index + 1] : null;
  const doneCount = lessons.filter((item) => doneIds.includes(item.id)).length;
  const percent = lessons.length ? Math.round((doneCount / lessons.length) * 100) : 0;
  const done = doneIds.includes(lesson.id);
  const locked = !lesson.free_preview && !enrolled;

  async function markDone() {
    if (!user) return;
    setBusy(true);
    const { error } = await supabase
      .from("lms_progress")
      .upsert(
        { user_id: user.id, lesson_id: lesson.id, completed_at: new Date().toISOString() },
        { onConflict: "user_id,lesson_id" },
      );
    setBusy(false);
    if (error) {
      toast.error("Progression non enregistrée.", { description: "Réessayez dans un instant." });
      return;
    }
    setDoneIds((prev) => (prev.includes(lesson.id) ? prev : [...prev, lesson.id]));
    toast.success("Leçon terminée.", { description: "Une de plus derrière vous." });
    if (next) {
      void navigate({
        to: "/formation/$slug/lecon/$lessonId",
        params: { slug: course.slug, lessonId: next.id },
      });
    }
  }

  return (
    <PageShell>
      <div className="mx-auto max-w-[820px]">
        <nav aria-label="Fil d'Ariane" className="text-xs text-muted-foreground">
          <Link
            to="/formations"
            title="Revenir au catalogue des formations"
            className="hover:underline"
          >
            Formations
          </Link>
          {" / "}
          <Link
            to="/formation/$slug"
            params={{ slug: course.slug }}
            title={`Revenir au programme de ${course.title}`}
            className="hover:underline"
          >
            {course.title}
          </Link>
          {" / "}
          {lesson.title}
        </nav>

        <h1 className="mt-4 text-2xl font-bold text-foreground">{lesson.title}</h1>
        <p className="mt-1 text-xs text-muted-foreground">
          Leçon {index + 1} sur {lessons.length} · {formatDuration(lesson.duration_minutes ?? 0)}
        </p>
        <Progress value={percent} className="mt-3" />

        {locked ? (
          <div className="mt-6 rounded-xl border border-border bg-card p-6">
            <p className="text-sm text-muted-foreground">
              Cette leçon est réservée aux personnes inscrites.
            </p>
            <Button asChild className="mt-4" title="Voir le programme et s'inscrire">
              <Link to="/formation/$slug" params={{ slug: course.slug }}>
                Voir le programme
              </Link>
            </Button>
          </div>
        ) : (
          <>
            {lesson.video_url ? (
              <div className="mt-6 aspect-video w-full overflow-hidden rounded-xl border border-border">
                <iframe
                  src={lesson.video_url}
                  title={`Vidéo de la leçon ${lesson.title}`}
                  allowFullScreen
                  className="size-full"
                />
              </div>
            ) : null}

            {lesson.content ? (
              <RichText value={lesson.content} className="mt-6 text-sm text-foreground" />
            ) : (
              <p className="mt-6 text-sm text-muted-foreground">Contenu en cours de rédaction.</p>
            )}

            {user ? (
              <Button
                className="mt-6"
                variant={done ? "outline" : "default"}
                disabled={busy || done}
                onClick={markDone}
                title="Marquer cette leçon comme terminée"
              >
                {done ? (
                  <>
                    <CheckCircle2 className="size-4" aria-hidden="true" /> Leçon terminée
                  </>
                ) : busy ? (
                  "Enregistrement…"
                ) : (
                  "Marquer comme terminée"
                )}
              </Button>
            ) : (
              <p className="mt-6 text-sm text-muted-foreground">
                <Link
                  to="/login"
                  title="Se connecter pour suivre sa progression"
                  className="text-primary-text hover:underline"
                >
                  Connectez-vous
                </Link>{" "}
                pour garder votre progression.
              </p>
            )}
          </>
        )}

        <nav aria-label="Navigation dans la formation" className="mt-10 flex justify-between gap-3">
          {previous ? (
            <Link
              to="/formation/$slug/lecon/$lessonId"
              params={{ slug: course.slug, lessonId: previous.id }}
              title={`Aller à la leçon ${previous.title}`}
              className="inline-flex min-h-11 items-center gap-2 rounded-md border border-border px-3 text-sm text-foreground hover:bg-accent"
            >
              <ArrowLeft className="size-4" aria-hidden="true" />
              Leçon précédente
            </Link>
          ) : (
            <span />
          )}
          {next ? (
            <Link
              to="/formation/$slug/lecon/$lessonId"
              params={{ slug: course.slug, lessonId: next.id }}
              title={`Aller à la leçon ${next.title}`}
              className="inline-flex min-h-11 items-center gap-2 rounded-md border border-border px-3 text-sm text-foreground hover:bg-accent"
            >
              Leçon suivante
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          ) : (
            <span />
          )}
        </nav>
      </div>
    </PageShell>
  );
}
