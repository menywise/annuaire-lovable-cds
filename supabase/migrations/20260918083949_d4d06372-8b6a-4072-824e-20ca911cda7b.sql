DROP POLICY "Articles publies visibles" ON public.blog_posts;
CREATE POLICY "Articles publies visibles par les visiteurs" ON public.blog_posts
  FOR SELECT TO anon USING (published);
CREATE POLICY "Articles visibles par les membres" ON public.blog_posts
  FOR SELECT TO authenticated USING (published OR public.has_role(auth.uid(), 'admin'));

DROP POLICY "FAQ publiee visible" ON public.faq_items;
CREATE POLICY "FAQ publiee visible par les visiteurs" ON public.faq_items
  FOR SELECT TO anon USING (published);
CREATE POLICY "FAQ visible par les membres" ON public.faq_items
  FOR SELECT TO authenticated USING (published OR public.has_role(auth.uid(), 'admin'));

DROP POLICY "Offres actives visibles" ON public.pricing_plans;
CREATE POLICY "Offres actives visibles par les visiteurs" ON public.pricing_plans
  FOR SELECT TO anon USING (active);
CREATE POLICY "Offres visibles par les membres" ON public.pricing_plans
  FOR SELECT TO authenticated USING (active OR public.has_role(auth.uid(), 'admin'));

DROP POLICY "Avis valides visibles" ON public.reviews;
CREATE POLICY "Avis valides visibles par les visiteurs" ON public.reviews
  FOR SELECT TO anon USING (approved);
CREATE POLICY "Avis visibles par les membres" ON public.reviews
  FOR SELECT TO authenticated
  USING (approved OR auth.uid() = author_id OR public.has_role(auth.uid(), 'admin'));

DROP POLICY "Temoignages valides visibles" ON public.testimonials;
CREATE POLICY "Temoignages valides visibles par les visiteurs" ON public.testimonials
  FOR SELECT TO anon USING (approved);
CREATE POLICY "Temoignages visibles par les membres" ON public.testimonials
  FOR SELECT TO authenticated
  USING (approved OR auth.uid() = author_id OR public.has_role(auth.uid(), 'admin'));