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
