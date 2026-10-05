ALTER TABLE public.geo_places ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS geo_places_read ON public.geo_places;
CREATE POLICY geo_places_read ON public.geo_places FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS geo_places_admin ON public.geo_places;
CREATE POLICY geo_places_admin ON public.geo_places FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
DROP TRIGGER IF EXISTS geo_places_updated_at ON public.geo_places;
CREATE TRIGGER geo_places_updated_at BEFORE UPDATE ON public.geo_places
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.geo_places FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.geo_adjacency FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.geo_departements FROM anon;
