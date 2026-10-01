CREATE OR REPLACE FUNCTION public.starter_reset_demo(_scope text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _n integer;
  _out jsonb := '{}'::jsonb;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Réservé aux administrateurs' USING ERRCODE = '42501';
  END IF;
  IF _scope NOT IN ('exemples', 'demarrage') THEN
    RAISE EXCEPTION 'Lot inconnu : %', _scope USING ERRCODE = '22023';
  END IF;
  IF _scope = 'exemples' THEN
    DELETE FROM public.blog_comments WHERE id::text LIKE 'e7000000-%';
    GET DIAGNOSTICS _n = ROW_COUNT;
    _out := _out || jsonb_build_object('commentaires', _n);
    DELETE FROM public.testimonials WHERE id::text LIKE 'e7000000-%';
    GET DIAGNOSTICS _n = ROW_COUNT;
    _out := _out || jsonb_build_object('temoignages', _n);
    DELETE FROM public.reviews WHERE id::text LIKE 'e7000000-%';
    GET DIAGNOSTICS _n = ROW_COUNT;
    _out := _out || jsonb_build_object('avis', _n);
    DELETE FROM public.marketplace_listings WHERE id::text LIKE 'e7000000-%';
    GET DIAGNOSTICS _n = ROW_COUNT;
    _out := _out || jsonb_build_object('annonces', _n);
    DELETE FROM public.lms_progress WHERE lesson_id::text LIKE 'e7000000-%';
    DELETE FROM public.lms_enrollments WHERE course_id::text LIKE 'e7000000-%';
    DELETE FROM public.lms_courses WHERE id::text LIKE 'e7000000-%';
    GET DIAGNOSTICS _n = ROW_COUNT;
    _out := _out || jsonb_build_object('formations', _n);
    DELETE FROM public.forum_replies WHERE topic_id::text LIKE 'e7000000-%' OR id::text LIKE 'e7000000-%';
    DELETE FROM public.forum_topics WHERE id::text LIKE 'e7000000-%';
    GET DIAGNOSTICS _n = ROW_COUNT;
    _out := _out || jsonb_build_object('discussions', _n);
    DELETE FROM public.reports WHERE content_id::text LIKE 'e7000000-%';
    DELETE FROM public.member_profiles WHERE user_id::text LIKE 'e7000000-%';
    DELETE FROM public.profiles WHERE id::text LIKE 'e7000000-%';
    DELETE FROM auth.users WHERE id::text LIKE 'e7000000-%';
    GET DIAGNOSTICS _n = ROW_COUNT;
    _out := _out || jsonb_build_object('membres_fictifs', _n);
  ELSE
    DELETE FROM public.faq_items WHERE question IN (
      'Combien de temps faut-il pour lancer un site avec ce modèle ' || chr(63),
      'Dois-je toucher au code pour changer mes informations ' || chr(63),
      'Mes données et celles de mes visiteurs sont-elles protégées ' || chr(63),
      'Le référencement est-il vraiment prêt ' || chr(63));
    GET DIAGNOSTICS _n = ROW_COUNT;
    _out := _out || jsonb_build_object('faq', _n);
    DELETE FROM public.pricing_plans WHERE (name, tagline) IN (
      ('Découverte', 'Pour valider votre idée sans rien avancer.'),
      ('Professionnel', 'Pour le site qui doit convaincre et convertir.'),
      ('Expert', 'Pour les équipes qui pilotent plusieurs projets.'));
    GET DIAGNOSTICS _n = ROW_COUNT;
    _out := _out || jsonb_build_object('offres', _n);
    DELETE FROM public.blog_posts
    WHERE slug = 'pourquoi-un-socle-commun-fait-gagner-des-semaines'
      AND title = 'Pourquoi un socle commun vous fait gagner des semaines sur chaque projet';
    GET DIAGNOSTICS _n = ROW_COUNT;
    _out := _out || jsonb_build_object('articles', _n);
  END IF;
  RETURN _out;
END;
$$;
REVOKE ALL ON FUNCTION public.starter_reset_demo(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.starter_reset_demo(text) TO authenticated, service_role;
