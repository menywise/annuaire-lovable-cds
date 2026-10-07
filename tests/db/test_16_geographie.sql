\set ON_ERROR_STOP 1
\i tests/db/_helpers.sql
BEGIN;
-- Lot 11 : géographie complète (modèle de l'annuaire) — un lieu par ligne (pays, région,
-- département, EPCI, commune), voisinages calculés, recherche par nom ou code postal,
-- référentiel public en lecture, écrit par l'admin ou le serveur seulement.
INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-0000000000a1', 'admin@test.fr'),
  ('00000000-0000-0000-0000-0000000000a2', 'membre@test.fr');
SELECT pg_temp.as_user('00000000-0000-0000-0000-0000000000a1', 'admin@test.fr');
SELECT public.bootstrap_current_user('Administrateur');
SELECT pg_temp.as_user('00000000-0000-0000-0000-0000000000a2', 'membre@test.fr');
SELECT public.bootstrap_current_user('Membre');
RESET ROLE;
-- Département déjà présent avant le lot (production : 101 lignes saisies à la main).
INSERT INTO public.geo_departements (code, nom, region, slug) VALUES ('69', 'Rhône', '', 'rhone')
  ON CONFLICT (code) DO NOTHING;

-- 1. Import (serveur) : région, départements, EPCI, communes ---------------------------------
INSERT INTO public.geo_places (kind, code, name, slug, parent_code) VALUES
  ('region', '84', 'Auvergne-Rhône-Alpes', 'auvergne-rhone-alpes', 'FR');
INSERT INTO public.geo_places (kind, code, name, slug, parent_code) VALUES
  ('departement', '69', 'Rhône', 'rhone', '84'),
  ('departement', '01', 'Ain', 'ain', '84');
INSERT INTO public.geo_places (kind, code, name, slug, parent_code, population) VALUES
  ('epci', '200046977', 'Métropole de Lyon', 'metropole-de-lyon', '69', 1400000);
INSERT INTO public.geo_places (kind, code, name, slug, parent_code, epci_code, postal_codes, population, latitude, longitude) VALUES
  ('commune', '69123', 'Lyon', 'lyon', '69', '200046977', ARRAY['69001','69002','69003'], 520000, 45.7580, 4.8351),
  ('commune', '69266', 'Villeurbanne', 'villeurbanne', '69', '200046977', ARRAY['69100'], 150000, 45.7719, 4.8902),
  ('commune', '69259', 'Vénissieux', 'venissieux', '69', '200046977', ARRAY['69200'], 66000, 45.6973, 4.8859),
  ('commune', '01053', 'Bourg-en-Bresse', 'bourg-en-bresse', '01', NULL, ARRAY['01000'], 41000, 46.2052, 5.2255),
  ('commune', '69999', 'Commune sans centre', 'sans-centre', '69', NULL, ARRAY['69999'], 10, NULL, NULL);

DO $$ BEGIN
  -- Rattachement automatique au parent.
  IF (SELECT p.code FROM public.geo_places c JOIN public.geo_places p ON p.id = c.parent_id
      WHERE c.kind = 'commune' AND c.code = '69123') <> '69' THEN RAISE EXCEPTION 'parent de Lyon'; END IF;
  IF (SELECT p.kind FROM public.geo_places c JOIN public.geo_places p ON p.id = c.parent_id
      WHERE c.kind = 'departement' AND c.code = '69') <> 'region' THEN RAISE EXCEPTION 'parent du Rhône'; END IF;
  -- Table historique des départements tenue à jour (région nommée, slug existant gardé).
  IF (SELECT region FROM public.geo_departements WHERE code = '69') <> 'Auvergne-Rhône-Alpes' THEN
    RAISE EXCEPTION 'région du département non reportée';
  END IF;
  IF (SELECT slug FROM public.geo_departements WHERE code = '69') <> 'rhone' THEN RAISE EXCEPTION 'slug existant modifié'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.geo_departements WHERE code = '01' AND slug = 'ain') THEN
    RAISE EXCEPTION 'département importé absent de la table historique';
  END IF;
END $$;
-- Réimport : même lieu, pas de doublon.
SELECT pg_temp.expect_error($$INSERT INTO public.geo_places (kind, code, name, slug) VALUES ('commune', '69123', 'Lyon', 'lyon')$$,
  'doublon de commune');
SELECT pg_temp.expect_error($$INSERT INTO public.geo_places (kind, code, name, slug) VALUES ('quartier', 'x', 'X', 'x')$$,
  'type de lieu inconnu');

-- 2. Voisinages : calcul réservé à l'admin, symétrique, borné au rayon ------------------------
SELECT pg_temp.as_user('00000000-0000-0000-0000-0000000000a2', 'membre@test.fr');
SELECT pg_temp.expect_error($$SELECT public.geo_compute_neighbours(NULL, 25, 8, 100)$$, 'membre calcule les voisinages');
SELECT pg_temp.as_anon();
SELECT pg_temp.expect_error($$SELECT public.geo_compute_neighbours(NULL, 25, 8, 100)$$, 'visiteur calcule les voisinages');
SELECT pg_temp.expect_error($$INSERT INTO public.geo_places (kind, code, name, slug) VALUES ('commune', '99999', 'Pirate', 'pirate')$$,
  'visiteur écrit dans le référentiel');
