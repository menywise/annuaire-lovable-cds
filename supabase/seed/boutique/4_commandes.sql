CREATE SEQUENCE IF NOT EXISTS public.shop_order_number_seq START 1001;
GRANT USAGE ON SEQUENCE public.shop_order_number_seq TO service_role;

CREATE TABLE IF NOT EXISTS public.shop_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  number bigint NOT NULL UNIQUE DEFAULT nextval('public.shop_order_number_seq'),
  user_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  has_physical boolean NOT NULL DEFAULT false,
  has_digital boolean NOT NULL DEFAULT false,
  subtotal_cents integer NOT NULL,
  shipping_cents integer NOT NULL DEFAULT 0,
  total_cents integer NOT NULL,
  currency text NOT NULL DEFAULT 'eur',
  waiver_accepted_at timestamptz,
  email text,
  shipping_name text,
  shipping_address jsonb,
  carrier text,
  tracking_number text,
  admin_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  paid_at timestamptz,
  shipped_at timestamptz,
  delivered_at timestamptz,
  refunded_at timestamptz
);
ALTER TABLE public.shop_orders DROP CONSTRAINT IF EXISTS shop_orders_status_check;
ALTER TABLE public.shop_orders ADD CONSTRAINT shop_orders_status_check
  CHECK (status IN ('pending', 'paid', 'shipped', 'delivered', 'expired', 'refunded'));
ALTER TABLE public.shop_orders DROP CONSTRAINT IF EXISTS shop_orders_amounts_check;
ALTER TABLE public.shop_orders ADD CONSTRAINT shop_orders_amounts_check
  CHECK (subtotal_cents > 0 AND shipping_cents >= 0 AND total_cents = subtotal_cents + shipping_cents);
ALTER TABLE public.shop_orders DROP CONSTRAINT IF EXISTS shop_orders_waiver_check;
ALTER TABLE public.shop_orders ADD CONSTRAINT shop_orders_waiver_check
  CHECK (NOT has_digital OR waiver_accepted_at IS NOT NULL);
ALTER TABLE public.shop_orders DROP CONSTRAINT IF EXISTS shop_orders_text_check;
ALTER TABLE public.shop_orders ADD CONSTRAINT shop_orders_text_check
  CHECK (char_length(carrier) <= 100 AND char_length(tracking_number) <= 100
         AND char_length(admin_note) <= 2000);
CREATE INDEX IF NOT EXISTS shop_orders_user_idx ON public.shop_orders (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS shop_orders_status_idx ON public.shop_orders (status, created_at DESC);

ALTER TABLE public.shop_orders ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.shop_orders FROM anon, authenticated;
GRANT SELECT, UPDATE ON public.shop_orders TO authenticated;
GRANT ALL ON public.shop_orders TO service_role;
DROP POLICY IF EXISTS shop_orders_read ON public.shop_orders;
CREATE POLICY shop_orders_read ON public.shop_orders FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS shop_orders_admin_update ON public.shop_orders;
CREATE POLICY shop_orders_admin_update ON public.shop_orders FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.guard_shop_order()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE
  _carrier text := NEW.carrier;
  _tracking text := NEW.tracking_number;
  _note text := NEW.admin_note;
  _status text := NEW.status;
  _user uuid := NEW.user_id;
BEGIN
  IF current_user NOT IN ('anon', 'authenticated') THEN
    RETURN NEW;
  END IF;
  NEW := OLD;
  NEW.carrier := nullif(btrim(_carrier), '');
  NEW.tracking_number := nullif(btrim(_tracking), '');
  NEW.admin_note := nullif(btrim(_note), '');
  IF _user = '00000000-0000-0000-0000-000000000000'::uuid THEN
    NEW.user_id := _user;
  END IF;
  IF _status IS DISTINCT FROM OLD.status THEN
    IF NOT OLD.has_physical THEN
      RAISE EXCEPTION 'Commande sans produit à expédier' USING ERRCODE = '23514';
    END IF;
    IF (OLD.status, _status) IN (('paid', 'shipped'), ('shipped', 'delivered'), ('shipped', 'paid'),
                                 ('delivered', 'shipped')) THEN
      NEW.status := _status;
      NEW.shipped_at := CASE WHEN _status = 'paid' THEN NULL
                             WHEN _status = 'shipped' THEN coalesce(OLD.shipped_at, now())
                             ELSE OLD.shipped_at END;
      NEW.delivered_at := CASE WHEN _status = 'delivered' THEN now() ELSE NULL END;
    ELSE
      RAISE EXCEPTION 'Changement de statut non autorisé : % vers %', OLD.status, _status
        USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS shop_orders_guard ON public.shop_orders;
CREATE TRIGGER shop_orders_guard BEFORE UPDATE ON public.shop_orders
  FOR EACH ROW EXECUTE FUNCTION public.guard_shop_order();
