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

DROP TABLE IF EXISTS public.geo_communes;

NOTIFY pgrst, 'reload schema';

SELECT p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.proname IN ('geo_places_link_parent', 'geo_places_sync_departement',
  'geo_compute_neighbours', 'geo_neighbours', 'geo_search', 'geo_status', 'geo_distance_km')
ORDER BY 1;