SELECT pg_temp.as_user('00000000-0000-0000-0000-0000000000a2', 'membre@test.fr');
DO $$ BEGIN
  UPDATE public.geo_places SET name = 'Piraté' WHERE code = '69123';
  IF EXISTS (SELECT 1 FROM public.geo_places WHERE name = 'Piraté') THEN RAISE EXCEPTION 'membre a modifié le référentiel'; END IF;
END $$;
SELECT pg_temp.as_user('00000000-0000-0000-0000-0000000000a1', 'admin@test.fr');
DO $$
DECLARE _n int;
BEGIN
  _n := public.geo_compute_neighbours(NULL, 25, 8, 100);
  IF _n <> 4 THEN RAISE EXCEPTION 'communes traitées : % (4 attendues, la commune sans centre est ignorée)', _n; END IF;
  -- Lyon, Villeurbanne, Vénissieux sont voisines entre elles (< 10 km) ; Bourg est à ~55 km.
  IF (SELECT count(*) FROM public.geo_neighbours('69123')) <> 2 THEN RAISE EXCEPTION 'voisines de Lyon'; END IF;
  IF EXISTS (SELECT 1 FROM public.geo_neighbours('69123') WHERE code = '01053') THEN RAISE EXCEPTION 'Bourg hors rayon'; END IF;
  IF (SELECT code FROM public.geo_neighbours('69123') ORDER BY distance_km LIMIT 1) <> '69266' THEN
    RAISE EXCEPTION 'la plus proche de Lyon est Villeurbanne';
  END IF;
  -- Rejouable : second passage, plus rien à traiter.
  IF public.geo_compute_neighbours(NULL, 25, 8, 100) <> 0 THEN RAISE EXCEPTION 'second passage'; END IF;
END $$;
RESET ROLE;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM public.geo_adjacency a WHERE NOT EXISTS (
      SELECT 1 FROM public.geo_adjacency b WHERE b.place_id = a.neighbor_id AND b.neighbor_id = a.place_id))
  THEN RAISE EXCEPTION 'voisinage non symétrique'; END IF;
END $$;

-- 3. Recherche de lieux (visiteur) : nom sans accent, début de nom, code postal ----------------
SELECT pg_temp.as_anon();
DO $$ BEGIN
  IF (SELECT code FROM public.geo_search('venissieux') LIMIT 1) <> '69259' THEN RAISE EXCEPTION 'nom sans accent'; END IF;
  IF (SELECT code FROM public.geo_search('ville') LIMIT 1) <> '69266' THEN RAISE EXCEPTION 'début de nom'; END IF;
  IF (SELECT code FROM public.geo_search('69100') LIMIT 1) <> '69266' THEN RAISE EXCEPTION 'code postal'; END IF;
  IF (SELECT code FROM public.geo_search('690') LIMIT 1) <> '69123' THEN RAISE EXCEPTION 'début de code postal, la plus peuplée d''abord'; END IF;
  IF (SELECT kind FROM public.geo_search('rhone', ARRAY['departement']) LIMIT 1) <> 'departement' THEN RAISE EXCEPTION 'filtre par type'; END IF;
  IF EXISTS (SELECT 1 FROM public.geo_search('')) OR EXISTS (SELECT 1 FROM public.geo_search('l')) THEN RAISE EXCEPTION 'saisie trop courte'; END IF;
  PERFORM * FROM public.geo_search($q$%' OR 1=1 --$q$);
  IF (SELECT count(*) FROM public.geo_search('lyon', NULL, 500)) > 50 THEN RAISE EXCEPTION 'limite'; END IF;
END $$;
-- Socle 1.5.0 : plus de lecture directe du référentiel par un visiteur (pas d'export en masse) ;
-- les pages lisent par fonctions à l'unité (test_25_referentiel_studio.sql).
SELECT pg_temp.expect_error($$SELECT count(*) FROM public.geo_places$$, 'visiteur lit tout le référentiel');

-- 4. État du référentiel --------------------------------------------------------------------
DO $$
DECLARE _s jsonb := public.geo_status();
BEGIN
  IF (_s->'lieux'->>'commune')::int <> 5 OR (_s->'lieux'->>'departement')::int <> 2 THEN RAISE EXCEPTION 'comptes : %', _s; END IF;
  IF _s->'departements_sans_communes' <> '[]'::jsonb THEN RAISE EXCEPTION 'départements sans communes : %', _s; END IF;
  IF (_s->>'voisins_a_calculer')::int <> 0 OR (_s->>'voisinages')::int <> 6 THEN RAISE EXCEPTION 'voisinages : %', _s; END IF;
END $$;
RESET ROLE;
INSERT INTO public.geo_places (kind, code, name, slug, parent_code) VALUES ('departement', '38', 'Isère', 'isere', '84');
DO $$ BEGIN
  IF public.geo_status()->'departements_sans_communes' <> '["38"]'::jsonb THEN RAISE EXCEPTION 'Isère à importer'; END IF;
END $$;

-- 5. Ancienne table des communes retirée (vide, remplacée par geo_places) ----------------------
RESET ROLE;
DO $$ BEGIN
  IF to_regclass('public.geo_communes') IS NOT NULL THEN RAISE EXCEPTION 'geo_communes toujours là'; END IF;
END $$;
ROLLBACK;
