CREATE OR REPLACE FUNCTION public.request_directory_claim(_listing_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Non authentifie';
  END IF;

  UPDATE public.directory_listings
     SET claim_requested_by = _uid,
         claim_requested_at = now()
   WHERE id = _listing_id
     AND status = 'published'
     AND claimed_by IS NULL;

  RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION public.request_directory_claim(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.request_directory_claim(uuid) TO authenticated;