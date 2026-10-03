\set ON_ERROR_STOP 1
\i tests/db/_helpers.sql
BEGIN;
-- Identité neutre : aucune adresse écrite dans le code. Sur une base sans administrateur, le premier
-- compte devient administrateur, une seule fois ; ensuite seul un administrateur en nomme un autre,
-- et le dernier administrateur ne peut pas être retiré.

-- 0. Base neuve : aucun administrateur, verrou ouvert, liste des adresses nommées d'avance vide.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin') THEN RAISE EXCEPTION 'administrateur présent sur une base neuve'; END IF;
  IF EXISTS (SELECT 1 FROM public.premier_administrateur) THEN RAISE EXCEPTION 'verrou fermé sur une base neuve'; END IF;
  IF EXISTS (SELECT 1 FROM public.studio_admins) THEN RAISE EXCEPTION 'adresses installées par une migration'; END IF;
END $$;

INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-0000000000b1', 'premier@test.fr'),
  ('00000000-0000-0000-0000-0000000000b2', 'second@test.fr'),
  ('00000000-0000-0000-0000-0000000000b3', 'troisieme@test.fr'),
  ('00000000-0000-0000-0000-0000000000b4', 'nomme@test.fr');

-- 1. Le premier inscrit devient administrateur ; le verrou se ferme sur lui.
SELECT pg_temp.as_user('00000000-0000-0000-0000-0000000000b1', 'premier@test.fr');
DO $$ BEGIN
  IF public.bootstrap_current_user('Premier') <> 'admin' THEN RAISE EXCEPTION 'premier inscrit non promu'; END IF;
END $$;
RESET ROLE;
DO $$ BEGIN
  IF (SELECT user_id FROM public.premier_administrateur) <> '00000000-0000-0000-0000-0000000000b1' THEN RAISE EXCEPTION 'verrou non fermé sur le premier inscrit'; END IF;
END $$;

-- 2. Le second inscrit n'est pas promu, ni à l'inscription ni aux connexions suivantes.
SELECT pg_temp.as_user('00000000-0000-0000-0000-0000000000b2', 'second@test.fr');
DO $$ BEGIN
  IF public.bootstrap_current_user('Second') <> 'user' THEN RAISE EXCEPTION 'second inscrit promu'; END IF;
  IF public.bootstrap_current_user() <> 'user' THEN RAISE EXCEPTION 'second inscrit promu à la reconnexion'; END IF;
END $$;
-- Le verrou n'est ni lisible ni modifiable par un compte.
SELECT pg_temp.expect_error($$SELECT * FROM public.premier_administrateur$$, 'membre lit le verrou');
SELECT pg_temp.expect_error($$DELETE FROM public.premier_administrateur$$, 'membre rouvre le verrou');
SELECT pg_temp.as_anon();
SELECT pg_temp.expect_error($$SELECT * FROM public.premier_administrateur$$, 'visiteur lit le verrou');
RESET ROLE;

-- 3. Le dernier administrateur ne peut pas se retirer, par aucun chemin.
SELECT pg_temp.as_user('00000000-0000-0000-0000-0000000000b1', 'premier@test.fr');
SELECT pg_temp.expect_error($$SELECT public.admin_set_admin('00000000-0000-0000-0000-0000000000b1', false)$$, 'dernier admin se rétrograde');
SELECT pg_temp.expect_error($$SELECT public.delete_my_account()$$, 'dernier admin supprime son compte');
RESET ROLE;
SELECT pg_temp.expect_error($$DELETE FROM auth.users WHERE id = '00000000-0000-0000-0000-0000000000b1'$$, 'compte du dernier admin supprimé depuis la base');
SELECT pg_temp.expect_error($$DELETE FROM public.user_roles WHERE role = 'admin'$$, 'rôles admin vidés');

-- 4. Un administrateur en nomme un autre depuis l'administration ; le premier peut alors partir.
SELECT pg_temp.as_user('00000000-0000-0000-0000-0000000000b1', 'premier@test.fr');
SELECT public.admin_set_admin('00000000-0000-0000-0000-0000000000b2', true);
SELECT public.delete_my_account();
RESET ROLE;
DO $$ BEGIN
  IF NOT public.has_role('00000000-0000-0000-0000-0000000000b2', 'admin') THEN RAISE EXCEPTION 'nomination ratée'; END IF;
  IF EXISTS (SELECT 1 FROM auth.users WHERE id = '00000000-0000-0000-0000-0000000000b1') THEN RAISE EXCEPTION 'départ du premier admin refusé'; END IF;
END $$;
-- Le nouvel administrateur est à son tour le dernier : il ne peut pas partir.
SELECT pg_temp.as_user('00000000-0000-0000-0000-0000000000b2', 'second@test.fr');
SELECT pg_temp.expect_error($$SELECT public.delete_my_account()$$, 'nouveau dernier admin supprime son compte');
RESET ROLE;

-- 5. Verrou fermé : même sans aucun administrateur (cas forcé par la base), personne n'est promu.
ALTER TABLE public.user_roles DISABLE TRIGGER user_roles_garder_un_administrateur;
DELETE FROM public.user_roles WHERE role = 'admin';
ALTER TABLE public.user_roles ENABLE TRIGGER user_roles_garder_un_administrateur;
SELECT pg_temp.as_user('00000000-0000-0000-0000-0000000000b3', 'troisieme@test.fr');
DO $$ BEGIN
  IF public.bootstrap_current_user('Troisième') <> 'user' THEN RAISE EXCEPTION 'promotion après fermeture du verrou'; END IF;
END $$;
RESET ROLE;

-- 6. Une adresse nommée d'avance en admin reste administratrice à la connexion.
INSERT INTO public.studio_admins (email) VALUES ('nomme@test.fr');
SELECT pg_temp.as_user('00000000-0000-0000-0000-0000000000b4', 'nomme@test.fr');
DO $$ BEGIN
  IF public.bootstrap_current_user('Nommé') <> 'admin' THEN RAISE EXCEPTION 'adresse nommée d''avance non promue'; END IF;
END $$;
RESET ROLE;
ROLLBACK;

-- 7. Deux inscriptions qui se suivent sur une base vide : un seul administrateur.
BEGIN;
INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-0000000000c1', 'un@test.fr'),
  ('00000000-0000-0000-0000-0000000000c2', 'deux@test.fr');
SELECT pg_temp.as_user('00000000-0000-0000-0000-0000000000c1', 'un@test.fr');
SELECT public.bootstrap_current_user('Un');
SELECT pg_temp.as_user('00000000-0000-0000-0000-0000000000c2', 'deux@test.fr');
SELECT public.bootstrap_current_user('Deux');
RESET ROLE;
DO $$ BEGIN
  IF (SELECT count(*) FROM public.user_roles WHERE role = 'admin') <> 1 THEN RAISE EXCEPTION 'plusieurs administrateurs promus'; END IF;
END $$;
ROLLBACK;
