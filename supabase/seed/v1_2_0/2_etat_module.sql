CREATE OR REPLACE FUNCTION public.module_enabled(_key text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _key = ANY (public.module_socle_keys())
    OR ((public.module_defaults() -> _key) IS NOT NULL AND coalesce((
      public.module_defaults()
      || coalesce((SELECT value FROM public.site_settings WHERE key = 'modules'), '{}'::jsonb)
    ) ->> _key, 'false')::boolean)
$$;
REVOKE ALL ON FUNCTION public.module_enabled(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.module_enabled(text) TO anon, authenticated, service_role;
