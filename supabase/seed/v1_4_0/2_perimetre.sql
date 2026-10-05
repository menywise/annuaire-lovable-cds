CREATE OR REPLACE FUNCTION public.en_perimetre(public.template_checks)
RETURNS boolean LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT cardinality($1.modules) = 0
    OR EXISTS (SELECT 1 FROM unnest($1.modules) AS m WHERE public.module_enabled(m))
$$;
GRANT EXECUTE ON FUNCTION public.en_perimetre(public.template_checks) TO anon, authenticated, service_role;
