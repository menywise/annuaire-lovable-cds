CREATE OR REPLACE FUNCTION public.starter_status()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _brand jsonb := coalesce((SELECT value FROM public.site_settings WHERE key = 'brand'), '{}'::jsonb);
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Réservé aux administrateurs' USING ERRCODE = '42501';
  END IF;
  RETURN jsonb_build_object(
    'marque_reglee', (SELECT count(*) FROM public.site_settings WHERE key = 'brand') > 0,
    'modules_choisis', EXISTS (SELECT 1 FROM public.site_settings
                               WHERE key = 'demarrage' AND (value -> 'modules_choisis_le') IS NOT NULL),
    'exemples', (SELECT count(*) FROM public.forum_topics WHERE id::text LIKE 'e7000000-%')
              + (SELECT count(*) FROM public.lms_courses WHERE id::text LIKE 'e7000000-%')
              + (SELECT count(*) FROM public.marketplace_listings WHERE id::text LIKE 'e7000000-%')
              + (SELECT count(*) FROM public.reviews WHERE id::text LIKE 'e7000000-%')
              + (SELECT count(*) FROM public.testimonials WHERE id::text LIKE 'e7000000-%')
              + (SELECT count(*) FROM public.blog_comments WHERE id::text LIKE 'e7000000-%'),
    'demarrage', (SELECT count(*) FROM public.faq_items WHERE question IN (
                    'Combien de temps faut-il pour lancer un site avec ce modèle ' || chr(63),
                    'Dois-je toucher au code pour changer mes informations ' || chr(63),
                    'Mes données et celles de mes visiteurs sont-elles protégées ' || chr(63),
                    'Le référencement est-il vraiment prêt ' || chr(63)))
               + (SELECT count(*) FROM public.pricing_plans WHERE (name, tagline) IN (
                    ('Découverte', 'Pour valider votre idée sans rien avancer.'),
                    ('Professionnel', 'Pour le site qui doit convaincre et convertir.'),
                    ('Expert', 'Pour les équipes qui pilotent plusieurs projets.')))
               + (SELECT count(*) FROM public.blog_posts
                  WHERE slug = 'pourquoi-un-socle-commun-fait-gagner-des-semaines'
                    AND title = 'Pourquoi un socle commun vous fait gagner des semaines sur chaque projet'),
    'administrateurs', (SELECT count(*) FROM public.user_roles WHERE role = 'admin'),
    'membres', (SELECT count(*) FROM public.profiles WHERE id::text NOT LIKE 'e7000000-%'),
    'domaine_envoi', coalesce(_brand -> 'email' ->> 'senderDomain', '')
  );
END;
$$;
REVOKE ALL ON FUNCTION public.starter_status() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.starter_status() TO authenticated, service_role;
