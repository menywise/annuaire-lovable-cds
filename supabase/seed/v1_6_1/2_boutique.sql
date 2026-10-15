ALTER TABLE public.shop_order_items ADD COLUMN IF NOT EXISTS reserved_quantity integer NOT NULL DEFAULT 0;
ALTER TABLE public.shop_order_items DROP CONSTRAINT IF EXISTS shop_order_items_reserved_check;
ALTER TABLE public.shop_order_items ADD CONSTRAINT shop_order_items_reserved_check
  CHECK (reserved_quantity BETWEEN 0 AND quantity);
CREATE OR REPLACE FUNCTION public.shop_release_stock(_order_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM 1 FROM public.shop_orders o WHERE o.id = _order_id AND o.status = 'expired' FOR UPDATE;
  IF NOT FOUND THEN
    RETURN false;
  END IF;
  PERFORM 1 FROM public.shop_products sp
  WHERE sp.id IN (SELECT i.product_id FROM public.shop_order_items i
                  WHERE i.order_id = _order_id AND i.reserved_quantity > 0)
  ORDER BY sp.id
  FOR UPDATE OF sp;
  WITH rendu AS (
    SELECT i.id, i.product_id, i.reserved_quantity FROM public.shop_order_items i
    WHERE i.order_id = _order_id AND i.reserved_quantity > 0
    FOR UPDATE
  ), remis AS (
    UPDATE public.shop_order_items i SET reserved_quantity = 0 FROM rendu WHERE i.id = rendu.id
  )
  UPDATE public.shop_products sp SET stock = sp.stock + rendu.reserved_quantity
  FROM rendu WHERE sp.id = rendu.product_id AND sp.stock IS NOT NULL;
  RETURN FOUND;
END;
$$;
REVOKE ALL ON FUNCTION public.shop_release_stock(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.shop_release_stock(uuid) TO service_role;
CREATE OR REPLACE FUNCTION public.shop_orders_release_stock()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.shop_release_stock(NEW.id);
  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.shop_orders_release_stock() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS shop_orders_release_stock ON public.shop_orders;
CREATE TRIGGER shop_orders_release_stock AFTER UPDATE OF status ON public.shop_orders
  FOR EACH ROW WHEN (NEW.status = 'expired' AND OLD.status IS DISTINCT FROM 'expired')
  EXECUTE FUNCTION public.shop_orders_release_stock();
CREATE OR REPLACE FUNCTION public.shop_start_checkout(_user_id uuid, _items jsonb, _waiver boolean)
RETURNS TABLE (order_id uuid, order_number bigint, payment_id uuid, lines jsonb,
               shipping_cents integer, total_cents integer, currency text,
               countries text[], superseded_sessions text[])
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _settings jsonb;
  _item jsonb;
  _p record;
  _qty integer;
  _lines jsonb := '[]'::jsonb;
  _rows jsonb := '[]'::jsonb;
  _subtotal integer := 0;
  _shipping integer := 0;
  _physical boolean := false;
  _digital boolean := false;
  _free_from integer;
  _countries text[];
  _order uuid;
  _number bigint;
  _payment uuid;
  _old text[];
  _seen uuid[] := '{}';
BEGIN
  IF NOT public.module_enabled('shop') THEN
    RAISE EXCEPTION 'La boutique est fermée' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = _user_id) THEN
    RAISE EXCEPTION 'Compte inconnu' USING ERRCODE = '42501';
  END IF;
  IF jsonb_typeof(_items) <> 'array' OR jsonb_array_length(_items) = 0 THEN
    RAISE EXCEPTION 'Panier vide' USING ERRCODE = '22023';
  END IF;
  IF jsonb_array_length(_items) > 20 THEN
    RAISE EXCEPTION 'Vingt produits différents au plus par commande' USING ERRCODE = '22023';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('shop:' || _user_id::text, 0));
  PERFORM 1 FROM public.shop_products p
  WHERE p.id::text IN (SELECT value ->> 'product_id' FROM jsonb_array_elements(_items)
                       WHERE jsonb_typeof(value) = 'object')
     OR p.id IN (SELECT i.product_id FROM public.shop_order_items i
                 JOIN public.shop_orders o ON o.id = i.order_id
                 WHERE o.user_id = _user_id AND o.status = 'pending' AND i.reserved_quantity > 0)
  ORDER BY p.id
  FOR UPDATE OF p;
  WITH old_orders AS (
    UPDATE public.shop_orders o SET status = 'expired'
    WHERE o.user_id = _user_id AND o.status = 'pending'
    RETURNING o.id
  ), old AS (
    UPDATE public.payments p SET status = 'expired'
    WHERE p.order_id IN (SELECT id FROM old_orders) AND p.status = 'pending'
    RETURNING p.stripe_session_id
  )
  SELECT coalesce(array_agg(stripe_session_id) FILTER (WHERE stripe_session_id IS NOT NULL), '{}')
  INTO _old FROM old;
  FOR _item IN SELECT value FROM jsonb_array_elements(_items) LOOP
    IF jsonb_typeof(_item) <> 'object' OR coalesce(_item ->> 'product_id', '')
       !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
      RAISE EXCEPTION 'Produit inconnu' USING ERRCODE = '22023';
    END IF;
    SELECT p.id, p.title, p.kind, p.price_cents, p.stock INTO _p
    FROM public.shop_products p
    WHERE p.id = (_item ->> 'product_id')::uuid AND p.published;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Un produit du panier n''est plus en vente' USING ERRCODE = 'P0002';
    END IF;
    IF _p.id = ANY (_seen) THEN
      RAISE EXCEPTION 'Produit en double dans le panier' USING ERRCODE = '22023';
    END IF;
    _seen := _seen || _p.id;
    _qty := CASE WHEN coalesce(_item ->> 'quantity', '1') ~ '^[0-9]{1,3}$'
                 THEN (coalesce(_item ->> 'quantity', '1'))::integer ELSE 0 END;
    IF _p.kind <> 'physique' THEN
      _qty := 1;
      _digital := true;
      IF NOT EXISTS (SELECT 1 FROM public.shop_product_files f WHERE f.product_id = _p.id) THEN
        RAISE EXCEPTION 'Le fichier de « % » n''est pas encore disponible', _p.title USING ERRCODE = 'P0002';
      END IF;
      IF EXISTS (SELECT 1 FROM public.shop_order_items i JOIN public.shop_orders o ON o.id = i.order_id
                 WHERE o.user_id = _user_id AND i.product_id = _p.id
                   AND o.status IN ('paid', 'shipped', 'delivered')) THEN
        RAISE EXCEPTION 'Vous avez déjà acheté « % » : retrouvez-le dans vos achats', _p.title
          USING ERRCODE = '23505';
      END IF;
    ELSE
      _physical := true;
    END IF;
    IF _qty < 1 OR _qty > 10 THEN
      RAISE EXCEPTION 'Quantité entre 1 et 10' USING ERRCODE = '22023';
    END IF;
    IF _p.stock IS NOT NULL AND _p.stock = 0 THEN
      RAISE EXCEPTION '« % » est épuisé : retirez-le du panier pour commander.', _p.title
        USING ERRCODE = '23514';
    END IF;
    IF _p.stock IS NOT NULL AND _p.stock < _qty THEN
      RAISE EXCEPTION 'Il reste % exemplaire(s) de « % » : ajustez la quantité pour commander.',
        _p.stock, _p.title USING ERRCODE = '23514';
    END IF;
    _subtotal := _subtotal + _p.price_cents * _qty;
    _lines := _lines || jsonb_build_object('name', left(_p.title, 200), 'unit_amount', _p.price_cents,
                                           'quantity', _qty);
    _rows := _rows || jsonb_build_object('product_id', _p.id, 'title', left(_p.title, 200),
                                         'kind', _p.kind, 'unit', _p.price_cents, 'qty', _qty,
                                         'reserved', CASE WHEN _p.stock IS NULL THEN 0 ELSE _qty END);
  END LOOP;
  IF _digital AND _waiver IS NOT TRUE THEN
    RAISE EXCEPTION 'Renonciation au droit de rétractation requise pour les fichiers numériques'
      USING ERRCODE = '23514';
  END IF;
  SELECT value INTO _settings FROM public.site_settings WHERE key = 'shop';
  _settings := coalesce(_settings, '{}'::jsonb);
  IF _physical THEN
    _shipping := CASE WHEN coalesce(_settings ->> 'shipping_cents', '') ~ '^[0-9]{1,6}$'
                      THEN (_settings ->> 'shipping_cents')::integer ELSE 0 END;
    _free_from := CASE WHEN coalesce(_settings ->> 'free_shipping_from_cents', '') ~ '^[0-9]{1,8}$'
                       THEN (_settings ->> 'free_shipping_from_cents')::integer ELSE 0 END;
    IF _free_from > 0 AND _subtotal >= _free_from THEN
      _shipping := 0;
    END IF;
    SELECT coalesce(array_agg(DISTINCT upper(c)) FILTER (WHERE upper(c) ~ '^[A-Z]{2}$'), '{}')
    INTO _countries
    FROM jsonb_array_elements_text(
      CASE WHEN jsonb_typeof(_settings -> 'countries') = 'array' THEN _settings -> 'countries'
           ELSE '[]'::jsonb END) AS c;
    IF cardinality(_countries) = 0 THEN
      _countries := ARRAY['FR'];
    END IF;
  ELSE
    _countries := '{}';
  END IF;
  IF _subtotal + _shipping > 10000000 THEN
    RAISE EXCEPTION 'Montant trop élevé pour un paiement en ligne' USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.shop_orders (user_id, has_physical, has_digital, subtotal_cents, shipping_cents,
                                  total_cents, waiver_accepted_at)
  VALUES (_user_id, _physical, _digital, _subtotal, _shipping, _subtotal + _shipping,
          CASE WHEN _digital THEN now() END)
  RETURNING shop_orders.id, shop_orders.number INTO _order, _number;
  INSERT INTO public.shop_order_items (order_id, product_id, title, kind, unit_price_cents, quantity,
                                       reserved_quantity)
  SELECT _order, (r ->> 'product_id')::uuid, r ->> 'title', r ->> 'kind', (r ->> 'unit')::integer,
         (r ->> 'qty')::integer, (r ->> 'reserved')::integer
  FROM jsonb_array_elements(_rows) AS r;
  UPDATE public.shop_products sp SET stock = sp.stock - i.reserved_quantity
  FROM public.shop_order_items i
  WHERE i.order_id = _order AND i.product_id = sp.id AND i.reserved_quantity > 0
    AND sp.stock IS NOT NULL;
  IF _shipping > 0 THEN
    _lines := _lines || jsonb_build_object('name', 'Livraison', 'unit_amount', _shipping, 'quantity', 1);
  END IF;
  INSERT INTO public.payments (user_id, order_id, product_label, amount_cents, currency, waiver_accepted_at)
  VALUES (_user_id, _order, 'Commande n° ' || _number, _subtotal + _shipping, 'eur',
          CASE WHEN _digital THEN now() END)
  RETURNING payments.id INTO _payment;
  RETURN QUERY SELECT _order, _number, _payment, _lines, _shipping, _subtotal + _shipping,
                      'eur'::text, _countries, _old;
