\set ON_ERROR_STOP 1
\i tests/db/_helpers.sql
BEGIN;
-- Socle 1.5.0 : géographie alimentée par le référentiel du Studio (GeoAnnonces) et verrouillée.
-- Lecture directe fermée aux visiteurs et aux membres ; pages servies par fonctions à l'unité,
-- limitées au pays demandé ; import réservé à l'administrateur, sans doublon, attributs fusionnés.
INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-0000000025a1', 'admin25@test.fr'),
  ('00000000-0000-0000-0000-0000000025a2', 'membre25@test.fr');
SELECT pg_temp.as_user('00000000-0000-0000-0000-0000000025a1', 'admin25@test.fr');
SELECT public.bootstrap_current_user('Administrateur');
SELECT pg_temp.as_user('00000000-0000-0000-0000-0000000025a2', 'membre25@test.fr');
SELECT public.bootstrap_current_user('Membre');
RESET ROLE;
DO $$ BEGIN
  IF NOT public.has_role('00000000-0000-0000-0000-0000000025a1', 'admin') THEN
    -- Base de test déjà dotée d'un administrateur : nommer celui-ci.
    INSERT INTO public.user_roles (user_id, role) VALUES ('00000000-0000-0000-0000-0000000025a1', 'admin');
  END IF;
END $$;

-- Une France et une Espagne qui partagent des codes de subdivision (01).
INSERT INTO public.geo_places (country_code, kind, code, name, slug, parent_code) VALUES
  ('FR', 'region', '84', 'Auvergne-Rhône-Alpes', 'auvergne-rhone-alpes', 'FR'),
  ('ES', 'region', 'ES-PV', 'País Vasco', 'pais-vasco', 'ES');
INSERT INTO public.geo_places (country_code, kind, code, name, slug, parent_code) VALUES
  ('FR', 'departement', '01', 'Ain', 'ain', '84'),
  ('ES', 'departement', '01', 'Araba/Álava', 'araba-alava', 'ES-PV'),
  ('ES', 'departement', '20', 'Gipuzkoa', 'gipuzkoa', 'ES-PV');
INSERT INTO public.geo_places (country_code, kind, code, name, slug, parent_code, postal_codes, population, attributes) VALUES
  ('FR', 'commune', '01053', 'Bourg-en-Bresse', 'bourg-en-bresse', '01', ARRAY['01000'], 41000, '{"voisins": 3}'),
  ('ES', 'commune', '01059', 'Vitoria-Gasteiz', 'vitoria-gasteiz', '01', '{}', 257000, '{}');

-- 1. Visiteur : plus de lecture directe ; lecture à l'unité, limitée au pays demandé ---------
SELECT pg_temp.as_anon();
SELECT pg_temp.expect_error($$SELECT count(*) FROM public.geo_places$$, 'visiteur lit le référentiel');
DO $$ BEGIN
  IF (SELECT name FROM public.geo_lieu('commune', '01053')) <> 'Bourg-en-Bresse' THEN RAISE EXCEPTION 'lieu français'; END IF;
  IF EXISTS (SELECT 1 FROM public.geo_lieu('commune', '01059')) THEN RAISE EXCEPTION 'commune espagnole servie comme française'; END IF;
  IF (SELECT name FROM public.geo_lieu('commune', '01059', 'ES')) <> 'Vitoria-Gasteiz' THEN RAISE EXCEPTION 'lieu espagnol'; END IF;
  IF (SELECT count(*) FROM public.geo_communes_principales('01')) <> 1
     OR (SELECT code FROM public.geo_communes_principales('01')) <> '01053' THEN
    RAISE EXCEPTION 'communes du département 01 : la France seule';
  END IF;
  IF (SELECT count(*) FROM public.geo_communes_principales('01', 5000, 'es')) <> 1 THEN RAISE EXCEPTION 'pays en minuscules'; END IF;
END $$;
SELECT pg_temp.expect_error($$SELECT public.geo_importer('[]'::jsonb)$$, 'visiteur importe');

-- 2. Membre : ne voit rien du référentiel, n'importe pas ------------------------------------
SELECT pg_temp.as_user('00000000-0000-0000-0000-0000000025a2', 'membre25@test.fr');
DO $$ BEGIN
  IF (SELECT count(*) FROM public.geo_places) <> 0 THEN RAISE EXCEPTION 'membre lit le référentiel'; END IF;
END $$;
SELECT pg_temp.expect_error($$SELECT public.geo_importer('[{"country_code":"BE","kind":"pays","code":"BE","name":"Belgique","slug":"belgique"}]'::jsonb)$$,
  'membre importe');

-- 3. Administrateur : import sans doublon, parent rattaché, attributs fusionnés -------------
SELECT pg_temp.as_user('00000000-0000-0000-0000-0000000025a1', 'admin25@test.fr');
DO $$
DECLARE _n int;
BEGIN
  _n := public.geo_importer('[
    {"country_code":"be","kind":"pays","code":"BE","name":"Belgique","slug":"belgique"},
    {"country_code":"BE","kind":"region","code":"BE-WAL","name":"Wallonie","slug":"be-wallonie","parent_code":"BE"},
    {"country_code":"FR","kind":"commune","code":"01053","name":"Bourg-en-Bresse","slug":"autre-slug","parent_code":"01",
     "postal_codes":["01000"],"population":42000,"attributes":{"confiance":"source"},"source":"geo.api.gouv.fr"},
    {"country_code":"XYZ","kind":"pays","code":"X","name":"Ligne fausse","slug":"x"}
  ]'::jsonb);
  IF _n <> 3 THEN RAISE EXCEPTION 'lignes importées : % (3 attendues, la ligne fausse est écartée)', _n; END IF;
  IF (SELECT p.code FROM public.geo_places c JOIN public.geo_places p ON p.id = c.parent_id
      WHERE c.country_code = 'BE' AND c.code = 'BE-WAL') <> 'BE' THEN RAISE EXCEPTION 'parent de la Wallonie'; END IF;
  IF (SELECT population FROM public.geo_places WHERE country_code = 'FR' AND code = '01053') <> 42000 THEN
    RAISE EXCEPTION 'mise à jour de la population';
  END IF;
  IF (SELECT attributes FROM public.geo_places WHERE country_code = 'FR' AND code = '01053')
     <> '{"voisins": 3, "confiance": "source"}'::jsonb THEN RAISE EXCEPTION 'attributs non fusionnés'; END IF;
  IF (SELECT slug FROM public.geo_places WHERE country_code = 'FR' AND code = '01053') <> 'bourg-en-bresse' THEN
    RAISE EXCEPTION 'slug existant modifié';
  END IF;
  IF (SELECT count(*) FROM public.geo_places WHERE country_code = 'FR' AND kind = 'commune' AND code = '01053') <> 1 THEN
    RAISE EXCEPTION 'doublon';
  END IF;
END $$;

-- 4. État du référentiel : seuls les départements français sans communes sont à importer ------
DO $$ BEGIN
  IF public.geo_status()->'departements_sans_communes' <> '[]'::jsonb THEN
    RAISE EXCEPTION 'départements à importer : % (Gipuzkoa est espagnol)', public.geo_status()->'departements_sans_communes';
  END IF;
END $$;
ROLLBACK;
