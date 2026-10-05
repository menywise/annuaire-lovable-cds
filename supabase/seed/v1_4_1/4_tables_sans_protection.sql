CREATE OR REPLACE FUNCTION public.tables_sans_protection()
RETURNS SETOF text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Réservé aux administrateurs';
  END IF;
  RETURN QUERY
    SELECT c.relname::text
    FROM pg_catalog.pg_class c
    JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p') AND NOT c.relrowsecurity
    ORDER BY 1;
END;
$$;
REVOKE ALL ON FUNCTION public.tables_sans_protection() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tables_sans_protection() TO authenticated, service_role;
INSERT INTO public.template_checks (code, area, label, requirement, status, severity, evidence, position, modules)
VALUES ('SEC-RLS', 'Sécurité', 'Aucune table sans protection',
  'En production, tables_sans_protection() ne renvoie rien : chaque table publique a la sécurité par ligne activée.',
  'a_verifier', 'bloquant', '', 150, '{}')
ON CONFLICT (code) DO NOTHING;
