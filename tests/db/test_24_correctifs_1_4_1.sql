\set ON_ERROR_STOP 1
\i tests/db/_helpers.sql
BEGIN;
-- Socle 1.4.1 : pilotage réservé à l'admin, annuaire vu du visiteur, annuaire éteint fermé aux membres,
-- géographie fermée en écriture, contrôle des tables sans protection.
-- a1 : admin · a2 : membre · a3 : autre membre
INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-0000000000a1', 'admin@test.fr'),
  ('00000000-0000-0000-0000-0000000000a2', 'membre@test.fr'),
  ('00000000-0000-0000-0000-0000000000a3', 'autre@test.fr');
SELECT pg_temp.as_user('00000000-0000-0000-0000-0000000000a1', 'admin@test.fr');
SELECT public.bootstrap_current_user('Administrateur');
SELECT pg_temp.as_user('00000000-0000-0000-0000-0000000000a2', 'membre@test.fr');
SELECT public.bootstrap_current_user('Membre');
SELECT pg_temp.as_user('00000000-0000-0000-0000-0000000000a3', 'autre@test.fr');
SELECT public.bootstrap_current_user('Autre');
RESET ROLE;

-- 1. Pilotage : l'admin gère tout, le membre et le visiteur ne voient ni n'écrivent rien ------------
SELECT pg_temp.as_user('00000000-0000-0000-0000-0000000000a1', 'admin@test.fr');
INSERT INTO public.roadmap_items (id, title, lot) VALUES ('00000000-0000-0000-0000-0000000000e1', 'Lot essai', '1');
UPDATE public.roadmap_items SET title = 'Lot renommé' WHERE id = '00000000-0000-0000-0000-0000000000e1';
INSERT INTO public.masterplan_sections (id, title, content) VALUES ('00000000-0000-0000-0000-0000000000e2', 'Cap', 'Texte');
INSERT INTO public.audits (id, label) VALUES ('00000000-0000-0000-0000-0000000000e3', 'Audit essai');
INSERT INTO public.audit_findings (id, audit_id, code) VALUES
  ('00000000-0000-0000-0000-0000000000e4', '00000000-0000-0000-0000-0000000000e3', 'NAV-1');
UPDATE public.audit_findings SET resolved = true WHERE id = '00000000-0000-0000-0000-0000000000e4';
DO $$ BEGIN
  IF (SELECT count(*) FROM public.roadmap_items WHERE title = 'Lot renommé') <> 1 THEN RAISE EXCEPTION 'admin modifie la feuille de route'; END IF;
  IF NOT (SELECT resolved FROM public.audit_findings WHERE id = '00000000-0000-0000-0000-0000000000e4') THEN RAISE EXCEPTION 'admin corrige un constat'; END IF;
END $$;
SELECT pg_temp.as_user('00000000-0000-0000-0000-0000000000a2', 'membre@test.fr');
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM public.roadmap_items) OR EXISTS (SELECT 1 FROM public.masterplan_sections)
     OR EXISTS (SELECT 1 FROM public.audits) OR EXISTS (SELECT 1 FROM public.audit_findings)
  THEN RAISE EXCEPTION 'membre lit le pilotage'; END IF;
END $$;
SELECT pg_temp.expect_error($$INSERT INTO public.roadmap_items (title) VALUES ('Intrus')$$, 'membre écrit la feuille de route');
SELECT pg_temp.expect_error($$INSERT INTO public.masterplan_sections (title) VALUES ('Intrus')$$, 'membre écrit le plan directeur');
SELECT pg_temp.expect_error($$INSERT INTO public.audits (label) VALUES ('Intrus')$$, 'membre écrit un audit');
DELETE FROM public.roadmap_items;
DELETE FROM public.audits;
SELECT pg_temp.as_anon();
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM public.roadmap_items) OR EXISTS (SELECT 1 FROM public.masterplan_sections)
  THEN RAISE EXCEPTION 'visiteur lit le pilotage'; END IF;
