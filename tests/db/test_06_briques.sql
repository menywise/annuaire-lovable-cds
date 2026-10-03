\set ON_ERROR_STOP 1
\i tests/db/_helpers.sql
BEGIN;
-- a1 : admin du studio · a2 : membre · a3 : autre membre
INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-0000000000a1', 'admin@test.fr'),
  ('00000000-0000-0000-0000-0000000000a2', 'membre@test.fr'),
  ('00000000-0000-0000-0000-0000000000a3', 'autre@test.fr');
SELECT pg_temp.as_user('00000000-0000-0000-0000-0000000000a1', 'admin@test.fr');
SELECT public.bootstrap_current_user('Administrateur');
SELECT pg_temp.as_user('00000000-0000-0000-0000-0000000000a2', 'membre@test.fr');
SELECT public.bootstrap_current_user('Membre');
RESET ROLE;

-- 1. Petites annonces --------------------------------------------------------------------
SELECT pg_temp.as_user('00000000-0000-0000-0000-0000000000a2', 'membre@test.fr');
SELECT pg_temp.expect_error($$INSERT INTO public.marketplace_listings (seller_id, slug, title, status, approved)
  VALUES ('00000000-0000-0000-0000-0000000000a2', 'auto', 'Auto-validée', 'active', true)$$, 'annonce auto-validée');
INSERT INTO public.marketplace_listings (id, seller_id, slug, title, status)
  VALUES ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000a2', 'velo', 'Vélo', 'active');
SELECT pg_temp.expect_error($$UPDATE public.marketplace_listings SET approved = true WHERE id = '00000000-0000-0000-0000-0000000000d1'$$, 'vendeur valide son annonce');
SELECT pg_temp.expect_error($$UPDATE public.marketplace_listings SET views = 9999 WHERE id = '00000000-0000-0000-0000-0000000000d1'$$, 'vendeur gonfle les vues');
-- Le vendeur passe son annonce en « vendue » sans problème.
UPDATE public.marketplace_listings SET status = 'sold' WHERE id = '00000000-0000-0000-0000-0000000000d1';
UPDATE public.marketplace_listings SET status = 'active' WHERE id = '00000000-0000-0000-0000-0000000000d1';
-- L'admin valide.
SELECT pg_temp.as_user('00000000-0000-0000-0000-0000000000a1', 'admin@test.fr');
UPDATE public.marketplace_listings SET approved = true WHERE id = '00000000-0000-0000-0000-0000000000d1';
-- Une annonce validée puis modifiée par le vendeur repasse en attente de validation.
SELECT pg_temp.as_user('00000000-0000-0000-0000-0000000000a2', 'membre@test.fr');
UPDATE public.marketplace_listings SET description = 'Texte changé après validation' WHERE id = '00000000-0000-0000-0000-0000000000d1';
RESET ROLE;
DO $$ BEGIN
  IF (SELECT approved FROM public.marketplace_listings WHERE id = '00000000-0000-0000-0000-0000000000d1')
  THEN RAISE EXCEPTION 'annonce modifiée restée validée'; END IF;
END $$;
-- Les vues se comptent par la fonction dédiée, pour un visiteur, uniquement sur une annonce visible.
UPDATE public.marketplace_listings SET approved = true WHERE id = '00000000-0000-0000-0000-0000000000d1';
SELECT pg_temp.as_anon();
SELECT public.increment_listing_views('00000000-0000-0000-0000-0000000000d1');
RESET ROLE;
DO $$ BEGIN
  IF (SELECT views FROM public.marketplace_listings WHERE id = '00000000-0000-0000-0000-0000000000d1') <> 1
  THEN RAISE EXCEPTION 'vue non comptée'; END IF;
END $$;

-- 2. Annuaire métier ------------------------------------------------------------------------
SELECT pg_temp.as_user('00000000-0000-0000-0000-0000000000a2', 'membre@test.fr');
SELECT pg_temp.expect_error($$INSERT INTO public.directory_listings (name, slug, created_by, status)
  VALUES ('Publiée', 'publiee', '00000000-0000-0000-0000-0000000000a2', 'published')$$, 'fiche publiée sans modération');
SELECT pg_temp.expect_error($$INSERT INTO public.directory_listings (name, slug, created_by, verified)
  VALUES ('Vérifiée', 'verifiee', '00000000-0000-0000-0000-0000000000a2', true)$$, 'fiche auto-vérifiée');
SELECT pg_temp.expect_error($$INSERT INTO public.directory_listings (name, slug, created_by, claimed_by)
  VALUES ('Revendiquée', 'revendiquee', '00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-0000000000a2')$$, 'fiche auto-revendiquée');
