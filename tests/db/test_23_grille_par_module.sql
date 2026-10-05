\set ON_ERROR_STOP 1
\i tests/db/_helpers.sql
BEGIN;
-- Socle 1.4.0 : grille de conformité par module. Un point dont tous les modules sont éteints sort du
-- périmètre ; un point sans module vaut pour tout site ; chaque module a son point « fini ».
SELECT set_config('request.jwt.claims', '{}', true);

-- 1. Rattachement ----------------------------------------------------------------------------------
DO $$ BEGIN
  IF (SELECT count(*) FROM public.template_checks WHERE code LIKE 'MOD-%') <> 25 THEN
    RAISE EXCEPTION 'un point « fini » par module'; END IF;
  IF EXISTS (SELECT 1 FROM public.template_checks WHERE code LIKE 'MOD-%'
             AND modules <> ARRAY[substr(code, 5)]) THEN RAISE EXCEPTION 'module du point fini'; END IF;
  IF (SELECT modules FROM public.template_checks WHERE code = 'CNT-1') <> ARRAY['blog'] THEN
    RAISE EXCEPTION 'blog rattaché'; END IF;
  IF (SELECT cardinality(modules) FROM public.template_checks WHERE code = 'NAV-1') <> 0 THEN
    RAISE EXCEPTION 'point de tout site'; END IF;
END $$;

-- 2. Périmètre suit les modules allumés ------------------------------------------------------------
UPDATE public.site_settings SET value = public.module_defaults() WHERE key = 'modules';
DO $$ BEGIN
  IF (SELECT t.en_perimetre FROM public.template_checks t WHERE code = 'CNT-1') THEN
    RAISE EXCEPTION 'blog éteint compté'; END IF;
  IF NOT (SELECT t.en_perimetre FROM public.template_checks t WHERE code = 'NAV-1') THEN
    RAISE EXCEPTION 'point de tout site hors périmètre'; END IF;
  IF NOT (SELECT t.en_perimetre FROM public.template_checks t WHERE code = 'MOD-search') THEN
    RAISE EXCEPTION 'outil toujours allumé hors périmètre'; END IF;
END $$;
UPDATE public.site_settings SET value = value || '{"blog": true}' WHERE key = 'modules';
DO $$ BEGIN
  IF NOT (SELECT t.en_perimetre FROM public.template_checks t WHERE code = 'CNT-1') THEN
    RAISE EXCEPTION 'blog allumé non compté'; END IF;
END $$;

-- 3. Point de greffe : compté quand son module de projet est allumé ---------------------------------
INSERT INTO public.template_checks (code, area, label, modules) VALUES ('GREFFE-ESSAI', 'Greffe', 'Essai', ARRAY['greffe_essai']);
DO $$ BEGIN
  IF (SELECT t.en_perimetre FROM public.template_checks t WHERE code = 'GREFFE-ESSAI') THEN
    RAISE EXCEPTION 'greffe éteinte comptée'; END IF;
END $$;
UPDATE public.site_settings SET value = value || '{"greffe_essai": true}' WHERE key = 'modules';
DO $$ BEGIN
  IF NOT (SELECT t.en_perimetre FROM public.template_checks t WHERE code = 'GREFFE-ESSAI') THEN
    RAISE EXCEPTION 'greffe allumée non comptée'; END IF;
END $$;

-- 4. Grille réservée aux administrateurs, périmètre lu par l'admin ---------------------------------
INSERT INTO auth.users (id, email) VALUES ('00000000-0000-0000-0000-0000000000a1', 'admin@test.fr');
SELECT pg_temp.as_user('00000000-0000-0000-0000-0000000000a1', 'admin@test.fr');
SELECT public.bootstrap_current_user('Administrateur');
DO $$ BEGIN
  IF (SELECT count(*) FROM public.template_checks t WHERE t.en_perimetre) = 0 THEN
    RAISE EXCEPTION 'admin ne lit pas le périmètre'; END IF;
END $$;
SELECT pg_temp.as_anon();
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM public.template_checks) THEN RAISE EXCEPTION 'visiteur lit la grille'; END IF;
END $$;
RESET ROLE;
SELECT set_config('request.jwt.claims', '{}', true);

-- 5. Rejouable sans doublon ni perte -----------------------------------------------------------------
UPDATE public.template_checks SET status = 'conforme' WHERE code = 'MOD-blog';
\i supabase/migrations/20261005120000_v1_4_0_grille_par_module.sql
DO $$ BEGIN
  IF (SELECT count(*) FROM public.template_checks WHERE code LIKE 'MOD-%') <> 25 THEN RAISE EXCEPTION 'doublon'; END IF;
  IF (SELECT status FROM public.template_checks WHERE code = 'MOD-blog') <> 'conforme' THEN
    RAISE EXCEPTION 'état effacé'; END IF;
END $$;
ROLLBACK;
