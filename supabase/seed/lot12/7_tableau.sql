CREATE OR REPLACE FUNCTION public.watch_status()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Réservé aux administrateurs' USING ERRCODE = '42501';
  END IF;
  RETURN jsonb_build_object(
    'sites', (SELECT count(*) FROM public.watch_sites),
    'en_ligne', (SELECT count(*) FROM public.watch_sites WHERE status = 'en_ligne'),
    'instables', (SELECT count(*) FROM public.watch_sites WHERE status = 'instable'),
    'hors_ligne', (SELECT count(*) FROM public.watch_sites WHERE status = 'hors_ligne'),
    'a_publier', (SELECT count(*) FROM public.watch_sites WHERE listing_id IS NULL),
    'propositions_en_attente', (SELECT count(*) FROM public.watch_submissions WHERE status = 'en_attente'),
    'refus_7_jours', (SELECT count(*) FROM public.watch_rejects WHERE created_at > now() - interval '7 days'),
    'sources_actives', (SELECT count(*) FROM public.watch_sources WHERE enabled),
    'regles_actives', (SELECT count(*) FROM public.watch_detectors WHERE enabled)
  );
END;
$$;
REVOKE ALL ON FUNCTION public.watch_status() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.watch_status() TO authenticated, service_role;
