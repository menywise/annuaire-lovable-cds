import { createServerFn } from "@tanstack/react-start";
import { publicClient } from "@/lib/supabase-public";

/** Catalogue des formations publiées. */
export const listCourses = createServerFn({ method: "GET" }).handler(async () => {
  const client = publicClient();
  const [{ data: courses }, { data: enrollments }] = await Promise.all([
    client
      .from("lms_courses")
      .select(
        "id, title, slug, excerpt, description, cover_url, level, duration_minutes, price_cents, currency, position",
      )
      .eq("published", true)
      .order("position", { ascending: true }),
    client.from("lms_enrollments").select("course_id"),
  ]);
  const counts = new Map<string, number>();
  for (const row of enrollments ?? []) {
    counts.set(row.course_id, (counts.get(row.course_id) ?? 0) + 1);
  }
  return (courses ?? []).map((course) => ({ ...course, learners: counts.get(course.id) ?? 0 }));
});

/** Détail d'une formation publiée : modules et leçons dans l'ordre. */
export const getCourse = createServerFn({ method: "GET" })
  .inputValidator((input: { slug: string }) => input)
  .handler(async ({ data: input }) => {
    const client = publicClient();
    const { data: course } = await client
      .from("lms_courses")
      .select(
        "id, title, slug, excerpt, description, cover_url, level, duration_minutes, price_cents, currency",
      )
      .eq("published", true)
      .eq("slug", input.slug)
      .maybeSingle();
    if (!course) return null;
    const { data: modules } = await client
      .from("lms_modules")
      .select("id, title, position")
      .eq("course_id", course.id)
      .order("position", { ascending: true });
    const moduleIds = (modules ?? []).map((m) => m.id);
    const { data: lessons } = moduleIds.length
      ? await client
          .from("lms_lessons")
          .select("id, module_id, title, content_type, duration_minutes, position, free_preview")
          .in("module_id", moduleIds)
          .order("position", { ascending: true })
      : { data: [] };
    return { course, modules: modules ?? [], lessons: lessons ?? [] };
  });
