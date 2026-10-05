\set ON_ERROR_STOP 1
\i tests/db/_helpers.sql
BEGIN;
-- Lot 6 : l'admin modifie, ordonne et supprime tout ce que l'administration affiche ; le membre non.
INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-0000000000a1', 'admin@test.fr'),
  ('00000000-0000-0000-0000-0000000000a2', 'membre@test.fr');
SELECT pg_temp.as_user('00000000-0000-0000-0000-0000000000a1', 'admin@test.fr');
SELECT public.bootstrap_current_user('Administrateur');
SELECT pg_temp.as_user('00000000-0000-0000-0000-0000000000a2', 'membre@test.fr');
SELECT public.bootstrap_current_user('Membre');
RESET ROLE;
UPDATE public.site_settings SET value = value || '{"directory": true}' WHERE key = 'modules';
SELECT pg_temp.as_user('00000000-0000-0000-0000-0000000000a2', 'membre@test.fr');

-- Données de départ : une annonce et une fiche déposées par le membre.
INSERT INTO public.marketplace_listings (id, seller_id, slug, title, status)
  VALUES ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000a2', 'velo', 'Vélo', 'active');
INSERT INTO public.directory_listings (id, name, slug, created_by, status)
  VALUES ('00000000-0000-0000-0000-0000000000d2', 'Atelier', 'atelier', '00000000-0000-0000-0000-0000000000a2', 'draft');

-- Le membre ne crée ni ne modifie les catégories, formations, emplacements.
SELECT pg_temp.expect_error($$INSERT INTO public.directory_categories (name, slug) VALUES ('X', 'x')$$, 'membre crée une catégorie');
SELECT pg_temp.expect_error($$INSERT INTO public.lms_courses (title, slug) VALUES ('X', 'x')$$, 'membre crée une formation');
SELECT pg_temp.expect_error($$INSERT INTO public.ad_placements (name, slug) VALUES ('X', 'x')$$, 'membre crée un emplacement');

-- L'admin : catégories (créer, renommer, ordonner, supprimer).
SELECT pg_temp.as_user('00000000-0000-0000-0000-0000000000a1', 'admin@test.fr');
INSERT INTO public.directory_categories (id, name, slug, position) VALUES
  ('00000000-0000-0000-0000-0000000000c1', 'Plombiers', 'plombiers', 0),
  ('00000000-0000-0000-0000-0000000000c2', 'Maçons', 'macons', 1);
UPDATE public.directory_categories SET name = 'Plomberie', slug = 'plomberie', description = 'Dépannage', position = 1
  WHERE id = '00000000-0000-0000-0000-0000000000c1';
UPDATE public.directory_categories SET position = 0 WHERE id = '00000000-0000-0000-0000-0000000000c2';
UPDATE public.directory_listings SET category_id = '00000000-0000-0000-0000-0000000000c1' WHERE id = '00000000-0000-0000-0000-0000000000d2';
DELETE FROM public.directory_categories WHERE id = '00000000-0000-0000-0000-0000000000c1';
INSERT INTO public.marketplace_categories (id, name, slug) VALUES ('00000000-0000-0000-0000-0000000000c3', 'Matériel', 'materiel');
UPDATE public.marketplace_categories SET name = 'Outillage', position = 3 WHERE id = '00000000-0000-0000-0000-0000000000c3';
DELETE FROM public.marketplace_categories WHERE id = '00000000-0000-0000-0000-0000000000c3';

-- L'admin corrige la fiche du membre, puis l'archive ; revendication acceptée et datée.
UPDATE public.directory_listings SET name = 'Atelier Martin', description = 'Réparations', phone = '0102030405',
  claim_requested_by = '00000000-0000-0000-0000-0000000000a2' WHERE id = '00000000-0000-0000-0000-0000000000d2';
UPDATE public.directory_listings SET claimed_by = claim_requested_by, claimed_at = now(),
  claim_requested_by = NULL, claim_requested_at = NULL WHERE id = '00000000-0000-0000-0000-0000000000d2';
UPDATE public.directory_listings SET status = 'archived' WHERE id = '00000000-0000-0000-0000-0000000000d2';

-- L'admin corrige une annonce validée : elle reste validée (seul le vendeur la renvoie en validation).
UPDATE public.marketplace_listings SET approved = true WHERE id = '00000000-0000-0000-0000-0000000000d1';
UPDATE public.marketplace_listings SET title = 'Vélo de ville', price_cents = 12000 WHERE id = '00000000-0000-0000-0000-0000000000d1';

