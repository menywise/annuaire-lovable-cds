\set ON_ERROR_STOP 1
\i tests/db/_helpers.sql
BEGIN;
-- Lot 13 a : kit de démarrage d'un clone. État du démarrage et retrait des contenus de
-- démonstration, réservés à l'admin ; un contenu modifié par le projet n'est jamais retiré.
INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-0000000000a1', 'manuel.rohaut@gmail.com'),
  ('00000000-0000-0000-0000-0000000000a2', 'membre@test.fr');
SELECT pg_temp.as_user('00000000-0000-0000-0000-0000000000a1', 'manuel.rohaut@gmail.com');
SELECT public.bootstrap_current_user('Manu');
SELECT pg_temp.as_user('00000000-0000-0000-0000-0000000000a2', 'membre@test.fr');
SELECT public.bootstrap_current_user('Membre');
RESET ROLE;
\i supabase/seed/recette_seed.sql
RESET ROLE;

-- 1. Réservé à l'admin ----------------------------------------------------------------------------------
SELECT pg_temp.as_user('00000000-0000-0000-0000-0000000000a2', 'membre@test.fr');
SELECT pg_temp.expect_error($$SELECT public.starter_status()$$, 'membre lit l''état du démarrage');
SELECT pg_temp.expect_error($$SELECT public.starter_reset_demo('exemples')$$, 'membre vide la démonstration');
SELECT pg_temp.as_anon();
SELECT pg_temp.expect_error($$SELECT public.starter_reset_demo('demarrage')$$, 'visiteur vide la démonstration');

-- 2. État : exemples de la recette et contenus de démarrage comptés ------------------------------------
SELECT pg_temp.as_user('00000000-0000-0000-0000-0000000000a1', 'manuel.rohaut@gmail.com');
DO $$
DECLARE _s jsonb := public.starter_status();
BEGIN
  IF (_s ->> 'exemples')::int < 5 THEN RAISE EXCEPTION 'exemples comptés : %', _s; END IF;
  IF (_s ->> 'demarrage')::int <> 8 THEN RAISE EXCEPTION 'contenus de démarrage (4 FAQ, 3 offres, 1 article) : %', _s; END IF;
  IF (_s ->> 'administrateurs')::int < 1 THEN RAISE EXCEPTION 'administrateurs : %', _s; END IF;
END $$;
SELECT pg_temp.expect_error($$SELECT public.starter_reset_demo('tout')$$, 'lot inconnu');

-- 3. Retrait des exemples : contenus, membre fictif ; rien d'autre ------------------------------------
DO $$
DECLARE _r jsonb := public.starter_reset_demo('exemples');
BEGIN
  IF (_r ->> 'membres_fictifs')::int <> 1 OR (_r ->> 'discussions')::int <> 1 THEN RAISE EXCEPTION 'retrait : %', _r; END IF;
  IF (public.starter_status() ->> 'exemples')::int <> 0 THEN RAISE EXCEPTION 'exemples restants'; END IF;
  IF (public.starter_status() ->> 'demarrage')::int <> 8 THEN RAISE EXCEPTION 'le démarrage ne doit pas bouger'; END IF;
  IF (SELECT count(*) FROM public.profiles WHERE email = 'membre@test.fr') <> 1 THEN RAISE EXCEPTION 'vrai membre retiré'; END IF;
END $$;
RESET ROLE;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM auth.users WHERE id::text LIKE 'e7000000-%') THEN RAISE EXCEPTION 'membre fictif encore là'; END IF;
END $$;

-- 4. Retrait du démarrage : un contenu modifié par le projet reste --------------------------------------
UPDATE public.pricing_plans SET tagline = 'Notre offre d''entrée, adaptée à mon projet.' WHERE name = 'Découverte';
SELECT pg_temp.as_user('00000000-0000-0000-0000-0000000000a1', 'manuel.rohaut@gmail.com');
DO $$
DECLARE _r jsonb := public.starter_reset_demo('demarrage');
BEGIN
  IF (_r ->> 'faq')::int <> 4 OR (_r ->> 'offres')::int <> 2 OR (_r ->> 'articles')::int <> 1 THEN RAISE EXCEPTION 'retrait : %', _r; END IF;
  IF (public.starter_status() ->> 'demarrage')::int <> 0 THEN RAISE EXCEPTION 'contenus de démarrage restants'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.pricing_plans WHERE name = 'Découverte') THEN RAISE EXCEPTION 'offre modifiée retirée'; END IF;
  -- Rejouable : second passage sans effet.
  IF (public.starter_reset_demo('demarrage') ->> 'faq')::int <> 0 THEN RAISE EXCEPTION 'second passage'; END IF;
END $$;
ROLLBACK;
