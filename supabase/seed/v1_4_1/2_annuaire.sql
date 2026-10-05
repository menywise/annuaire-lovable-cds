DROP POLICY IF EXISTS dir_list_insert_auth ON public.directory_listings;
CREATE POLICY dir_list_insert_auth ON public.directory_listings FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR (
      public.module_enabled('directory')
      AND created_by = auth.uid()
      AND status = 'draft'
      AND verified = false AND featured = false AND plan = 'free'
      AND claimed_by IS NULL AND claimed_at IS NULL
      AND (claim_requested_by IS NULL OR claim_requested_by = auth.uid())
    )
  );
DROP POLICY IF EXISTS dir_rev_insert_auth ON public.directory_reviews;
CREATE POLICY dir_rev_insert_auth ON public.directory_reviews FOR INSERT TO authenticated
  WITH CHECK (author_id = auth.uid() AND approved = false AND public.module_enabled('directory'));
CREATE OR REPLACE FUNCTION public.request_directory_claim(_listing_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Non authentifie';
  END IF;
  IF NOT public.module_enabled('directory') THEN
    RETURN false;
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
