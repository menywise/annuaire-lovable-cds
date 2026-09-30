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
      UPDATE public.shop_products sp SET stock = greatest(sp.stock - i.quantity, 0)
      FROM public.shop_order_items i
      WHERE i.order_id = _p.order_id AND i.product_id = sp.id AND sp.stock IS NOT NULL;
    END IF;
  END IF;
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.payment_mark_status(_session_id text, _status text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _order uuid;
BEGIN
  IF _status NOT IN ('failed', 'expired') THEN
    RAISE EXCEPTION 'Statut non autorisé : %', _status USING ERRCODE = '22023';
  END IF;
  UPDATE public.payments SET status = _status
  WHERE stripe_session_id = _session_id AND status = 'pending'
  RETURNING order_id INTO _order;
  IF NOT FOUND THEN
    RETURN false;
  END IF;
  IF _order IS NOT NULL THEN
    UPDATE public.shop_orders SET status = 'expired' WHERE id = _order AND status = 'pending';
  END IF;
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.payment_mark_refunded(_intent text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _p record;
BEGIN
  UPDATE public.payments p SET status = 'refunded', refunded_at = now()
  WHERE p.stripe_payment_intent = _intent AND p.status = 'paid'
  RETURNING p.user_id, p.course_id, p.order_id INTO _p;
  IF NOT FOUND THEN
    RETURN false;
  END IF;
  IF _p.course_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.payments o
    WHERE o.user_id = _p.user_id AND o.course_id = _p.course_id AND o.status = 'paid'
  ) THEN
    UPDATE public.lms_enrollments SET paid_at = NULL
    WHERE user_id = _p.user_id AND course_id = _p.course_id;
  END IF;
  IF _p.order_id IS NOT NULL THEN
    UPDATE public.shop_orders SET status = 'refunded', refunded_at = now() WHERE id = _p.order_id;
  END IF;
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.payment_mark_paid(text, text, integer, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.payment_mark_status(text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.payment_mark_refunded(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.payment_mark_paid(text, text, integer, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.payment_mark_status(text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.payment_mark_refunded(text) TO service_role;
