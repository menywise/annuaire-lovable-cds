-- V0 · Module K « Boutique » : produits physiques, PDF et livres numériques, payés par Stripe.
-- S'appuie sur le module D (table payments, webhook signé, clés en secrets d'environnement).
-- Rejouable sans danger. Écrit pour l'éditeur SQL de Lovable : ni antislash ni opérateur « ? ».
--
-- Règles :
-- - le prix, la livraison et le stock sont lus en base au moment du paiement, jamais envoyés par le navigateur ;
-- - un fichier numérique ne se télécharge que par un lien signé de quelques minutes, créé par le serveur
--   pour l'acheteur d'une commande payée ; l'espace de stockage est privé ;
-- - commandes et paiements sont des pièces comptables : jamais supprimés, anonymisés avec le compte.

-- 1. Module « shop » (éteint par défaut, sans dépendance) ------------------------------------------
-- Même liste que src/config/modules.ts (25 modules).
CREATE OR REPLACE FUNCTION public.module_defaults()
RETURNS jsonb LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT '{
    "blog": true, "faq": true, "contact": true, "newsletter": true, "forum": true,
    "members": true, "messaging": true, "testimonials": true, "reviews": true, "pricing": true,
    "onboarding": true, "directory": false, "geo": false, "crm": false, "lms": false,
    "marketplace": false, "adNetwork": false, "studio": true, "showcase": true,
    "media": true, "pages": false, "payments": false, "reports": true, "search": true,
    "shop": false
  }'::jsonb
$$;
GRANT EXECUTE ON FUNCTION public.module_defaults() TO anon, authenticated, service_role;

INSERT INTO public.site_settings (key, value) VALUES ('modules', public.module_defaults())
  ON CONFLICT (key) DO UPDATE
  SET value = public.module_defaults() || (
    SELECT coalesce(jsonb_object_agg(k, v), '{}'::jsonb)
    FROM jsonb_each(public.site_settings.value) AS e(k, v)
    WHERE (public.module_defaults() -> k) IS NOT NULL
  );

-- Réglages de la boutique (lus par tous : le visiteur voit le prix de la livraison).
INSERT INTO public.site_settings (key, value)
VALUES ('shop', '{"shipping_cents": 590, "free_shipping_from_cents": 0, "countries": ["FR"]}'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- 2. Produits ---------------------------------------------------------------------------------------
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
  -- Un produit numérique n'a pas de stock.
  IF NEW.kind <> 'physique' THEN
    NEW.stock := NULL;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS shop_products_touch ON public.shop_products;
CREATE TRIGGER shop_products_touch BEFORE INSERT OR UPDATE ON public.shop_products
  FOR EACH ROW EXECUTE FUNCTION public.shop_products_touch();

-- Fichier livré d'un produit numérique : chemin dans l'espace privé, jamais lisible par le public.
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

-- 3. Espace de stockage privé des fichiers vendus (50 Mo par fichier) -----------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('shop-files', 'shop-files', false, 52428800,
        ARRAY['application/pdf', 'application/epub+zip', 'application/zip'])
ON CONFLICT (id) DO UPDATE
  SET public = false,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS shop_files_admin_read ON storage.objects;
CREATE POLICY shop_files_admin_read ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'shop-files' AND public.has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS shop_files_admin_insert ON storage.objects;
CREATE POLICY shop_files_admin_insert ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'shop-files' AND public.has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS shop_files_admin_update ON storage.objects;
CREATE POLICY shop_files_admin_update ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'shop-files' AND public.has_role(auth.uid(), 'admin'))
  WITH CHECK (bucket_id = 'shop-files' AND public.has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS shop_files_admin_delete ON storage.objects;
CREATE POLICY shop_files_admin_delete ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'shop-files' AND public.has_role(auth.uid(), 'admin'));

-- 4. Commandes ---------------------------------------------------------------------------------------
-- Écrites par le serveur (clé de service). L'admin ne change que l'expédition et sa note.
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

