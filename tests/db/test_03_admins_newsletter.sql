\set ON_ERROR_STOP 1
\i tests/db/_helpers.sql
BEGIN;
INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-0000000000a1', 'admin@test.fr'),
  ('00000000-0000-0000-0000-0000000000a2', 'client@test.fr');
INSERT INTO public.newsletter_subscribers (id, email) VALUES ('00000000-0000-0000-0000-0000000000d1', 'abonne@test.fr');

-- Premier compte d'une base sans administrateur : il devient administrateur.
SELECT pg_temp.as_user('00000000-0000-0000-0000-0000000000a1', 'admin@test.fr');
DO $$ BEGIN
  IF public.bootstrap_current_user() <> 'admin' THEN RAISE EXCEPTION 'premier compte non promu'; END IF;
END $$;
RESET ROLE;

-- Un client inscrit ensuite reste simple membre et ne gère pas les abonnés.
SELECT pg_temp.as_user('00000000-0000-0000-0000-0000000000a2', 'client@test.fr');
DO $$ BEGIN
  IF public.bootstrap_current_user('Client') <> 'user' THEN RAISE EXCEPTION 'client promu admin'; END IF;
END $$;
UPDATE public.newsletter_subscribers SET unsubscribed_at = now();
DO $$ BEGIN
  IF (SELECT count(*) FROM public.studio_admins) <> 0 THEN RAISE EXCEPTION 'client lit studio_admins'; END IF;
END $$;
RESET ROLE;
DO $$ BEGIN
  IF (SELECT unsubscribed_at FROM public.newsletter_subscribers) IS NOT NULL THEN RAISE EXCEPTION 'client a désinscrit un abonné'; END IF;
  IF (SELECT full_name FROM public.profiles WHERE id = '00000000-0000-0000-0000-0000000000a2') <> 'Client' THEN RAISE EXCEPTION 'nom non enregistré'; END IF;
END $$;

-- L'administrateur le reste à la connexion suivante et gère les abonnés.
SELECT pg_temp.as_user('00000000-0000-0000-0000-0000000000a1', 'admin@test.fr');
DO $$ BEGIN
  IF public.bootstrap_current_user() <> 'admin' THEN RAISE EXCEPTION 'administrateur perdu'; END IF;
END $$;
UPDATE public.newsletter_subscribers SET unsubscribed_at = now();
DELETE FROM public.newsletter_subscribers;
RESET ROLE;
DO $$ BEGIN
  IF (SELECT count(*) FROM public.newsletter_subscribers) <> 0 THEN RAISE EXCEPTION 'admin n''a pas supprimé'; END IF;
END $$;
ROLLBACK;