END;
$$;
CREATE OR REPLACE FUNCTION public.payment_mark_paid(_session_id text, _intent text, _amount integer, _currency text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _p record;
BEGIN
  UPDATE public.payments p
  SET status = 'paid', paid_at = now(), stripe_payment_intent = coalesce(nullif(_intent, ''), p.stripe_payment_intent)
  WHERE p.stripe_session_id = _session_id
    AND p.status IN ('pending', 'expired', 'failed')
    AND p.amount_cents = _amount
    AND p.currency = lower(_currency)
  RETURNING p.user_id, p.course_id, p.order_id INTO _p;
  IF NOT FOUND THEN
    RETURN false;
  END IF;
  IF _p.course_id IS NOT NULL THEN
    INSERT INTO public.lms_enrollments (user_id, course_id, paid_at)
    VALUES (_p.user_id, _p.course_id, now())
    ON CONFLICT (user_id, course_id) DO UPDATE SET paid_at = now();
  END IF;
  IF _p.order_id IS NOT NULL THEN
    UPDATE public.shop_orders SET status = 'paid', paid_at = now()
    WHERE id = _p.order_id AND status IN ('pending', 'expired');
    IF FOUND THEN
      PERFORM 1 FROM public.shop_products sp
      WHERE sp.id IN (SELECT i.product_id FROM public.shop_order_items i
                      WHERE i.order_id = _p.order_id AND i.reserved_quantity = 0)
        AND sp.stock IS NOT NULL
      ORDER BY sp.id
      FOR UPDATE OF sp;
      UPDATE public.shop_products sp SET stock = greatest(sp.stock - i.quantity, 0)
      FROM public.shop_order_items i
      WHERE i.order_id = _p.order_id AND i.product_id = sp.id AND i.reserved_quantity = 0
        AND sp.stock IS NOT NULL;
    END IF;
  END IF;
  RETURN true;
END;
$$;
