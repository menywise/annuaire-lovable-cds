import { supabase } from "@/integrations/supabase/client";

/** Tables administrées dont l'ordre d'affichage tient dans une colonne `position`. */
export type OrderedTable =
  | "forum_categories"
  | "testimonials"
  | "directory_categories"
  | "marketplace_categories"
  | "lms_courses"
  | "lms_modules"
  | "lms_lessons"
  | "faq_items"
  | "pricing_plans";

/**
 * Déplace la ligne `index` d'un cran (`delta` = -1 monte, +1 descend) puis renumérote 0, 1, 2…
 * Seules les lignes dont la position change sont écrites. Renvoie faux si une écriture échoue.
 */
export async function moveRow(
  table: OrderedTable,
  rows: ReadonlyArray<{ id: string; position: number }>,
  index: number,
  delta: number,
): Promise<boolean> {
  const target = index + delta;
  if (target < 0 || target >= rows.length) return true;
  const next = [...rows];
  [next[index], next[target]] = [next[target]!, next[index]!];
  const results = await Promise.all(
    next.map((row, position) =>
      row.position === position
        ? Promise.resolve({ error: null })
        : supabase
            .from(table)
            .update({ position } as never)
            .eq("id", row.id),
    ),
  );
  return !results.some((r) => r.error);
}
