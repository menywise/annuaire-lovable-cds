\set ON_ERROR_STOP 1
\i tests/db/_helpers.sql
BEGIN;
-- a1 : admin du studio · a2 : membre
INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-0000000000a1', 'admin@test.fr'),
  ('00000000-0000-0000-0000-0000000000a2', 'membre@test.fr');
SELECT pg_temp.as_user('00000000-0000-0000-0000-0000000000a1', 'admin@test.fr');
SELECT public.bootstrap_current_user('Administrateur');
SELECT pg_temp.as_user('00000000-0000-0000-0000-0000000000a2', 'membre@test.fr');
SELECT public.bootstrap_current_user('Membre');
RESET ROLE;

-- 1. Module « pages » : déclaré, éteint par défaut (l'accueil de démonstration reste en place) --
DO $$ BEGIN
  IF NOT public.module_defaults() ? 'pages' THEN RAISE EXCEPTION 'module pages absent'; END IF;
  IF public.module_enabled('pages') THEN RAISE EXCEPTION 'pages devrait être éteint par défaut'; END IF;
END $$;

-- 2. Écriture : admin seulement -----------------------------------------------------------------
SELECT pg_temp.as_user('00000000-0000-0000-0000-0000000000a2', 'membre@test.fr');
SELECT pg_temp.expect_error($$INSERT INTO public.pages (slug, title) VALUES ('pirate', 'Pirate')$$, 'membre crée une page');
SELECT pg_temp.as_anon();
SELECT pg_temp.expect_error($$INSERT INTO public.pages (slug, title) VALUES ('pirate', 'Pirate')$$, 'visiteur crée une page');
SELECT pg_temp.as_user('00000000-0000-0000-0000-0000000000a1', 'admin@test.fr');
INSERT INTO public.pages (id, slug, title, is_home, data) VALUES
  ('00000000-0000-0000-0000-0000000000e1', 'accueil', 'Accueil', true,
   '{"root":{"props":{}},"content":[{"type":"Hero","props":{"id":"Hero-1","title":"Bienvenue"}}]}');
INSERT INTO public.pages (id, slug, title) VALUES ('00000000-0000-0000-0000-0000000000e2', 'a-propos-du-studio', 'À propos');
-- Contrôles : adresse, contenu au format Puck, un seul accueil.
SELECT pg_temp.expect_error($$INSERT INTO public.pages (slug, title) VALUES ('Mauvaise Adresse', 'X')$$, 'adresse invalide');
SELECT pg_temp.expect_error($$INSERT INTO public.pages (slug, title, data) VALUES ('x1', 'X', '{"content":{}}')$$, 'contenu non tableau');
SELECT pg_temp.expect_error($$INSERT INTO public.pages (slug, title, data) VALUES ('x2', 'X', '{"root":{"props":{}},"content":[{"props":{}}]}')$$, 'section sans type');
SELECT pg_temp.expect_error($$INSERT INTO public.pages (slug, title, data) VALUES ('x3', 'X', '{"root":{"props":{}},"content":[{"type":"Hero","props":[]}]}')$$, 'réglages non objet');
SELECT pg_temp.expect_error($$INSERT INTO public.pages (slug, title, is_home) VALUES ('x4', 'X', true)$$, 'deux accueils');
SELECT pg_temp.expect_error($$INSERT INTO public.pages (slug, title) VALUES ('x5', '')$$, 'titre vide');
-- Publication datée par la base.
UPDATE public.pages SET published = true WHERE id = '00000000-0000-0000-0000-0000000000e1';
DO $$ BEGIN
  IF (SELECT published_at FROM public.pages WHERE id = '00000000-0000-0000-0000-0000000000e1') IS NULL
  THEN RAISE EXCEPTION 'date de publication absente'; END IF;
  IF (SELECT updated_by FROM public.pages WHERE id = '00000000-0000-0000-0000-0000000000e1') <> '00000000-0000-0000-0000-0000000000a1'
  THEN RAISE EXCEPTION 'auteur de la modification absent'; END IF;
END $$;
-- Le membre ne modifie ni ne supprime.
SELECT pg_temp.as_user('00000000-0000-0000-0000-0000000000a2', 'membre@test.fr');
UPDATE public.pages SET title = 'Piraté' WHERE id = '00000000-0000-0000-0000-0000000000e1';
DELETE FROM public.pages WHERE id = '00000000-0000-0000-0000-0000000000e1';
RESET ROLE;
DO $$ BEGIN
  IF (SELECT title FROM public.pages WHERE id = '00000000-0000-0000-0000-0000000000e1') <> 'Accueil'
  THEN RAISE EXCEPTION 'page modifiée par un membre'; END IF;
END $$;

-- 3. Lecture : module éteint = aucune page visible, même publiée ------------------------------
SELECT pg_temp.as_anon();
DO $$ BEGIN
  IF (SELECT count(*) FROM public.pages) <> 0 THEN RAISE EXCEPTION 'page visible module éteint'; END IF;
END $$;
RESET ROLE;
UPDATE public.site_settings SET value = value || '{"pages": true}'::jsonb WHERE key = 'modules';
-- Module allumé : le visiteur et le membre voient la page publiée, pas le brouillon.
SELECT pg_temp.as_anon();
DO $$ BEGIN
  IF (SELECT count(*) FROM public.pages) <> 1 THEN RAISE EXCEPTION 'visiteur : 1 page publiée attendue'; END IF;
END $$;
SELECT pg_temp.as_user('00000000-0000-0000-0000-0000000000a2', 'membre@test.fr');
DO $$ BEGIN
  IF (SELECT count(*) FROM public.pages) <> 1 THEN RAISE EXCEPTION 'membre : 1 page publiée attendue'; END IF;
END $$;
-- L'admin voit tout, même les brouillons.
SELECT pg_temp.as_user('00000000-0000-0000-0000-0000000000a1', 'admin@test.fr');
DO $$ BEGIN
  IF (SELECT count(*) FROM public.pages) <> 2 THEN RAISE EXCEPTION 'admin : 2 pages attendues'; END IF;
END $$;
DELETE FROM public.pages WHERE id = '00000000-0000-0000-0000-0000000000e2';
RESET ROLE;
ROLLBACK;
