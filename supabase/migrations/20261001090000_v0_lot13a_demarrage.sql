-- V0 · Lot 13 a — Kit de démarrage d'un clone de CDS.
-- Le socle ne contient rien de propre à un projet : chaque projet est un clone qui règle sa marque,
-- ses e-mails, ses modules, puis retire les contenus de démonstration livrés avec le socle.
-- Rejouable sans danger. Écrit pour l'éditeur SQL de Lovable : ni antislash ni opérateur « ? »,
-- aucune ligne vide dans une fonction.

-- 1. Retrait des contenus de démonstration (admin) -----------------------------------------------------
-- « exemples » : jeu d'exemples de la recette (identifiants e7000000-…, membre fictif) ;
-- « demarrage » : FAQ, offres et article livrés avec le socle, reconnus à leur texte d'origine
-- (un contenu déjà modifié par le projet n'est jamais retiré).
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

-- 2. État du démarrage (admin) ----------------------------------------------------------------------
-- Ce qui reste à régler dans la base. Les secrets d'environnement sont vérifiés par le serveur.
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

-- 3. Grille de conformité ----------------------------------------------------------------------------
INSERT INTO public.template_checks (code, area, label, requirement, status, severity, evidence, position)
SELECT v.code, v.area, v.label, v.requirement, v.status, v.severity, v.evidence,
       coalesce((SELECT max(position) FROM public.template_checks), 0) + v.n
FROM (VALUES
  (1, 'V0-KIT-DEMARRAGE', 'Socle', 'Kit de démarrage d''un clone',
   'Aucune valeur propre à un projet dans le code : nom, adresse et domaine d''envoi des e-mails lus dans les réglages ; écran Démarrage (réglages, secrets, contenus de démonstration) ; mode d''emploi docs/CLONER.md.',
   'a_verifier', 'bloquant', 'tests/db/test_18 ; écran /admin/demarrage')
) AS v(n, code, area, label, requirement, status, severity, evidence)
ON CONFLICT (code) DO NOTHING;
