\set ON_ERROR_STOP 1
\i tests/db/_helpers.sql
BEGIN;
-- Socle 1.2.0 : modules facultatifs éteints par défaut ; pilotage, médiathèque et recherche sont des
-- outils d'administration toujours allumés ; la base date le choix des modules fait par un admin.
INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-0000000000a1', 'admin@test.fr'),
  ('00000000-0000-0000-0000-0000000000a2', 'membre@test.fr');
SELECT pg_temp.as_user('00000000-0000-0000-0000-0000000000a1', 'admin@test.fr');
SELECT public.bootstrap_current_user('Administrateur');
SELECT pg_temp.as_user('00000000-0000-0000-0000-0000000000a2', 'membre@test.fr');
SELECT public.bootstrap_current_user('Membre');
RESET ROLE;

-- 1. Valeurs par défaut : 22 modules éteints, 3 outils allumés ------------------------------------
DO $$ BEGIN
  IF (SELECT count(*) FROM jsonb_each_text(public.module_defaults()) WHERE value = 'false') <> 22 THEN
    RAISE EXCEPTION 'modules éteints par défaut'; END IF;
  IF (SELECT string_agg(key, ',' ORDER BY key) FROM jsonb_each_text(public.module_defaults()) WHERE value = 'true')
     <> 'media,search,studio' THEN RAISE EXCEPTION 'outils allumés par défaut'; END IF;
  -- Base sans choix d'un admin : le réglage suit les nouvelles valeurs par défaut.
  IF (SELECT value FROM public.site_settings WHERE key = 'modules') <> public.module_defaults() THEN
    RAISE EXCEPTION 'réglage non remis à tout éteint'; END IF;
END $$;

-- 2. Outils toujours allumés, même sans réglage ; impossibles à éteindre --------------------------
SELECT set_config('request.jwt.claims', '{}', true);  -- sans session, comme une migration
DELETE FROM public.site_settings WHERE key = 'modules';
DO $$ BEGIN
  IF NOT (public.module_enabled('studio') AND public.module_enabled('media') AND public.module_enabled('search')) THEN
    RAISE EXCEPTION 'outil éteint sans réglage'; END IF;
  IF public.module_enabled('blog') OR public.module_enabled('inconnu') THEN RAISE EXCEPTION 'module allumé sans réglage'; END IF;
END $$;
INSERT INTO public.site_settings (key, value) VALUES ('modules', public.module_defaults());
SELECT pg_temp.as_user('00000000-0000-0000-0000-0000000000a1', 'admin@test.fr');
SELECT pg_temp.expect_error($$UPDATE public.site_settings SET value = value || '{"studio": false}' WHERE key = 'modules'$$, 'pilotage éteint');
SELECT pg_temp.expect_error($$UPDATE public.site_settings SET value = value || '{"media": false}' WHERE key = 'modules'$$, 'médiathèque éteinte');
SELECT pg_temp.expect_error($$UPDATE public.site_settings SET value = value || '{"search": false}' WHERE key = 'modules'$$, 'recherche éteinte');
RESET ROLE;

-- 3. Choix des modules : daté seulement quand un admin enregistre ----------------------------------
SELECT pg_temp.as_user('00000000-0000-0000-0000-0000000000a1', 'admin@test.fr');
DO $$ BEGIN
  IF (public.starter_status() ->> 'modules_choisis')::boolean THEN RAISE EXCEPTION 'choix daté sans enregistrement'; END IF;
END $$;
SELECT pg_temp.as_user('00000000-0000-0000-0000-0000000000a2', 'membre@test.fr');
UPDATE public.site_settings SET value = value || '{"forum": true}' WHERE key = 'modules';
RESET ROLE;
SELECT set_config('request.jwt.claims', '{}', true);  -- sans session, comme une migration
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM public.site_settings WHERE key = 'demarrage') THEN RAISE EXCEPTION 'choix daté par un membre'; END IF;
END $$;
SELECT pg_temp.as_user('00000000-0000-0000-0000-0000000000a1', 'admin@test.fr');
UPDATE public.site_settings SET value = value || '{"forum": true}', updated_by = auth.uid() WHERE key = 'modules';
DO $$ BEGIN
  IF NOT (public.starter_status() ->> 'modules_choisis')::boolean THEN RAISE EXCEPTION 'choix non daté'; END IF;
END $$;
RESET ROLE;

-- 4. Rejouable : un choix fait n'est jamais remis à zéro ------------------------------------------
SELECT set_config('request.jwt.claims', '{}', true);  -- sans session, comme une migration
\i supabase/migrations/20261003150000_v1_2_0_modules_facultatifs.sql
DO $$ BEGIN
  IF (SELECT (value ->> 'forum')::boolean FROM public.site_settings WHERE key = 'modules') IS NOT TRUE THEN
    RAISE EXCEPTION 'choix effacé par la migration'; END IF;
END $$;

-- 5. Base existante : réglage enregistré par un admin avant la 1.2.0 = choix fait -------------------
DELETE FROM public.site_settings WHERE key = 'demarrage';
SELECT set_config('request.jwt.claims', '{}', true);  -- sans session, comme une migration
\i supabase/migrations/20261003150000_v1_2_0_modules_facultatifs.sql
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.site_settings WHERE key = 'demarrage') THEN RAISE EXCEPTION 'choix ancien non reconnu'; END IF;
  IF (SELECT (value ->> 'forum')::boolean FROM public.site_settings WHERE key = 'modules') IS NOT TRUE THEN
    RAISE EXCEPTION 'choix ancien effacé'; END IF;
END $$;
ROLLBACK;
