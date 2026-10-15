CREATE OR REPLACE FUNCTION public.purge_report_contacts()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _n integer;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Réservé aux administrateurs' USING ERRCODE = '42501';
  END IF;
  UPDATE public.reports SET contact_email = NULL
  WHERE contact_email IS NOT NULL
    AND ((handled_at IS NOT NULL AND handled_at < now() - interval '3 months')
         OR created_at < now() - interval '12 months');
  GET DIAGNOSTICS _n = ROW_COUNT;
  RETURN _n;
END;
$$;
REVOKE ALL ON FUNCTION public.purge_report_contacts() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.purge_report_contacts() TO authenticated, service_role;
