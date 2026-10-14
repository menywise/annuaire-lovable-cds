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

/** Colonnes d'une leçon lisibles par tous (le contenu passe par lms_lesson_content). */
const LESSON_FIELDS =
  "id, module_id, title, content_type, duration_minutes, position, free_preview";

/** Tri par position croissante (celui que la base appliquait à chaque table). */
function byPosition<T extends { position: number }>(a: T, b: T) {
  return a.position - b.position;
}

/**
 * Détail d'une formation publiée : modules et leçons dans l'ordre. Une seule requête : la
 * formation avec ses modules et leurs leçons (tables liées), au lieu de trois requêtes en série.
 * Les règles d'accès des tables liées s'appliquent telles quelles (formation publiée seulement).
 */
export const getCourse = createServerFn({ method: "GET" })
  .inputValidator((input: { slug: string }) => input)
  .handler(async ({ data: input }) => {
    const row = check(
      await publicClient()
        .from("lms_courses")
        .select(
          `id, title, slug, excerpt, description, cover_url, level, duration_minutes, price_cents, currency, lms_modules(id, title, position, lms_lessons(${LESSON_FIELDS}))`,
        )
        .eq("published", true)
        .eq("slug", input.slug)
        .maybeSingle(),
      { contexte: "lms_courses" },
    );
    if (!row) return null;
    const { lms_modules, ...course } = row;
    const modules = lms_modules
      .map(({ id, title, position }) => ({ id, title, position }))
      .sort(byPosition);
    const lessons = lms_modules.flatMap((module) => module.lms_lessons).sort(byPosition);
    return { course, modules, lessons };
  });

/**
 * Une leçon et la liste ordonnée des leçons de la même formation. Deux requêtes en parallèle au
 * lieu de quatre en série : la formation avec ses modules et leçons, et le contenu de la leçon
 * demandée (identifiant fourni par l'adresse). Le contenu n'est retenu que si la leçon appartient
 * bien à la formation.
 */
export const getLesson = createServerFn({ method: "GET" })
  .inputValidator((input: { slug: string; lessonId: string }) => input)
  .handler(async ({ data: input }) => {
    const client = publicClient();
    // Contenu lu par la base selon les droits du visiteur : ici seulement les aperçus gratuits.
    // Les leçons réservées sont relues dans le navigateur avec la session de l'inscrit.
    const [courseRes, contentRes] = await Promise.all([
      client
        .from("lms_courses")
        .select(`id, title, slug, lms_modules(id, position, lms_lessons(${LESSON_FIELDS}))`)
        .eq("published", true)
        .eq("slug", input.slug)
        .maybeSingle(),
      client.rpc("lms_lesson_content", { _lesson_id: input.lessonId }),
    ]);
    const row = check(courseRes, { contexte: "lms_courses" });
    if (!row) return null;
    const { lms_modules, ...course } = row;
    const moduleIds = [...lms_modules].sort(byPosition).map((m) => m.id);
    if (moduleIds.length === 0) return null;

    const ordered = lms_modules
      .flatMap((module) => module.lms_lessons)
      .sort((a, b) => {
        const ma = moduleIds.indexOf(a.module_id);
        const mb = moduleIds.indexOf(b.module_id);
        return ma === mb ? a.position - b.position : ma - mb;
      });
    const lesson = ordered.find((item) => item.id === input.lessonId);
    if (!lesson) return null;
    const content = check(contentRes, { contexte: "lms_lesson_content" });
    const preview = content?.[0] ?? null;
    return {
      course,
      lesson: {
        ...lesson,
        content: preview?.content ?? null,
        video_url: preview?.video_url ?? null,
      },
      lessons: ordered,
    };
  });
