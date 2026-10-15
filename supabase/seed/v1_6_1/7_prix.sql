ALTER TABLE public.marketplace_listings DROP CONSTRAINT IF EXISTS marketplace_listings_price_check;
ALTER TABLE public.marketplace_listings
  ADD CONSTRAINT marketplace_listings_price_check CHECK (price_cents >= 0) NOT VALID;
ALTER TABLE public.lms_courses DROP CONSTRAINT IF EXISTS lms_courses_price_check;
ALTER TABLE public.lms_courses
  ADD CONSTRAINT lms_courses_price_check CHECK (price_cents >= 0) NOT VALID;
ALTER TABLE public.pricing_plans DROP CONSTRAINT IF EXISTS pricing_plans_price_check;
ALTER TABLE public.pricing_plans
  ADD CONSTRAINT pricing_plans_price_check CHECK (price_cents >= 0) NOT VALID;
DO $$
DECLARE _c record;
BEGIN
  FOR _c IN
    SELECT c.conrelid::regclass AS tbl, c.conname
    FROM pg_constraint c
    WHERE NOT c.convalidated
      AND c.conrelid IN ('public.marketplace_listings'::regclass, 'public.lms_courses'::regclass,
                         'public.pricing_plans'::regclass)
      AND c.conname IN ('marketplace_listings_price_check', 'lms_courses_price_check',
                        'pricing_plans_price_check', 'pricing_plans_features_array')
  LOOP
    BEGIN
      EXECUTE format('ALTER TABLE %s VALIDATE CONSTRAINT %I', _c.tbl, _c.conname);
    EXCEPTION WHEN check_violation THEN
      RAISE NOTICE 'Contrainte % non validée : des lignes existantes de % sont hors borne', _c.conname, _c.tbl;
    END;
  END LOOP;
END $$;
