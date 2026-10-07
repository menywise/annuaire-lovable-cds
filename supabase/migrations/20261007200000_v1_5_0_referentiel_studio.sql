-- Socle 1.5.0 : géographie alimentée par le référentiel du Studio (GeoAnnonces) et verrouillée.
-- 1. Lecture par fonctions à l'unité (un lieu, les communes d'un département, les voisines) et
--    import réservé à l'administrateur (geo_importer, fusion des attributs : le calcul des voisines
--    déjà fait est gardé). geo_status ne compte que les départements français sans communes.
CREATE OR REPLACE FUNCTION public.geo_lieu(_kind text, _code text, _pays text DEFAULT 'FR')
RETURNS TABLE (kind text, code text, name text, slug text, parent_code text, epci_code text,
  postal_codes text[], population integer, latitude double precision, longitude double precision)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.kind, p.code, p.name, p.slug, p.parent_code, p.epci_code, p.postal_codes, p.population, p.latitude, p.longitude
  FROM public.geo_places p
  WHERE p.country_code = upper(coalesce(_pays, 'FR')) AND p.kind = _kind AND p.code = _code
  LIMIT 1
$$;
REVOKE ALL ON FUNCTION public.geo_lieu(text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.geo_lieu(text, text, text) TO anon, authenticated, service_role;
CREATE OR REPLACE FUNCTION public.geo_communes_principales(_departement text, _limit integer DEFAULT 48, _pays text DEFAULT 'FR')
RETURNS TABLE (code text, name text, population integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.code, p.name, p.population
  FROM public.geo_places p
  WHERE p.country_code = upper(coalesce(_pays, 'FR')) AND p.kind = 'commune' AND p.parent_code = _departement
  ORDER BY p.population DESC NULLS LAST, p.name
  LIMIT least(greatest(coalesce(_limit, 48), 1), 100)
$$;
REVOKE ALL ON FUNCTION public.geo_communes_principales(text, integer, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.geo_communes_principales(text, integer, text) TO anon, authenticated, service_role;
CREATE OR REPLACE FUNCTION public.geo_neighbours(_code text, _limit integer DEFAULT 12)
RETURNS TABLE (code text, name text, population integer, distance_km numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT n.code, n.name, n.population, a.distance_km
  FROM public.geo_places c
  JOIN public.geo_adjacency a ON a.place_id = c.id
  JOIN public.geo_places n ON n.id = a.neighbor_id
  WHERE c.country_code = 'FR' AND c.kind = 'commune' AND c.code = _code
  ORDER BY a.distance_km, n.name
  LIMIT least(greatest(coalesce(_limit, 12), 1), 50)
$$;
GRANT EXECUTE ON FUNCTION public.geo_neighbours(text, integer) TO anon, authenticated, service_role;
CREATE OR REPLACE FUNCTION public.geo_status()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'lieux', coalesce((SELECT jsonb_object_agg(kind, n) FROM (
      SELECT kind, count(*) AS n FROM public.geo_places GROUP BY kind) k), '{}'::jsonb),
    'departements_sans_communes', coalesce((SELECT jsonb_agg(d.code ORDER BY d.code)
      FROM public.geo_places d
      WHERE d.country_code = 'FR' AND d.kind = 'departement' AND NOT EXISTS (
        SELECT 1 FROM public.geo_places c
        WHERE c.country_code = 'FR' AND c.kind = 'commune' AND c.parent_code = d.code)), '[]'::jsonb),
    'voisins_a_calculer', (SELECT count(*) FROM public.geo_places
      WHERE kind = 'commune' AND latitude IS NOT NULL AND (attributes->>'voisins') IS NULL),
    'voisinages', (SELECT count(*) FROM public.geo_adjacency)
  )
$$;
GRANT EXECUTE ON FUNCTION public.geo_status() TO anon, authenticated, service_role;
CREATE OR REPLACE FUNCTION public.geo_importer(_lignes jsonb)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _n integer;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Réservé aux administrateurs.' USING ERRCODE = '42501';
  END IF;
  INSERT INTO public.geo_places AS g (country_code, kind, code, name, slug, parent_code, epci_code,
    postal_codes, population, latitude, longitude, attributes, source)
  SELECT upper(l.country_code), l.kind, l.code, l.name, l.slug, l.parent_code, l.epci_code,
    coalesce(l.postal_codes, '{}'), l.population, l.latitude, l.longitude,
    coalesce(l.attributes, '{}'::jsonb), coalesce(l.source, 'GeoAnnonces')
  FROM jsonb_to_recordset(coalesce(_lignes, '[]'::jsonb)) AS l(country_code text, kind text, code text,
    name text, slug text, parent_code text, epci_code text, postal_codes text[], population integer,
    latitude double precision, longitude double precision, attributes jsonb, source text)
  WHERE l.country_code ~ '^[A-Za-z]{2}$' AND l.code <> '' AND l.name <> ''
  ON CONFLICT (country_code, kind, code) DO UPDATE SET
    name = excluded.name, parent_code = excluded.parent_code, epci_code = excluded.epci_code,
    postal_codes = excluded.postal_codes, population = excluded.population,
    latitude = excluded.latitude, longitude = excluded.longitude,
    attributes = g.attributes || excluded.attributes, source = excluded.source;
  GET DIAGNOSTICS _n = ROW_COUNT;
  RETURN _n;
END;
$$;
REVOKE ALL ON FUNCTION public.geo_importer(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.geo_importer(jsonb) TO authenticated, service_role;
-- 2. Verrou : plus de lecture directe de geo_places par un visiteur ; un membre ne voit rien (seule
--    la règle admin reste). Les pages lisent par les fonctions ci-dessus : pas d'export en masse.
DROP POLICY IF EXISTS geo_places_read ON public.geo_places;
REVOKE SELECT ON public.geo_places FROM anon;
-- 3. Version.
INSERT INTO public.socle_versions (version, niveau, publie_le, resume, detail, migration_reference)
VALUES ('1.5.0', 'brique', '2026-10-07',
  'Géographie alimentée par le référentiel du Studio (GeoAnnonces) et verrouillée contre l''export en masse.',
  'Import d''un pays depuis GeoAnnonces par clé (secrets CDS_GEO_URL et CDS_GEO_CLE, fonction geo_importer) ; lecture de geo_places fermée aux visiteurs, pages servies par fonctions à l''unité (geo_lieu, geo_communes_principales, geo_neighbours, geo_search).',
  '20261007200000_v1_5_0_referentiel_studio')
ON CONFLICT (version) DO NOTHING;
INSERT INTO public.site_settings (key, value)
VALUES ('socle', jsonb_build_object('version', '1.5.0', 'publie_le', '2026-10-07',
  'migration_reference', '20261007200000_v1_5_0_referentiel_studio'))
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()
WHERE string_to_array(coalesce(public.site_settings.value ->> 'version', '0.0.0'), '.')::int[]
      < string_to_array('1.5.0', '.')::int[];