-- Mise à jour par l'admin : seulement l'expédition (payée → expédiée → livrée) et la note.
-- Le serveur (clé de service) et les fonctions de la base gardent la main sur tout le reste :
-- la garde ne s'applique qu'aux requêtes venues du navigateur (rôles anon et authenticated).
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
  -- Seule anonymisation permise : identifiant neutre (suppression de compte).
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

-- Paiements : une tentative peut porter sur une commande ; la renonciation n'est due que
-- pour un contenu numérique (formation, fichier), pas pour un objet expédié.
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS order_id uuid;
ALTER TABLE public.payments DROP CONSTRAINT IF EXISTS payments_order_id_fkey;
ALTER TABLE public.payments ADD CONSTRAINT payments_order_id_fkey
  FOREIGN KEY (order_id) REFERENCES public.shop_orders(id) ON DELETE SET NULL;
ALTER TABLE public.payments ALTER COLUMN waiver_accepted_at DROP NOT NULL;
CREATE INDEX IF NOT EXISTS payments_order_idx ON public.payments (order_id);

-- 5. Démarrer une commande (serveur) -----------------------------------------------------------------
-- _items : [{"product_id": "…", "quantity": 2}, …]. Prix, livraison et stock lus ici.
-- Une nouvelle commande remplace la commande en attente du même membre (sessions Stripe à expirer).
DROP FUNCTION IF EXISTS public.shop_start_checkout(uuid, jsonb, boolean);
CREATE FUNCTION public.shop_start_checkout(_user_id uuid, _items jsonb, _waiver boolean)
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
  -- Une seule commande en préparation à la fois par membre (deux onglets = file d'attente).
  PERFORM pg_advisory_xact_lock(hashtextextended('shop:' || _user_id::text, 0));

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
    IF _p.stock IS NOT NULL AND _p.stock < _qty THEN
      RAISE EXCEPTION 'Stock insuffisant pour « % » (% disponible)', _p.title, _p.stock
        USING ERRCODE = '23514';
    END IF;
    _subtotal := _subtotal + _p.price_cents * _qty;
    _lines := _lines || jsonb_build_object('name', left(_p.title, 200), 'unit_amount', _p.price_cents,
                                           'quantity', _qty);
    _rows := _rows || jsonb_build_object('product_id', _p.id, 'title', left(_p.title, 200),
                                         'kind', _p.kind, 'unit', _p.price_cents, 'qty', _qty);
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

  -- Commande en attente précédente : remplacée ; ses sessions Stripe sont à expirer.
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

  INSERT INTO public.shop_orders (user_id, has_physical, has_digital, subtotal_cents, shipping_cents,
                                  total_cents, waiver_accepted_at)
  VALUES (_user_id, _physical, _digital, _subtotal, _shipping, _subtotal + _shipping,
          CASE WHEN _digital THEN now() END)
  RETURNING shop_orders.id, shop_orders.number INTO _order, _number;

  INSERT INTO public.shop_order_items (order_id, product_id, title, kind, unit_price_cents, quantity)
  SELECT _order, (r ->> 'product_id')::uuid, r ->> 'title', r ->> 'kind', (r ->> 'unit')::integer,
         (r ->> 'qty')::integer
  FROM jsonb_array_elements(_rows) AS r;

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

-- Adresse de livraison et e-mail relevés par Stripe (webhook signé).
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

-- Téléchargement d'un fichier acheté : contrôle, compteur, chemin rendu au serveur qui signe le lien.
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

-- 6. Webhook : paiement, échec, remboursement étendus aux commandes --------------------------------
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
    -- Payée même si remplacée entre-temps : l'argent est encaissé, la commande est due.
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
  -- Commande remboursée : les téléchargements se ferment ; le stock n'est pas remis (retour à constater).
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

-- 7. Suppression de son compte : commandes anonymisées (pièces comptables) ------------------------
CREATE OR REPLACE FUNCTION public.delete_my_account()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid uuid := auth.uid();
  _ghost constant uuid := '00000000-0000-0000-0000-000000000000';
  _name constant text := 'Ancien membre';
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Non authentifié' USING ERRCODE = '42501';
  END IF;
  IF public.has_role(_uid, 'admin')
     AND NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin' AND user_id <> _uid) THEN
    RAISE EXCEPTION 'Vous êtes le dernier administrateur : nommez-en un autre avant de partir' USING ERRCODE = '42501';
  END IF;

  UPDATE public.forum_topics SET author_id = _ghost, author_name = _name WHERE author_id = _uid;
  UPDATE public.forum_replies SET author_id = _ghost, author_name = _name WHERE author_id = _uid;
  UPDATE public.blog_comments SET author_id = _ghost, author_name = _name WHERE author_id = _uid;
  UPDATE public.reviews SET author_id = _ghost, author_name = _name WHERE author_id = _uid;
  UPDATE public.directory_reviews SET author_id = _ghost, author_name = _name WHERE author_id = _uid;
  UPDATE public.testimonials SET author_id = NULL, author_name = _name WHERE author_id = _uid;
  UPDATE public.blog_posts SET author_id = NULL WHERE author_id = _uid;
  UPDATE public.directory_listings SET created_by = NULL WHERE created_by = _uid;
  UPDATE public.directory_listings SET claimed_by = NULL WHERE claimed_by = _uid;
  UPDATE public.directory_listings SET claim_requested_by = NULL WHERE claim_requested_by = _uid;
  UPDATE public.site_settings SET updated_by = NULL WHERE updated_by = _uid;
  UPDATE public.payments SET user_id = _ghost WHERE user_id = _uid;
  UPDATE public.shop_orders SET user_id = _ghost WHERE user_id = _uid;
  UPDATE public.reports SET reporter_id = _ghost WHERE reporter_id = _uid;
  UPDATE public.reports SET handled_by = NULL WHERE handled_by = _uid;

  DELETE FROM public.forum_likes WHERE user_id = _uid;
  DELETE FROM public.forum_follows WHERE user_id = _uid;
  DELETE FROM public.conversations WHERE user_a = _uid OR user_b = _uid;
  DELETE FROM public.messages WHERE sender_id = _uid;
  DELETE FROM public.marketplace_listings WHERE seller_id = _uid;
  DELETE FROM public.crm_interactions WHERE owner_id = _uid;
  DELETE FROM public.crm_actions WHERE owner_id = _uid;
  DELETE FROM public.crm_prospects WHERE owner_id = _uid;
  DELETE FROM public.lms_progress WHERE user_id = _uid;
  DELETE FROM public.lms_enrollments WHERE user_id = _uid;
  DELETE FROM public.member_profiles WHERE user_id = _uid;
  DELETE FROM public.user_roles WHERE user_id = _uid;
  DELETE FROM public.profiles WHERE id = _uid;
  DELETE FROM auth.users WHERE id = _uid;
END;
$$;
REVOKE ALL ON FUNCTION public.delete_my_account() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_my_account() TO authenticated;

-- 8. Grille de conformité -------------------------------------------------------------------------------
INSERT INTO public.template_checks (code, area, label, requirement, status, severity, evidence, position)
SELECT v.code, v.area, v.label, v.requirement, v.status, v.severity, v.evidence,
       coalesce((SELECT max(position) FROM public.template_checks), 0) + v.n
FROM (VALUES
  (1, 'V0-K-BOUTIQUE', 'Modules', 'Boutique : objets, PDF et livres numériques',
   'Prix, livraison et stock lus en base au paiement ; fichiers dans un espace privé, liens signés de 5 minutes réservés à l''acheteur ; commande conservée et anonymisée avec le compte.',
   'a_verifier', 'bloquant', 'tests/db/test_17 ; à dérouler en mode test Stripe (carte 4242…)')
) AS v(n, code, area, label, requirement, status, severity, evidence)
ON CONFLICT (code) DO NOTHING;
