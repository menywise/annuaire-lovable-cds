import { createServerFn } from "@tanstack/react-start";
import { publicClient } from "@/lib/supabase-public";
import { check } from "@/lib/check";

/**
 * Catalogue des formations publiées. Le nombre d'inscrits par formation est compté par la base
 * (lms_course_learners) : les inscriptions elles-mêmes ne sont pas lisibles par le visiteur.
 */
export const listCourses = createServerFn({ method: "GET" }).handler(async () => {
  const client = publicClient();
  const [coursesRes, learnersRes] = await Promise.all([
    client
      .from("lms_courses")
      .select(
        "id, title, slug, excerpt, description, cover_url, level, duration_minutes, price_cents, currency, position",
      )
      .eq("published", true)
      .order("position", { ascending: true }),
    client.rpc("lms_course_learners"),
  ]);
  const courses = check(coursesRes, { contexte: "lms_courses" });
  const learners = check(learnersRes, { contexte: "lms_course_learners" });
  const counts = new Map<string, number>();
  for (const row of learners ?? []) counts.set(row.course_id, Number(row.learners));
  return (courses ?? []).map((course) => ({ ...course, learners: counts.get(course.id) ?? 0 }));
});

/** Détail d'une formation publiée : modules et leçons dans l'ordre. */
export const getCourse = createServerFn({ method: "GET" })
  .inputValidator((input: { slug: string }) => input)
  .handler(async ({ data: input }) => {
    const client = publicClient();
    const course = check(
      await client
        .from("lms_courses")
        .select(
          "id, title, slug, excerpt, description, cover_url, level, duration_minutes, price_cents, currency",
        )
        .eq("published", true)
        .eq("slug", input.slug)
        .maybeSingle(),
      { contexte: "lms_courses" },
    );
    if (!course) return null;
    const modules = check(
      await client
        .from("lms_modules")
        .select("id, title, position")
        .eq("course_id", course.id)
        .order("position", { ascending: true }),
      { contexte: "lms_modules" },
    );
    const moduleIds = (modules ?? []).map((m) => m.id);
    const lessons = moduleIds.length
      ? check(
          await client
            .from("lms_lessons")
            .select("id, module_id, title, content_type, duration_minutes, position, free_preview")
            .in("module_id", moduleIds)
            .order("position", { ascending: true }),
          { contexte: "lms_lessons" },
        )
      : [];
    return { course, modules: modules ?? [], lessons: lessons ?? [] };
  });

/** Une leçon et la liste ordonnée des leçons de la même formation. */
export const getLesson = createServerFn({ method: "GET" })
  .inputValidator((input: { slug: string; lessonId: string }) => input)
  .handler(async ({ data: input }) => {
    const client = publicClient();
    const course = check(
      await client
        .from("lms_courses")
        .select("id, title, slug")
        .eq("published", true)
        .eq("slug", input.slug)
        .maybeSingle(),
      { contexte: "lms_courses" },
    );
    if (!course) return null;

    const modules = check(
      await client
        .from("lms_modules")
        .select("id, position")
        .eq("course_id", course.id)
        .order("position", { ascending: true }),
      { contexte: "lms_modules" },
    );
    const moduleIds = (modules ?? []).map((m) => m.id);
    if (moduleIds.length === 0) return null;

    const lessons = check(
      await client
        .from("lms_lessons")
        .select("id, module_id, title, content_type, duration_minutes, position, free_preview")
        .in("module_id", moduleIds)
        .order("position", { ascending: true }),
      { contexte: "lms_lessons" },
    );

    const ordered = [...(lessons ?? [])].sort((a, b) => {
      const ma = moduleIds.indexOf(a.module_id);
      const mb = moduleIds.indexOf(b.module_id);
      return ma === mb ? a.position - b.position : ma - mb;
    });
    const lesson = ordered.find((item) => item.id === input.lessonId);
    if (!lesson) return null;
    // Contenu lu par la base selon les droits du visiteur : ici seulement les aperçus gratuits.
    // Les leçons réservées sont relues dans le navigateur avec la session de l'inscrit.
    const content = check(await client.rpc("lms_lesson_content", { _lesson_id: lesson.id }), {
      contexte: "lms_lesson_content",
    });
    const preview = content?.[0] ?? null;
    return {
      course,
      lesson: { ...lesson, content: preview?.content ?? null, video_url: preview?.video_url ?? null },
      lessons: ordered,
    };
  });
