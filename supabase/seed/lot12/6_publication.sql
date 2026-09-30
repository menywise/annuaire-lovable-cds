CREATE OR REPLACE FUNCTION public.watch_publish(_site_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _s record;
  _slug text;
  _id uuid;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Réservé aux administrateurs' USING ERRCODE = '42501';
  END IF;
  IF NOT public.module_enabled('directory') THEN
    RAISE EXCEPTION 'Allumez d''abord le module Annuaire' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO _s FROM public.watch_sites WHERE id = _site_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Site introuvable' USING ERRCODE = 'P0002';
  END IF;
  IF _s.listing_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.directory_listings l WHERE l.id = _s.listing_id) THEN
    RETURN _s.listing_id;
  END IF;
  _slug := left(regexp_replace(_s.host, '[^a-z0-9]+', '-', 'g'), 100);
  IF EXISTS (SELECT 1 FROM public.directory_listings l WHERE l.slug = _slug) THEN
    _slug := left(_slug, 90) || '-' || substr(md5(_s.id::text), 1, 6);
  END IF;
  INSERT INTO public.directory_listings (name, slug, excerpt, description, website, tags, status, created_by)
  VALUES (
    left(coalesce(nullif(btrim(_s.title), ''), _s.host), 120),
    _slug,
    left(_s.description, 300),
    _s.description,
    _s.url,
    coalesce((SELECT array_agg(DISTINCT t ->> 'name') FROM jsonb_array_elements(_s.stack) AS t
              WHERE (t ->> 'kind') IN ('plateforme', 'framework')), '{}'),
    'draft',
    auth.uid()
  )
  RETURNING id INTO _id;
  UPDATE public.watch_sites SET listing_id = _id WHERE id = _site_id;
  RETURN _id;
END;
$$;
REVOKE ALL ON FUNCTION public.watch_publish(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.watch_publish(uuid) TO authenticated, service_role;