END $$;
SELECT pg_temp.expect_error($$SELECT 1 FROM public.audits$$, 'visiteur lit les audits');
SELECT pg_temp.expect_error($$INSERT INTO public.roadmap_items (title) VALUES ('Intrus')$$, 'visiteur écrit la feuille de route');
RESET ROLE;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.roadmap_items WHERE id = '00000000-0000-0000-0000-0000000000e1')
     OR NOT EXISTS (SELECT 1 FROM public.audits WHERE id = '00000000-0000-0000-0000-0000000000e3') THEN
    RAISE EXCEPTION 'membre supprime le pilotage'; END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public'
             AND table_name = 'roadmap_items' AND column_name = 'public_visible') THEN
    RAISE EXCEPTION 'colonne public_visible restée'; END IF;
END $$;
SELECT pg_temp.as_user('00000000-0000-0000-0000-0000000000a1', 'admin@test.fr');
DELETE FROM public.roadmap_items WHERE id = '00000000-0000-0000-0000-0000000000e1';
DELETE FROM public.masterplan_sections WHERE id = '00000000-0000-0000-0000-0000000000e2';
DELETE FROM public.audits WHERE id = '00000000-0000-0000-0000-0000000000e3';
RESET ROLE;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM public.audit_findings WHERE id = '00000000-0000-0000-0000-0000000000e4') THEN RAISE EXCEPTION 'constats restés après suppression de l''audit'; END IF;
END $$;

-- 2. Annuaire vu du visiteur et entre membres -------------------------------------------------------
UPDATE public.site_settings SET value = value || '{"directory": true}' WHERE key = 'modules';
INSERT INTO public.directory_listings (id, name, slug, status, created_by) VALUES
  ('00000000-0000-0000-0000-0000000000f1', 'Publiée', 'publiee', 'published', '00000000-0000-0000-0000-0000000000a3'),
  ('00000000-0000-0000-0000-0000000000f2', 'Brouillon', 'brouillon', 'draft', '00000000-0000-0000-0000-0000000000a3');
INSERT INTO public.directory_reviews (id, listing_id, author_id, rating, content, approved) VALUES
  ('00000000-0000-0000-0000-0000000000f3', '00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000a3', 5, 'Validé', true),
  ('00000000-0000-0000-0000-0000000000f4', '00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000a3', 1, 'En attente', false);
SELECT pg_temp.as_anon();
DO $$ BEGIN
  IF (SELECT count(*) FROM public.directory_listings) <> 1 THEN RAISE EXCEPTION 'visiteur voit un brouillon'; END IF;
  IF (SELECT count(*) FROM public.directory_reviews) <> 1 THEN RAISE EXCEPTION 'visiteur voit un avis non validé'; END IF;
END $$;
SELECT pg_temp.expect_error($$INSERT INTO public.directory_listings (name, slug) VALUES ('Anonyme', 'anonyme')$$, 'visiteur crée une fiche');
SELECT pg_temp.expect_error($$INSERT INTO public.directory_reviews (listing_id, author_id, rating)
  VALUES ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000a3', 5)$$, 'visiteur dépose un avis');
SELECT pg_temp.as_user('00000000-0000-0000-0000-0000000000a2', 'membre@test.fr');
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM public.directory_listings WHERE id = '00000000-0000-0000-0000-0000000000f2') THEN
    RAISE EXCEPTION 'membre voit le brouillon d''un autre'; END IF;
END $$;
DELETE FROM public.directory_listings;
UPDATE public.directory_listings SET name = 'Piratée' WHERE id = '00000000-0000-0000-0000-0000000000f1';
-- Module allumé : le membre propose une fiche en brouillon et dépose un avis en attente.
INSERT INTO public.directory_listings (name, slug, created_by) VALUES ('Ma fiche', 'ma-fiche', '00000000-0000-0000-0000-0000000000a2');
INSERT INTO public.directory_reviews (listing_id, author_id, rating) VALUES
  ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000a2', 4);
