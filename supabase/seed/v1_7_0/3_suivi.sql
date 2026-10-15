CREATE OR REPLACE FUNCTION public.report_status(_code text)
RETURNS TABLE (status text, reason text, created_at timestamptz, handled_at timestamptz, public_note text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT r.status, r.reason, r.created_at, r.handled_at, r.public_note
  FROM public.reports r
  WHERE public.module_enabled('reports')
    AND char_length(coalesce(_code, '')) BETWEEN 6 AND 20
    AND r.tracking_code = upper(btrim(_code))
$$;
REVOKE ALL ON FUNCTION public.report_status(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.report_status(text) TO anon, authenticated, service_role;
CREATE OR REPLACE FUNCTION public.report_improvements(_limit integer DEFAULT 50)
RETURNS TABLE (id uuid, reason text, content_type text, reported_url text, public_note text, handled_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT r.id, r.reason, r.content_type, r.reported_url, r.public_note, r.handled_at
  FROM public.reports r
  WHERE public.module_enabled('reports') AND r.status = 'action_prise' AND r.public_note IS NOT NULL
  ORDER BY r.handled_at DESC
  LIMIT least(greatest(coalesce(_limit, 50), 1), 200)
$$;
REVOKE ALL ON FUNCTION public.report_improvements(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.report_improvements(integer) TO anon, authenticated, service_role;
