DROP POLICY IF EXISTS "Grille de conformite visible par tous" ON public.template_checks;
CREATE POLICY "Admins lisent la grille de conformite" ON public.template_checks FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Plan directeur visible" ON public.masterplan_sections;
CREATE POLICY "Admins lisent le plan directeur" ON public.masterplan_sections FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Feuille de route visible" ON public.roadmap_items;
CREATE POLICY "Admins lisent la feuille de route" ON public.roadmap_items FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));