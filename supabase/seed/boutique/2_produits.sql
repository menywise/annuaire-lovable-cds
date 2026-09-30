CREATE TABLE IF NOT EXISTS public.shop_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  summary text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  kind text NOT NULL DEFAULT 'physique',
  price_cents integer NOT NULL DEFAULT 100,
  currency text NOT NULL DEFAULT 'eur',
  image_url text,
  stock integer,
  published boolean NOT NULL DEFAULT false,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.shop_products DROP CONSTRAINT IF EXISTS shop_products_kind_check;
ALTER TABLE public.shop_products ADD CONSTRAINT shop_products_kind_check
  CHECK (kind IN ('physique', 'pdf', 'ebook'));
ALTER TABLE public.shop_products DROP CONSTRAINT IF EXISTS shop_products_price_check;
ALTER TABLE public.shop_products ADD CONSTRAINT shop_products_price_check
  CHECK (price_cents > 0 AND price_cents <= 10000000);
ALTER TABLE public.shop_products DROP CONSTRAINT IF EXISTS shop_products_currency_check;
ALTER TABLE public.shop_products ADD CONSTRAINT shop_products_currency_check CHECK (currency = 'eur');
ALTER TABLE public.shop_products DROP CONSTRAINT IF EXISTS shop_products_stock_check;
ALTER TABLE public.shop_products ADD CONSTRAINT shop_products_stock_check CHECK (stock IS NULL OR stock >= 0);
ALTER TABLE public.shop_products DROP CONSTRAINT IF EXISTS shop_products_slug_check;
ALTER TABLE public.shop_products ADD CONSTRAINT shop_products_slug_check
  CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND char_length(slug) <= 120 AND slug <> 'panier');
ALTER TABLE public.shop_products DROP CONSTRAINT IF EXISTS shop_products_length_check;
ALTER TABLE public.shop_products ADD CONSTRAINT shop_products_length_check
  CHECK (char_length(title) BETWEEN 1 AND 200 AND char_length(summary) <= 500
         AND char_length(description) <= 20000);
CREATE INDEX IF NOT EXISTS shop_products_list_idx ON public.shop_products (published, position);

ALTER TABLE public.shop_products ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.shop_products FROM anon, authenticated;
GRANT SELECT ON public.shop_products TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shop_products TO authenticated;
GRANT ALL ON public.shop_products TO service_role;
DROP POLICY IF EXISTS shop_products_read ON public.shop_products;
CREATE POLICY shop_products_read ON public.shop_products FOR SELECT TO anon, authenticated
  USING (published AND public.module_enabled('shop'));
DROP POLICY IF EXISTS shop_products_admin_read ON public.shop_products;
CREATE POLICY shop_products_admin_read ON public.shop_products FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS shop_products_admin_insert ON public.shop_products;
CREATE POLICY shop_products_admin_insert ON public.shop_products FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS shop_products_admin_update ON public.shop_products;
CREATE POLICY shop_products_admin_update ON public.shop_products FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS shop_products_admin_delete ON public.shop_products;
CREATE POLICY shop_products_admin_delete ON public.shop_products FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.shop_products_touch()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at := now();
  IF NEW.kind <> 'physique' THEN
    NEW.stock := NULL;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS shop_products_touch ON public.shop_products;
CREATE TRIGGER shop_products_touch BEFORE INSERT OR UPDATE ON public.shop_products
  FOR EACH ROW EXECUTE FUNCTION public.shop_products_touch();

CREATE TABLE IF NOT EXISTS public.shop_product_files (
  product_id uuid PRIMARY KEY REFERENCES public.shop_products(id) ON DELETE CASCADE,
  path text NOT NULL,
  file_name text NOT NULL,
  size_bytes bigint,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.shop_product_files DROP CONSTRAINT IF EXISTS shop_product_files_path_check;
ALTER TABLE public.shop_product_files ADD CONSTRAINT shop_product_files_path_check
  CHECK (char_length(path) BETWEEN 1 AND 300 AND char_length(file_name) BETWEEN 1 AND 200);
ALTER TABLE public.shop_product_files ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.shop_product_files FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shop_product_files TO authenticated;
GRANT ALL ON public.shop_product_files TO service_role;
DROP POLICY IF EXISTS shop_product_files_admin ON public.shop_product_files;
CREATE POLICY shop_product_files_admin ON public.shop_product_files FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
