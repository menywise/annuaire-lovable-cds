CREATE OR REPLACE FUNCTION public.geo_places_link_parent()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE _parent_kind text;
BEGIN
  _parent_kind := CASE NEW.kind
    WHEN 'region' THEN 'pays' WHEN 'departement' THEN 'region'
    WHEN 'epci' THEN 'departement' WHEN 'commune' THEN 'departement' END;
  IF _parent_kind IS NOT NULL AND NEW.parent_code IS NOT NULL THEN
    SELECT id INTO NEW.parent_id FROM public.geo_places
    WHERE country_code = NEW.country_code AND kind = _parent_kind AND code = NEW.parent_code;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS geo_places_parent ON public.geo_places;

CREATE TRIGGER geo_places_parent BEFORE INSERT OR UPDATE OF parent_code ON public.geo_places
  FOR EACH ROW EXECUTE FUNCTION public.geo_places_link_parent();
