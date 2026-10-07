DROP POLICY IF EXISTS geo_places_read ON public.geo_places;
REVOKE SELECT ON public.geo_places FROM anon;
