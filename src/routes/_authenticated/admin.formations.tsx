import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { AdminShell } from "@/components/cds/AdminShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { requireFeature } from "@/config/features";
import { downloadCsv } from "@/lib/csv";
import { formatPrice, slugify } from "@/lib/format";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/_authenticated/admin/formations")({
  beforeLoad: () => requireFeature("lms"),
  head: () =>
    seo({
      title: "Administration — Formations",
      description: "Créer et organiser les formations, leurs modules et leurs leçons.",
      path: "/admin/formations",
      noindex: true,
    }),
  component: AdminCoursesPage,
});

type Course = {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  level: string;
  price_cents: number;
  duration_minutes: number;
  published: boolean;
  position: number;
};

type Module = { id: string; course_id: string; title: string; position: number };
type Lesson = { id: string; module_id: string; title: string; position: number; free_preview: boolean };

function AdminCoursesPage() {
  const [courses, setCourses] = useState<Course[] | null>(null);
  const [modules, setModules] = useState<Module[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [enrollments, setEnrollments] = useState<Array<{ course_id: string }>>([]);
  const [openCourse, setOpenCourse] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [c, m, l, e] = await Promise.all([
      supabase
        .from("lms_courses")
        .select("id, title, slug, excerpt, level, price_cents, duration_minutes, published, position")
        .order("position"),
      supabase.from("lms_modules").select("id, course_id, title, position").order("position"),
      supabase.from("lms_lessons").select("id, module_id, title, position, free_preview").order("position"),
      supabase.from("lms_enrollments").select("course_id"),
    ]);
    setCourses(c.data ?? []);
    setModules(m.data ?? []);
    setLessons(l.data ?? []);
    setEnrollments(e.data ?? []);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function addCourse(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const title = String(data.get("title") ?? "").trim();
    if (!title) return;
    const { error } = await supabase.from("lms_courses").insert({
      title,
      slug: slugify(title),
      excerpt: String(data.get("excerpt") ?? ""),
      level: String(data.get("level") ?? "debutant"),
      price_cents: Math.round(Number(data.get("price") ?? 0) * 100),
      position: (courses ?? []).length,
    });
    if (error) toast.error("Formation non créée.");
    else {
      toast.success("Formation créée.");
      form.reset();
      void load();
    }
  }

  async function addModule(courseId: string, title: string) {
    const count = modules.filter((item) => item.course_id === courseId).length;
    const { error } = await supabase.from("lms_modules").insert({ course_id: courseId, title, position: count });
    if (error) toast.error("Module non créé.");
    else void load();
  }

  async function addLesson(moduleId: string, title: string) {
    const count = lessons.filter((item) => item.module_id === moduleId).length;
    const { error } = await supabase.from("lms_lessons").insert({ module_id: moduleId, title, position: count });
    if (error) toast.error("Leçon non créée.");
    else void load();
  }

  return (
    <AdminShell
      title="Formations"
      intro="Organisez votre catalogue : une formation, ses modules, puis ses leçons. Rien n'est visible tant que ce n'est pas publié."
    >
      <form onSubmit={addCourse} className="grid gap-3 rounded-xl border border-border bg-card p-5 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Label htmlFor="course-title">Titre de la formation</Label>
          <Input id="course-title" name="title" required className="mt-1" placeholder="Réussir son premier lancement" />
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor="course-excerpt">Promesse en une phrase</Label>
          <Textarea id="course-excerpt" name="excerpt" rows={2} className="mt-1" />
        </div>
        <div>
          <Label htmlFor="course-level">Niveau</Label>
          <select
            id="course-level"
            name="level"
            className="mt-1 h-10 w-full rounded-md border border-border bg-card px-3 text-sm text-foreground"
          >
            <option value="debutant">Débutant</option>
            <option value="intermediaire">Intermédiaire</option>
            <option value="avance">Avancé</option>
          </select>
        </div>
        <div>
          <Label htmlFor="course-price">Prix en euros (0 = gratuite)</Label>
          <Input id="course-price" name="price" type="number" min="0" step="1" defaultValue="0" className="mt-1" />
        </div>
        <div className="sm:col-span-2">
          <Button type="submit" title="Créer cette formation">
            Créer la formation
          </Button>
        </div>
      </form>

      {courses === null ? (
        <p className="mt-6 text-sm text-muted-foreground">Chargement…</p>
      ) : (
        <>
          <div className="mt-6 flex items-center gap-3">
            <p className="text-sm text-muted-foreground">
              {courses.length} formations · {enrollments.length} inscriptions
            </p>
            <Button
              variant="outline"
              className="ml-auto"
              title="Télécharger le catalogue au format tableur"
              onClick={() => downloadCsv("formations.csv", courses)}
            >
              Export CSV
            </Button>
          </div>

          <ul className="mt-3 space-y-3">
            {courses.map((course) => {
              const courseModules = modules.filter((item) => item.course_id === course.id);
              const learners = enrollments.filter((item) => item.course_id === course.id).length;
              return (
                <li key={course.id} className="rounded-xl border border-border bg-card p-5">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-foreground">{course.title}</p>
                    <span className="text-xs text-muted-foreground">
                      {course.price_cents === 0 ? "Gratuite" : formatPrice(course.price_cents)} · {learners} inscrits
                    </span>
                    <span className="ml-auto rounded-full bg-muted px-2.5 py-0.5 text-xs text-muted-foreground">
                      {course.published ? "Publiée" : "Brouillon"}
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                      variant={course.published ? "outline" : "default"}
                      title={course.published ? "Retirer du catalogue" : "Publier au catalogue"}
                      onClick={async () => {
                        await supabase.from("lms_courses").update({ published: !course.published }).eq("id", course.id);
                        void load();
                      }}
                    >
                      {course.published ? "Dépublier" : "Publier"}
                    </Button>
                    <Button
                      variant="outline"
                      title="Afficher ou masquer le programme"
                      onClick={() => setOpenCourse(openCourse === course.id ? null : course.id)}
                    >
                      {openCourse === course.id ? "Masquer le programme" : "Programme"}
                    </Button>
                  </div>

                  {openCourse === course.id ? (
                    <div className="mt-4 space-y-3 border-t border-border pt-4">
                      {courseModules.map((module) => (
                        <div key={module.id} className="rounded-lg bg-muted p-3">
                          <p className="text-sm font-medium text-foreground">{module.title}</p>
                          <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                            {lessons
                              .filter((lesson) => lesson.module_id === module.id)
                              .map((lesson) => (
                                <li key={lesson.id}>
                                  · {lesson.title}
                                  {lesson.free_preview ? " (aperçu libre)" : ""}
                                </li>
                              ))}
                          </ul>
                          <form
                            className="mt-2 flex gap-2"
                            onSubmit={(event) => {
                              event.preventDefault();
                              const input = event.currentTarget.elements.namedItem("lesson") as HTMLInputElement;
                              if (input.value.trim()) void addLesson(module.id, input.value.trim());
                              event.currentTarget.reset();
                            }}
                          >
                            <Input name="lesson" placeholder="Nouvelle leçon" aria-label="Titre de la leçon" />
                            <Button type="submit" variant="outline" title="Ajouter cette leçon au module">
                              Ajouter
                            </Button>
                          </form>
                        </div>
                      ))}
                      <form
                        className="flex gap-2"
                        onSubmit={(event) => {
                          event.preventDefault();
                          const input = event.currentTarget.elements.namedItem("module") as HTMLInputElement;
                          if (input.value.trim()) void addModule(course.id, input.value.trim());
                          event.currentTarget.reset();
                        }}
                      >
                        <Input name="module" placeholder="Nouveau module" aria-label="Titre du module" />
                        <Button type="submit" variant="outline" title="Ajouter ce module à la formation">
                          Ajouter un module
                        </Button>
                      </form>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </>
      )}
    </AdminShell>
  );
}
