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
