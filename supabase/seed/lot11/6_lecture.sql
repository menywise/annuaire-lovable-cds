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

CREATE OR REPLACE FUNCTION public.geo_search(_q text, _kinds text[] DEFAULT NULL, _limit integer DEFAULT 10)
RETURNS TABLE (kind text, code text, name text, parent_code text, postal_codes text[], population integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH q AS (
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
