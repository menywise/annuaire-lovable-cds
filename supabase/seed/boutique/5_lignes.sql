CREATE TABLE IF NOT EXISTS public.shop_order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.shop_orders(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.shop_products(id) ON DELETE SET NULL,
  title text NOT NULL,
  kind text NOT NULL,
  unit_price_cents integer NOT NULL,
  quantity integer NOT NULL,
  downloads integer NOT NULL DEFAULT 0
);
ALTER TABLE public.shop_order_items DROP CONSTRAINT IF EXISTS shop_order_items_check;
ALTER TABLE public.shop_order_items ADD CONSTRAINT shop_order_items_check
  CHECK (kind IN ('physique', 'pdf', 'ebook') AND unit_price_cents > 0 AND quantity BETWEEN 1 AND 10
         AND (kind = 'physique' OR quantity = 1));
CREATE INDEX IF NOT EXISTS shop_order_items_order_idx ON public.shop_order_items (order_id);
CREATE INDEX IF NOT EXISTS shop_order_items_product_idx ON public.shop_order_items (product_id);
ALTER TABLE public.shop_order_items ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.shop_order_items FROM anon, authenticated;
GRANT SELECT ON public.shop_order_items TO authenticated;
GRANT ALL ON public.shop_order_items TO service_role;
DROP POLICY IF EXISTS shop_order_items_read ON public.shop_order_items;
CREATE POLICY shop_order_items_read ON public.shop_order_items FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.shop_orders o WHERE o.id = order_id
                 AND (o.user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))));

ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS order_id uuid;
ALTER TABLE public.payments DROP CONSTRAINT IF EXISTS payments_order_id_fkey;
ALTER TABLE public.payments ADD CONSTRAINT payments_order_id_fkey
  FOREIGN KEY (order_id) REFERENCES public.shop_orders(id) ON DELETE SET NULL;
ALTER TABLE public.payments ALTER COLUMN waiver_accepted_at DROP NOT NULL;
CREATE INDEX IF NOT EXISTS payments_order_idx ON public.payments (order_id);