-- Formations : créer, modifier, ordonner, supprimer cours, modules, leçons.
INSERT INTO public.lms_courses (id, title, slug) VALUES ('00000000-0000-0000-0000-0000000000e1', 'Cours', 'cours');
UPDATE public.lms_courses SET title = 'Cours complet', price_cents = 4900, level = 'avance', description = 'Tout'
  WHERE id = '00000000-0000-0000-0000-0000000000e1';
INSERT INTO public.lms_modules (id, course_id, title, position) VALUES
  ('00000000-0000-0000-0000-0000000000e2', '00000000-0000-0000-0000-0000000000e1', 'M1', 0),
  ('00000000-0000-0000-0000-0000000000e3', '00000000-0000-0000-0000-0000000000e1', 'M2', 1);
UPDATE public.lms_modules SET title = 'Module 1', position = 1 WHERE id = '00000000-0000-0000-0000-0000000000e2';
INSERT INTO public.lms_lessons (id, module_id, title) VALUES ('00000000-0000-0000-0000-0000000000e4', '00000000-0000-0000-0000-0000000000e3', 'L1');
UPDATE public.lms_lessons SET position = 2 WHERE id = '00000000-0000-0000-0000-0000000000e4';
DELETE FROM public.lms_modules WHERE id = '00000000-0000-0000-0000-0000000000e3';

-- Régie : emplacement et campagne modifiés puis supprimés.
INSERT INTO public.ad_placements (id, name, slug) VALUES ('00000000-0000-0000-0000-0000000000f1', 'Bandeau', 'bandeau');
UPDATE public.ad_placements SET name = 'Bandeau blog', width = 728, height = 90, active = false WHERE id = '00000000-0000-0000-0000-0000000000f1';
INSERT INTO public.ad_campaigns (id, placement_id, advertiser, title, link_url)
  VALUES ('00000000-0000-0000-0000-0000000000f2', '00000000-0000-0000-0000-0000000000f1', 'Acme', 'Promo', 'https://acme.test');
UPDATE public.ad_campaigns SET title = 'Promo été', ends_at = now() + interval '30 days' WHERE id = '00000000-0000-0000-0000-0000000000f2';
DELETE FROM public.ad_placements WHERE id = '00000000-0000-0000-0000-0000000000f1';
RESET ROLE;

DO $$ BEGIN
  IF (SELECT category_id FROM public.directory_listings WHERE id = '00000000-0000-0000-0000-0000000000d2') IS NOT NULL
  THEN RAISE EXCEPTION 'catégorie supprimée encore rattachée'; END IF;
  IF (SELECT claimed_at IS NULL OR claim_requested_by IS NOT NULL FROM public.directory_listings WHERE id = '00000000-0000-0000-0000-0000000000d2')
  THEN RAISE EXCEPTION 'revendication mal enregistrée'; END IF;
  IF NOT (SELECT approved FROM public.marketplace_listings WHERE id = '00000000-0000-0000-0000-0000000000d1')
  THEN RAISE EXCEPTION 'annonce corrigée par l''admin repassée en validation'; END IF;
  IF (SELECT count(*) FROM public.lms_lessons WHERE id = '00000000-0000-0000-0000-0000000000e4') <> 0
  THEN RAISE EXCEPTION 'leçon d''un module supprimé restée en base'; END IF;
  IF (SELECT count(*) FROM public.ad_campaigns WHERE id = '00000000-0000-0000-0000-0000000000f2') <> 0
  THEN RAISE EXCEPTION 'campagne d''un emplacement supprimé restée en base'; END IF;
END $$;

-- Le membre ne modifie pas la fiche archivée par l'admin pour la republier, ni les catégories.
SELECT pg_temp.as_user('00000000-0000-0000-0000-0000000000a2', 'membre@test.fr');
UPDATE public.directory_categories SET name = 'Piraté' WHERE id = '00000000-0000-0000-0000-0000000000c2';
RESET ROLE;
DO $$ BEGIN
  IF (SELECT name FROM public.directory_categories WHERE id = '00000000-0000-0000-0000-0000000000c2') <> 'Maçons'
  THEN RAISE EXCEPTION 'catégorie modifiée par un membre'; END IF;
END $$;
ROLLBACK;
