-- V0 · Lot 11 — Géographie complète, au niveau de l'annuaire (annuaire-mac97000).
-- Même modèle que l'annuaire : un lieu par ligne (pays, région, département, EPCI, commune),
-- voisinages calculés à part. Données : geo.api.gouv.fr, importées par le serveur (écran
-- Géographie). La table historique geo_departements reste et suit geo_places automatiquement.
-- Rejouable sans danger.

-- 1. Lieux ---------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.geo_places (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code text NOT NULL DEFAULT 'FR',
  kind text NOT NULL,
  code text NOT NULL,
  name text NOT NULL,
  slug text NOT NULL,
  parent_id uuid REFERENCES public.geo_places(id) ON DELETE SET NULL,
  parent_code text,
  epci_code text,
  postal_codes text[] NOT NULL DEFAULT '{}',
  population integer,
  latitude double precision,
  longitude double precision,
  attributes jsonb NOT NULL DEFAULT '{}'::jsonb,
  source text NOT NULL DEFAULT 'geo.api.gouv.fr',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (country_code, kind, code)
);
ALTER TABLE public.geo_places DROP CONSTRAINT IF EXISTS geo_places_kind_check;
ALTER TABLE public.geo_places ADD CONSTRAINT geo_places_kind_check
  CHECK (kind IN ('pays', 'region', 'departement', 'epci', 'commune'));
CREATE INDEX IF NOT EXISTS geo_places_slug_idx ON public.geo_places (country_code, kind, slug);
CREATE INDEX IF NOT EXISTS geo_places_parent_idx ON public.geo_places (parent_id);
CREATE INDEX IF NOT EXISTS geo_places_parent_code_idx ON public.geo_places (kind, parent_code);
CREATE INDEX IF NOT EXISTS geo_places_epci_idx ON public.geo_places (epci_code);
CREATE INDEX IF NOT EXISTS geo_places_coords_idx ON public.geo_places (latitude, longitude)
  WHERE kind = 'commune';
CREATE INDEX IF NOT EXISTS geo_places_postal_idx ON public.geo_places USING gin (postal_codes);

GRANT SELECT ON public.geo_places TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.geo_places TO authenticated;
GRANT ALL ON public.geo_places TO service_role;
ALTER TABLE public.geo_places ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS geo_places_read ON public.geo_places;
CREATE POLICY geo_places_read ON public.geo_places FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS geo_places_admin ON public.geo_places;
CREATE POLICY geo_places_admin ON public.geo_places FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP TRIGGER IF EXISTS geo_places_updated_at ON public.geo_places;
CREATE TRIGGER geo_places_updated_at BEFORE UPDATE ON public.geo_places
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Parent retrouvé par son code : pays > région > département > commune ; EPCI > département.
CREATE OR REPLACE FUNCTION public.geo_places_link_parent()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE _parent_kind text;
BEGIN
  _parent_kind := CASE NEW.kind
    WHEN 'region' THEN 'pays' WHEN 'departement' THEN 'region'
    WHEN 'epci' THEN 'departement' WHEN 'commune' THEN 'departement' END;
  IF _parent_kind IS NOT NULL AND NEW.parent_code IS NOT NULL THEN
    SELECT id INTO NEW.parent_id FROM public.geo_places
    WHERE country_code = NEW.country_code AND kind = _parent_kind AND code = NEW.parent_code;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS geo_places_parent ON public.geo_places;
CREATE TRIGGER geo_places_parent BEFORE INSERT OR UPDATE OF parent_code ON public.geo_places
  FOR EACH ROW EXECUTE FUNCTION public.geo_places_link_parent();

-- Table historique geo_departements (clé des fiches et des annonces) : suit les départements
-- importés. Le slug existant est gardé (adresses publiques stables).
CREATE OR REPLACE FUNCTION public.geo_places_sync_departement()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _region text;
BEGIN
  IF NEW.kind <> 'departement' OR NEW.country_code <> 'FR' THEN RETURN NEW; END IF;
  SELECT name INTO _region FROM public.geo_places
  WHERE country_code = 'FR' AND kind = 'region' AND code = NEW.parent_code;
  INSERT INTO public.geo_departements (code, nom, region, slug, population)
  VALUES (NEW.code, NEW.name, coalesce(_region, ''), NEW.slug, coalesce(NEW.population, 0))
  ON CONFLICT (code) DO UPDATE SET nom = excluded.nom,
    region = CASE WHEN excluded.region <> '' THEN excluded.region ELSE public.geo_departements.region END,
    population = CASE WHEN excluded.population > 0 THEN excluded.population ELSE public.geo_departements.population END;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS geo_places_departement ON public.geo_places;