-- Proposer sa propre fiche avec une demande de revendication (validée ensuite par l'admin).
INSERT INTO public.directory_listings (id, name, slug, created_by, claim_requested_by, claim_requested_at)
  VALUES ('00000000-0000-0000-0000-0000000000f1', 'Garage', 'garage', '00000000-0000-0000-0000-0000000000a2',
          '00000000-0000-0000-0000-0000000000a2', now());
SELECT pg_temp.expect_error($$INSERT INTO public.directory_listings (name, slug, created_by, claim_requested_by)
  VALUES ('Pour un autre', 'pour-un-autre', '00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-0000000000a3')$$, 'demande de revendication au nom d''un autre');
SELECT pg_temp.expect_error($$UPDATE public.directory_listings SET status = 'published' WHERE id = '00000000-0000-0000-0000-0000000000f1'$$, 'auteur publie sa fiche');
SELECT pg_temp.expect_error($$UPDATE public.directory_listings SET featured = true WHERE id = '00000000-0000-0000-0000-0000000000f1'$$, 'auteur met sa fiche en avant');
SELECT pg_temp.expect_error($$UPDATE public.directory_listings SET plan = 'premium' WHERE id = '00000000-0000-0000-0000-0000000000f1'$$, 'auteur passe en premium');
SELECT pg_temp.expect_error($$UPDATE public.directory_listings SET claimed_by = '00000000-0000-0000-0000-0000000000a2' WHERE id = '00000000-0000-0000-0000-0000000000f1'$$, 'auteur revendique sans validation');
-- L'auteur corrige le contenu de sa fiche.
UPDATE public.directory_listings SET description = 'Réparations toutes marques' WHERE id = '00000000-0000-0000-0000-0000000000f1';
-- L'admin publie.
SELECT pg_temp.as_user('00000000-0000-0000-0000-0000000000a1', 'admin@test.fr');
UPDATE public.directory_listings SET status = 'published', verified = true WHERE id = '00000000-0000-0000-0000-0000000000f1';

-- Avis sur une fiche : jamais auto-validé.
SELECT pg_temp.as_user('00000000-0000-0000-0000-0000000000a3', 'autre@test.fr');
SELECT pg_temp.expect_error($$INSERT INTO public.directory_reviews (listing_id, author_id, rating, approved)
  VALUES ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000a3', 5, true)$$, 'avis annuaire auto-validé');
INSERT INTO public.directory_reviews (id, listing_id, author_id, rating, content)
  VALUES ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000a3', 5, 'Bien');
SELECT pg_temp.expect_error($$UPDATE public.directory_reviews SET approved = true WHERE id = '00000000-0000-0000-0000-0000000000e1'$$, 'auteur valide son avis');
SELECT pg_temp.as_user('00000000-0000-0000-0000-0000000000a1', 'admin@test.fr');
UPDATE public.directory_reviews SET approved = true WHERE id = '00000000-0000-0000-0000-0000000000e1';
-- Un avis validé puis modifié par son auteur repasse en attente.
SELECT pg_temp.as_user('00000000-0000-0000-0000-0000000000a3', 'autre@test.fr');
UPDATE public.directory_reviews SET content = 'Finalement moyen', rating = 2 WHERE id = '00000000-0000-0000-0000-0000000000e1';
RESET ROLE;
DO $$ BEGIN
  IF (SELECT approved FROM public.directory_reviews WHERE id = '00000000-0000-0000-0000-0000000000e1')
  THEN RAISE EXCEPTION 'avis modifié resté validé'; END IF;
END $$;

-- 3. Formations -----------------------------------------------------------------------------
INSERT INTO public.lms_courses (id, title, slug, published, price_cents) VALUES
  ('00000000-0000-0000-0000-0000000000c1', 'Offerte', 'offerte', true, 0),
  ('00000000-0000-0000-0000-0000000000c2', 'Payante', 'payante', true, 4900),
  ('00000000-0000-0000-0000-0000000000c3', 'Brouillon', 'brouillon', false, 0);
INSERT INTO public.lms_modules (id, course_id, title) VALUES
  ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000c1', 'M1'),
  ('00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-0000000000c2', 'M2');
INSERT INTO public.lms_lessons (id, module_id, title, content, free_preview) VALUES
  ('00000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-0000000000b1', 'Aperçu', 'Contenu aperçu', true),
  ('00000000-0000-0000-0000-000000000012', '00000000-0000-0000-0000-0000000000b1', 'Leçon offerte', 'Contenu offert', false),
  ('00000000-0000-0000-0000-000000000021', '00000000-0000-0000-0000-0000000000b2', 'Leçon payante', 'Contenu payant', false);

-- Un visiteur voit le plan des leçons mais pas leur contenu ; il lit l'aperçu gratuit.
SELECT pg_temp.as_anon();
DO $$ BEGIN
  IF (SELECT count(*) FROM public.lms_lessons) <> 3 THEN RAISE EXCEPTION 'plan des leçons invisible'; END IF;
END $$;
SELECT pg_temp.expect_error($$SELECT content FROM public.lms_lessons$$, 'visiteur lit le contenu brut des leçons');
DO $$ BEGIN
  IF (SELECT content FROM public.lms_lesson_content('00000000-0000-0000-0000-000000000011')) <> 'Contenu aperçu'
  THEN RAISE EXCEPTION 'aperçu gratuit illisible'; END IF;
  IF EXISTS (SELECT 1 FROM public.lms_lesson_content('00000000-0000-0000-0000-000000000012'))
  THEN RAISE EXCEPTION 'visiteur lit une leçon sans inscription'; END IF;
END $$;

-- Un membre ne s'inscrit ni à une formation non publiée, ni au nom d'un autre, ni en se déclarant payé.
SELECT pg_temp.as_user('00000000-0000-0000-0000-0000000000a2', 'membre@test.fr');
SELECT pg_temp.expect_error($$INSERT INTO public.lms_enrollments (user_id, course_id)
  VALUES ('00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-0000000000c3')$$, 'inscription à une formation non publiée');
SELECT pg_temp.expect_error($$INSERT INTO public.lms_enrollments (user_id, course_id)
  VALUES ('00000000-0000-0000-0000-0000000000a3', '00000000-0000-0000-0000-0000000000c1')$$, 'inscription au nom d''un autre');
SELECT pg_temp.expect_error($$INSERT INTO public.lms_enrollments (user_id, course_id, paid_at)
  VALUES ('00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-0000000000c2', now())$$, 'inscription payée déclarée par le membre');
INSERT INTO public.lms_enrollments (user_id, course_id) VALUES
  ('00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-0000000000c1'),
  ('00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-0000000000c2');
-- Un membre ne se déclare pas payé (la modification est ignorée).
UPDATE public.lms_enrollments SET paid_at = now();
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM public.lms_enrollments WHERE paid_at IS NOT NULL)
  THEN RAISE EXCEPTION 'membre s''est déclaré payé'; END IF;
  -- Inscrit à une formation offerte : accès au contenu.
  IF (SELECT content FROM public.lms_lesson_content('00000000-0000-0000-0000-000000000012')) <> 'Contenu offert'
  THEN RAISE EXCEPTION 'inscrit sans accès à la formation offerte'; END IF;
  -- Inscrit (réservation) à une formation payante non réglée : pas d'accès.
  IF EXISTS (SELECT 1 FROM public.lms_lesson_content('00000000-0000-0000-0000-000000000021'))
  THEN RAISE EXCEPTION 'contenu payant lu sans paiement'; END IF;
END $$;
-- La progression ne s'enregistre que sur une leçon accessible.
INSERT INTO public.lms_progress (user_id, lesson_id, completed_at)
  VALUES ('00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-000000000012', now());
SELECT pg_temp.expect_error($$INSERT INTO public.lms_progress (user_id, lesson_id, completed_at)
  VALUES ('00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-000000000021', now())$$, 'progression sur une leçon payée non réglée');

-- L'admin enregistre le paiement : l'accès s'ouvre.
SELECT pg_temp.as_user('00000000-0000-0000-0000-0000000000a1', 'admin@test.fr');
UPDATE public.lms_enrollments SET paid_at = now()
  WHERE user_id = '00000000-0000-0000-0000-0000000000a2' AND course_id = '00000000-0000-0000-0000-0000000000c2';
-- L'admin lit et écrit le contenu brut des leçons.
UPDATE public.lms_lessons SET content = 'Contenu payant v2' WHERE id = '00000000-0000-0000-0000-000000000021';
DO $$ BEGIN
  IF (SELECT content FROM public.lms_lesson_content('00000000-0000-0000-0000-000000000021')) <> 'Contenu payant v2'
  THEN RAISE EXCEPTION 'admin ne lit pas le contenu'; END IF;
END $$;
SELECT pg_temp.as_user('00000000-0000-0000-0000-0000000000a2', 'membre@test.fr');
DO $$ BEGIN
  IF (SELECT content FROM public.lms_lesson_content('00000000-0000-0000-0000-000000000021')) <> 'Contenu payant v2'
  THEN RAISE EXCEPTION 'payé sans accès au contenu'; END IF;
END $$;
RESET ROLE;
ROLLBACK;
