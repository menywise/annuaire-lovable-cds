CREATE OR REPLACE FUNCTION public.directory_listing_visible(_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.directory_listings WHERE id = _id)
$$;
GRANT EXECUTE ON FUNCTION public.directory_listing_visible(uuid) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.directory_listing_modifiable(_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.directory_listings l
    WHERE l.id = _id
      AND (l.claimed_by = auth.uid() OR l.created_by = auth.uid()
           OR public.has_role(auth.uid(), 'admin'::public.app_role)))
$$;
GRANT EXECUTE ON FUNCTION public.directory_listing_modifiable(uuid) TO anon, authenticated, service_role;