CREATE TRIGGER geo_places_departement AFTER INSERT OR UPDATE ON public.geo_places
  FOR EACH ROW EXECUTE FUNCTION public.geo_places_sync_departement();

-- 2. Voisinages (communes à moins de _rayon_km, au plus _max par commune) ------------------------
CREATE TABLE IF NOT EXISTS public.geo_adjacency (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  place_id uuid NOT NULL REFERENCES public.geo_places(id) ON DELETE CASCADE,
  neighbor_id uuid NOT NULL REFERENCES public.geo_places(id) ON DELETE CASCADE,
  distance_km numeric(6, 2),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (place_id, neighbor_id)
);
ALTER TABLE public.geo_adjacency ADD COLUMN IF NOT EXISTS distance_km numeric(6, 2);
CREATE INDEX IF NOT EXISTS geo_adjacency_place_idx ON public.geo_adjacency (place_id);
GRANT SELECT ON public.geo_adjacency TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.geo_adjacency TO authenticated;
GRANT ALL ON public.geo_adjacency TO service_role;
ALTER TABLE public.geo_adjacency ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS geo_adjacency_read ON public.geo_adjacency;
CREATE POLICY geo_adjacency_read ON public.geo_adjacency FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS geo_adjacency_admin ON public.geo_adjacency;
CREATE POLICY geo_adjacency_admin ON public.geo_adjacency FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.geo_distance_km(_lat1 double precision, _lon1 double precision,
  _lat2 double precision, _lon2 double precision)
RETURNS double precision LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
  SELECT 6371 * 2 * asin(sqrt(
    power(sin(radians(_lat2 - _lat1) / 2), 2) +
    cos(radians(_lat1)) * cos(radians(_lat2)) * power(sin(radians(_lon2 - _lon1) / 2), 2)))
$$;

-- Traite au plus _limit communes pas encore calculées ; renvoie leur nombre (0 = terminé).
CREATE OR REPLACE FUNCTION public.geo_compute_neighbours(_departement text DEFAULT NULL,
  _rayon_km numeric DEFAULT 25, _max integer DEFAULT 8, _limit integer DEFAULT 200)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _c record;
  _n integer := 0;
  _dlat double precision := _rayon_km / 111.0;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Réservé aux administrateurs' USING ERRCODE = '42501';
  END IF;
  FOR _c IN
    SELECT id, latitude, longitude FROM public.geo_places
    WHERE kind = 'commune' AND latitude IS NOT NULL AND longitude IS NOT NULL
      AND (attributes->>'voisins') IS NULL
      AND (_departement IS NULL OR parent_code = _departement)
    ORDER BY code
    LIMIT least(greatest(coalesce(_limit, 200), 1), 2000)
  LOOP
    INSERT INTO public.geo_adjacency (place_id, neighbor_id, distance_km)
    SELECT x.a, x.b, x.d FROM (
      SELECT _c.id AS a, v.id AS b, v.d FROM (
        SELECT p.id, round(public.geo_distance_km(_c.latitude, _c.longitude, p.latitude, p.longitude)::numeric, 2) AS d
        FROM public.geo_places p
        WHERE p.kind = 'commune' AND p.id <> _c.id
          AND p.latitude BETWEEN _c.latitude - _dlat AND _c.latitude + _dlat
          AND p.longitude BETWEEN _c.longitude - _dlat / greatest(cos(radians(_c.latitude)), 0.1)
                              AND _c.longitude + _dlat / greatest(cos(radians(_c.latitude)), 0.1)
      ) v
      WHERE v.d <= _rayon_km
      ORDER BY v.d
      LIMIT greatest(coalesce(_max, 8), 1)
    ) n, LATERAL (VALUES (n.a, n.b, n.d), (n.b, n.a, n.d)) AS x(a, b, d)
    ON CONFLICT (place_id, neighbor_id) DO NOTHING;
    UPDATE public.geo_places
    SET attributes = attributes || jsonb_build_object('voisins', true, 'rayon_km', _rayon_km)
    WHERE id = _c.id;
    _n := _n + 1;
  END LOOP;
  RETURN _n;
