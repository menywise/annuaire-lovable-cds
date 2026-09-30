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
