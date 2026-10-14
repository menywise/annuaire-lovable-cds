CREATE OR REPLACE FUNCTION public.request_directory_claim(_listing_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid uuid := auth.uid();
  _demandeur uuid;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Non authentifie';
  END IF;
  IF NOT public.module_enabled('directory') THEN
    RETURN false;
  END IF;
  SELECT claim_requested_by INTO _demandeur
    FROM public.directory_listings
   WHERE id = _listing_id
     AND status = 'published'
     AND claimed_by IS NULL
     FOR UPDATE;
  IF NOT FOUND THEN
    RETURN false;
  END IF;
  IF _demandeur = _uid THEN
    RETURN true;
  END IF;
  IF _demandeur IS NOT NULL THEN
    RAISE EXCEPTION 'Une demande est déjà en cours d''examen pour cette fiche.'
      USING ERRCODE = 'CDS03';
  END IF;
  UPDATE public.directory_listings
     SET claim_requested_by = _uid,
         claim_requested_at = now()
   WHERE id = _listing_id;
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.request_directory_claim(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.request_directory_claim(uuid) TO authenticated;
CREATE OR REPLACE FUNCTION public.guard_directory_listing_update()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF current_user NOT IN ('authenticated', 'anon') OR public.has_role(auth.uid(), 'admin') THEN
    RETURN NEW;
  END IF;
  IF NEW.verified IS DISTINCT FROM OLD.verified
     OR NEW.featured IS DISTINCT FROM OLD.featured
     OR NEW.plan IS DISTINCT FROM OLD.plan
     OR NEW.claimed_by IS DISTINCT FROM OLD.claimed_by
     OR NEW.claimed_at IS DISTINCT FROM OLD.claimed_at
     OR NEW.claim_requested_by IS DISTINCT FROM OLD.claim_requested_by
     OR NEW.claim_requested_at IS DISTINCT FROM OLD.claim_requested_at
     OR NEW.created_by IS DISTINCT FROM OLD.created_by
     OR (NEW.status IS DISTINCT FROM OLD.status AND NEW.status = 'published') THEN
    RAISE EXCEPTION 'Modification réservée à l''administration' USING ERRCODE = '42501';
  END IF;
  IF OLD.status = 'published' AND NEW.status = 'published'
     AND (NEW.name, NEW.slug, NEW.excerpt, NEW.description, NEW.category_id, NEW.tags,
          NEW.address, NEW.postal_code, NEW.city, NEW.departement, NEW.latitude, NEW.longitude,
          NEW.phone, NEW.email, NEW.website, NEW.logo_url, NEW.cover_url, NEW.photos, NEW.hours)
         IS DISTINCT FROM
         (OLD.name, OLD.slug, OLD.excerpt, OLD.description, OLD.category_id, OLD.tags,
          OLD.address, OLD.postal_code, OLD.city, OLD.departement, OLD.latitude, OLD.longitude,
          OLD.phone, OLD.email, OLD.website, OLD.logo_url, OLD.cover_url, OLD.photos, OLD.hours) THEN
    NEW.status := 'draft';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS directory_listings_guard ON public.directory_listings;
CREATE TRIGGER directory_listings_guard BEFORE UPDATE ON public.directory_listings
  FOR EACH ROW EXECUTE FUNCTION public.guard_directory_listing_update();