END;
$$;
REVOKE ALL ON FUNCTION public.geo_compute_neighbours(text, numeric, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.geo_compute_neighbours(text, numeric, integer, integer) TO authenticated, service_role;

-- Voisines d'une commune (code INSEE), de la plus proche à la plus lointaine.
CREATE OR REPLACE FUNCTION public.geo_neighbours(_code text, _limit integer DEFAULT 12)
RETURNS TABLE (code text, name text, population integer, distance_km numeric)
LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT n.code, n.name, n.population, a.distance_km
  FROM public.geo_places c
  JOIN public.geo_adjacency a ON a.place_id = c.id
  JOIN public.geo_places n ON n.id = a.neighbor_id
  WHERE c.country_code = 'FR' AND c.kind = 'commune' AND c.code = _code
  ORDER BY a.distance_km, n.name
  LIMIT least(greatest(coalesce(_limit, 12), 1), 50)
$$;
GRANT EXECUTE ON FUNCTION public.geo_neighbours(text, integer) TO anon, authenticated, service_role;

-- 3. Recherche de lieux : nom (sans accent, début de mot) ou code postal, les plus peuplés d'abord.
-- Droits du propriétaire : le référentiel est public ; unaccent vit dans le schéma extensions.
CREATE OR REPLACE FUNCTION public.geo_search(_q text, _kinds text[] DEFAULT NULL, _limit integer DEFAULT 10)
RETURNS TABLE (kind text, code text, name text, parent_code text, postal_codes text[], population integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH q AS (
    -- Jokers de LIKE et barre oblique retirés de la saisie (chr(92) : aucun antislash dans ce
    -- fichier, que certains éditeurs SQL lisent comme un guillemet échappé).
    SELECT translate(lower(extensions.unaccent(btrim(left(coalesce(_q, ''), 80)))), '%_' || chr(92), '') AS t
  )
  SELECT p.kind, p.code, p.name, p.parent_code, p.postal_codes, p.population
  FROM public.geo_places p, q
  WHERE length(q.t) >= 2
    AND (_kinds IS NULL OR p.kind = ANY (_kinds))
    AND (
      lower(extensions.unaccent(p.name)) LIKE q.t || '%'
      OR lower(extensions.unaccent(p.name)) LIKE '%-' || q.t || '%'
      OR (q.t ~ '^[0-9]{2,5}$' AND EXISTS (SELECT 1 FROM unnest(p.postal_codes) cp WHERE cp LIKE q.t || '%'))
      OR (q.t ~ '^[0-9ab]{2,9}$' AND p.code = upper(q.t))
    )
  ORDER BY p.population DESC NULLS LAST, p.name
  LIMIT least(greatest(coalesce(_limit, 10), 1), 50)
$$;
GRANT EXECUTE ON FUNCTION public.geo_search(text, text[], integer) TO anon, authenticated, service_role;

-- 4. État du référentiel (écran Géographie) : nombre de lieux par type, départements sans
-- communes (import à reprendre), communes dont les voisines restent à calculer.
CREATE OR REPLACE FUNCTION public.geo_status()
RETURNS jsonb LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT jsonb_build_object(
    'lieux', coalesce((SELECT jsonb_object_agg(kind, n) FROM (
      SELECT kind, count(*) AS n FROM public.geo_places GROUP BY kind) k), '{}'::jsonb),
    'departements_sans_communes', coalesce((SELECT jsonb_agg(d.code ORDER BY d.code)
      FROM public.geo_places d
      WHERE d.kind = 'departement' AND NOT EXISTS (
        SELECT 1 FROM public.geo_places c WHERE c.kind = 'commune' AND c.parent_code = d.code)), '[]'::jsonb),
    'voisins_a_calculer', (SELECT count(*) FROM public.geo_places
      WHERE kind = 'commune' AND latitude IS NOT NULL AND (attributes->>'voisins') IS NULL),
    'voisinages', (SELECT count(*) FROM public.geo_adjacency)
  )
$$;
GRANT EXECUTE ON FUNCTION public.geo_status() TO anon, authenticated, service_role;

-- 5. Ancienne table des communes : vide et jamais lue par le site, remplacée par geo_places ------
DROP TABLE IF EXISTS public.geo_communes;
