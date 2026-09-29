\set ON_ERROR_STOP 1
\i tests/db/_helpers.sql
BEGIN;
-- a1 : admin du studio · a2 : membre
INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-0000000000a1', 'manuel.rohaut@gmail.com'),
  ('00000000-0000-0000-0000-0000000000a2', 'membre@test.fr');
SELECT pg_temp.as_user('00000000-0000-0000-0000-0000000000a1', 'manuel.rohaut@gmail.com');
SELECT public.bootstrap_current_user('Manu');
SELECT pg_temp.as_user('00000000-0000-0000-0000-0000000000a2', 'membre@test.fr');
SELECT public.bootstrap_current_user('Membre');
RESET ROLE;

-- 1. Module « media » : déclaré, allumé par défaut, lisible par la base -------------------
DO $$ BEGIN
  IF NOT public.module_defaults() ? 'media' THEN RAISE EXCEPTION 'module media absent des valeurs par défaut'; END IF;
  IF NOT (SELECT value ? 'media' FROM public.site_settings WHERE key = 'modules') THEN RAISE EXCEPTION 'module media absent de site_settings'; END IF;
  IF NOT public.module_enabled('media') THEN RAISE EXCEPTION 'media devrait être allumé'; END IF;
  IF public.module_enabled('inconnu') THEN RAISE EXCEPTION 'clé inconnue vue allumée'; END IF;
END $$;

-- 2. Espace de stockage : public en lecture, 10 Mo, pas de SVG (peut contenir du script) --
DO $$ DECLARE _b storage.buckets; BEGIN
  SELECT * INTO _b FROM storage.buckets WHERE id = 'media';
  IF _b.id IS NULL THEN RAISE EXCEPTION 'espace media absent'; END IF;
  IF NOT _b.public THEN RAISE EXCEPTION 'espace media non public'; END IF;
  IF _b.file_size_limit IS DISTINCT FROM 10485760 THEN RAISE EXCEPTION 'taille maximale inattendue'; END IF;
  IF 'image/svg+xml' = ANY (_b.allowed_mime_types) THEN RAISE EXCEPTION 'SVG accepté'; END IF;
  IF NOT 'image/webp' = ANY (_b.allowed_mime_types) THEN RAISE EXCEPTION 'WebP refusé'; END IF;
END $$;

-- 3. Dépôt : visiteur et membre refusés, admin accepté -----------------------------------
SELECT pg_temp.as_anon();
SELECT pg_temp.expect_error($$INSERT INTO storage.objects (bucket_id, name) VALUES ('media', '2026/09/visiteur.png')$$, 'visiteur dépose');
SELECT pg_temp.as_user('00000000-0000-0000-0000-0000000000a2', 'membre@test.fr');
SELECT pg_temp.expect_error($$INSERT INTO storage.objects (bucket_id, name) VALUES ('media', '2026/09/membre.png')$$, 'membre dépose');
SELECT pg_temp.expect_error($$INSERT INTO public.media_files (path, name, mime_type) VALUES ('2026/09/membre.png', 'x', 'image/png')$$, 'membre inscrit un fichier');
DO $$ BEGIN
  IF (SELECT count(*) FROM storage.objects) <> 0 THEN RAISE EXCEPTION 'membre liste les fichiers'; END IF;
END $$;
SELECT pg_temp.as_user('00000000-0000-0000-0000-0000000000a1', 'manuel.rohaut@gmail.com');
INSERT INTO storage.objects (bucket_id, name) VALUES ('media', '2026/09/logo.png');
INSERT INTO public.media_files (path, name, mime_type, size_bytes) VALUES ('2026/09/logo.png', 'logo.png', 'image/png', 1200);
UPDATE public.media_files SET alt = 'Logo du studio' WHERE path = '2026/09/logo.png';
-- Un autre espace de stockage n'est pas concerné par ces règles.
SELECT pg_temp.expect_error($$INSERT INTO storage.objects (bucket_id, name) VALUES ('autre', 'x.png')$$, 'admin dépose hors médiathèque');
-- Chemin et type contrôlés.
SELECT pg_temp.expect_error($$INSERT INTO public.media_files (path, name, mime_type) VALUES ('../secret.png', 'x', 'image/png')$$, 'chemin invalide');
SELECT pg_temp.expect_error($$INSERT INTO public.media_files (path, name, mime_type) VALUES ('2026/09/x.svg', 'x', 'image/svg+xml')$$, 'SVG inscrit');

-- 4. Lecture : le visiteur et le membre ne listent ni les fichiers ni la médiathèque -------
SELECT pg_temp.as_anon();
DO $$ BEGIN
  IF (SELECT count(*) FROM storage.objects) <> 0 THEN RAISE EXCEPTION 'visiteur liste les fichiers'; END IF;
END $$;
SELECT pg_temp.expect_error($$SELECT 1 FROM public.media_files$$, 'visiteur lit la médiathèque');
SELECT pg_temp.as_user('00000000-0000-0000-0000-0000000000a2', 'membre@test.fr');
DO $$ BEGIN
  IF (SELECT count(*) FROM public.media_files) <> 0 THEN RAISE EXCEPTION 'membre liste la médiathèque'; END IF;
END $$;
DELETE FROM storage.objects WHERE name = '2026/09/logo.png';
DELETE FROM public.media_files WHERE path = '2026/09/logo.png';
RESET ROLE;
DO $$ BEGIN
  IF (SELECT count(*) FROM storage.objects WHERE name = '2026/09/logo.png') <> 1 THEN RAISE EXCEPTION 'fichier supprimé par un membre'; END IF;
  IF (SELECT count(*) FROM public.media_files) <> 1 THEN RAISE EXCEPTION 'fiche supprimée par un membre'; END IF;
END $$;

-- 5. Module éteint : plus aucun dépôt, même pour l'admin ; les fichiers restent lisibles --
UPDATE public.site_settings SET value = value || '{"media": false}'::jsonb WHERE key = 'modules';
SELECT pg_temp.as_user('00000000-0000-0000-0000-0000000000a1', 'manuel.rohaut@gmail.com');
SELECT pg_temp.expect_error($$INSERT INTO storage.objects (bucket_id, name) VALUES ('media', '2026/09/eteint.png')$$, 'dépôt module éteint');
SELECT pg_temp.expect_error($$INSERT INTO public.media_files (path, name, mime_type) VALUES ('2026/09/eteint.png', 'x', 'image/png')$$, 'inscription module éteint');
-- L'admin peut toujours faire le ménage.
DELETE FROM storage.objects WHERE name = '2026/09/logo.png';
DELETE FROM public.media_files WHERE path = '2026/09/logo.png';
RESET ROLE;
DO $$ BEGIN
  IF (SELECT count(*) FROM public.media_files) <> 0 THEN RAISE EXCEPTION 'suppression admin refusée'; END IF;
END $$;
ROLLBACK;
