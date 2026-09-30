CREATE OR REPLACE FUNCTION public.shop_set_customer(_session_id text, _email text, _name text, _address jsonb)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.shop_orders o
  SET email = coalesce(left(nullif(_email, ''), 320), o.email),
      shipping_name = coalesce(left(nullif(_name, ''), 200), o.shipping_name),
      shipping_address = CASE WHEN jsonb_typeof(_address) = 'object' THEN _address ELSE o.shipping_address END
  FROM public.payments p
  WHERE p.stripe_session_id = _session_id AND p.order_id = o.id;
  RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION public.shop_download(_user_id uuid, _item_id uuid)
RETURNS TABLE (path text, file_name text, downloads integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _i record;
BEGIN
  SELECT i.id, i.product_id, i.downloads INTO _i
  FROM public.shop_order_items i JOIN public.shop_orders o ON o.id = i.order_id
  WHERE i.id = _item_id AND o.user_id = _user_id AND i.kind <> 'physique'
    AND o.status IN ('paid', 'shipped', 'delivered')
  FOR UPDATE OF i;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Achat introuvable' USING ERRCODE = '42501';
  END IF;
  IF _i.downloads >= 20 THEN
    RAISE EXCEPTION 'Limite de 20 téléchargements atteinte : écrivez-nous pour la relever'
      USING ERRCODE = '54000';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.shop_product_files f WHERE f.product_id = _i.product_id) THEN
    RAISE EXCEPTION 'Fichier indisponible : écrivez-nous' USING ERRCODE = 'P0002';
  END IF;
  UPDATE public.shop_order_items SET downloads = shop_order_items.downloads + 1 WHERE id = _i.id;
  RETURN QUERY SELECT f.path, f.file_name, _i.downloads + 1
  FROM public.shop_product_files f WHERE f.product_id = _i.product_id;
END;
$$;

REVOKE ALL ON FUNCTION public.shop_start_checkout(uuid, jsonb, boolean) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.shop_set_customer(text, text, text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.shop_download(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.shop_start_checkout(uuid, jsonb, boolean) TO service_role;
GRANT EXECUTE ON FUNCTION public.shop_set_customer(text, text, text, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.shop_download(uuid, uuid) TO service_role;