RESET ROLE;
DO $$ BEGIN
  IF (SELECT count(*) FROM public.directory_listings WHERE id IN ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000f2')) <> 2
  THEN RAISE EXCEPTION 'membre supprime la fiche d''un autre'; END IF;
  IF (SELECT name FROM public.directory_listings WHERE id = '00000000-0000-0000-0000-0000000000f1') <> 'Publiée' THEN
    RAISE EXCEPTION 'membre modifie la fiche d''un autre'; END IF;
END $$;

-- 3. Annuaire éteint : plus de fiche, d'avis ni de demande de propriété ; l'admin garde la main -----
UPDATE public.site_settings SET value = value || '{"directory": false, "geo": false}' WHERE key = 'modules';
SELECT pg_temp.as_user('00000000-0000-0000-0000-0000000000a2', 'membre@test.fr');
SELECT pg_temp.expect_error($$INSERT INTO public.directory_listings (name, slug, created_by)
  VALUES ('Éteint', 'eteint', '00000000-0000-0000-0000-0000000000a2')$$, 'fiche créée module éteint');
SELECT pg_temp.expect_error($$INSERT INTO public.directory_reviews (listing_id, author_id, rating)
  VALUES ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000a2', 3)$$, 'avis déposé module éteint');
DO $$ BEGIN
  IF public.request_directory_claim('00000000-0000-0000-0000-0000000000f1') THEN
    RAISE EXCEPTION 'propriété demandée module éteint'; END IF;
END $$;
SELECT pg_temp.as_user('00000000-0000-0000-0000-0000000000a1', 'admin@test.fr');
INSERT INTO public.directory_listings (name, slug) VALUES ('Préparée', 'preparee');
RESET ROLE;
DO $$ BEGIN
  IF (SELECT claim_requested_by FROM public.directory_listings WHERE id = '00000000-0000-0000-0000-0000000000f1') IS NOT NULL THEN
    RAISE EXCEPTION 'demande de propriété enregistrée module éteint'; END IF;
END $$;

-- 4. Géographie : aucune écriture pour un visiteur, même sans sécurité par ligne -----------------------
DO $$ BEGIN
  IF has_table_privilege('anon', 'public.geo_places', 'DELETE') OR has_table_privilege('anon', 'public.geo_places', 'UPDATE')
     OR has_table_privilege('anon', 'public.geo_adjacency', 'INSERT') OR has_table_privilege('anon', 'public.geo_departements', 'DELETE')
  THEN RAISE EXCEPTION 'visiteur peut écrire la géographie'; END IF;
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.geo_places'::regclass) THEN
    RAISE EXCEPTION 'geo_places sans protection'; END IF;
END $$;

-- 5. Tables sans protection : réservé à l'admin, vide dans le socle, détecte une table oubliée ---------
SELECT pg_temp.as_user('00000000-0000-0000-0000-0000000000a1', 'admin@test.fr');
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM public.tables_sans_protection()) THEN
    RAISE EXCEPTION 'table sans protection dans le socle : %', (SELECT string_agg(t, ', ') FROM public.tables_sans_protection() t);
  END IF;
END $$;
RESET ROLE;
CREATE TABLE public.essai_oubliee (id int);
SELECT pg_temp.as_user('00000000-0000-0000-0000-0000000000a1', 'admin@test.fr');
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.tables_sans_protection() t WHERE t = 'essai_oubliee') THEN
    RAISE EXCEPTION 'table oubliée non détectée'; END IF;
END $$;
SELECT pg_temp.as_user('00000000-0000-0000-0000-0000000000a2', 'membre@test.fr');
SELECT pg_temp.expect_error($$SELECT public.tables_sans_protection()$$, 'membre lit les tables sans protection');
SELECT pg_temp.as_anon();
SELECT pg_temp.expect_error($$SELECT public.tables_sans_protection()$$, 'visiteur lit les tables sans protection');
RESET ROLE;

-- 6. Version et point de grille ------------------------------------------------------------------------
DO $$ BEGIN
  IF string_to_array((SELECT value ->> 'version' FROM public.site_settings WHERE key = 'socle'), '.')::int[]
     < string_to_array('1.4.1', '.')::int[] THEN RAISE EXCEPTION 'version 1.4.1'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.template_checks t WHERE code = 'SEC-RLS' AND t.en_perimetre) THEN
    RAISE EXCEPTION 'point SEC-RLS'; END IF;
END $$;

-- 7. Rejouable ------------------------------------------------------------------------------------------
\i supabase/migrations/20261005150000_v1_4_1_correctifs.sql
DO $$ BEGIN
  IF (SELECT count(*) FROM public.template_checks WHERE code = 'SEC-RLS') <> 1 THEN RAISE EXCEPTION 'doublon SEC-RLS'; END IF;
END $$;
ROLLBACK;
