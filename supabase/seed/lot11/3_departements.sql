CREATE OR REPLACE FUNCTION public.geo_places_sync_departement()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _region text;
BEGIN
  IF NEW.kind <> 'departement' OR NEW.country_code <> 'FR' THEN RETURN NEW; END IF;
  SELECT name INTO _region FROM public.geo_places
  WHERE country_code = 'FR' AND kind = 'region' AND code = NEW.parent_code;
  INSERT INTO public.geo_departements (code, nom, region, slug, population)
  VALUES (NEW.code, NEW.name, coalesce(_region, ''), NEW.slug, coalesce(NEW.population, 0))
  ON CONFLICT (code) DO UPDATE SET nom = excluded.nom,
    region = CASE WHEN excluded.region <> '' THEN excluded.region ELSE public.geo_departements.region END,
    population = CASE WHEN excluded.population > 0 THEN excluded.population ELSE public.geo_departements.population END;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS geo_places_departement ON public.geo_places;

CREATE TRIGGER geo_places_departement AFTER INSERT OR UPDATE ON public.geo_places
  FOR EACH ROW EXECUTE FUNCTION public.geo_places_sync_departement();
