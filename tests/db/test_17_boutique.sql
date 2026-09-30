\set ON_ERROR_STOP 1
\i tests/db/_helpers.sql
BEGIN;
-- Module K « Boutique » : produits physiques et numériques, commande, paiement Stripe (webhook),
-- stock, téléchargements réservés à l'acheteur, expédition par l'admin, remboursement.
-- a1 : admin du studio · a2 : membre acheteur · a3 : autre membre
INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-0000000000a1', 'manuel.rohaut@gmail.com'),
  ('00000000-0000-0000-0000-0000000000a2', 'membre@test.fr'),
  ('00000000-0000-0000-0000-0000000000a3', 'autre@test.fr');
SELECT pg_temp.as_user('00000000-0000-0000-0000-0000000000a1', 'manuel.rohaut@gmail.com');
SELECT public.bootstrap_current_user('Manu');
SELECT pg_temp.as_user('00000000-0000-0000-0000-0000000000a2', 'membre@test.fr');
SELECT public.bootstrap_current_user('Membre');
SELECT pg_temp.as_user('00000000-0000-0000-0000-0000000000a3', 'autre@test.fr');
SELECT public.bootstrap_current_user('Autre');
RESET ROLE;

-- 1. Module éteint par défaut ; catalogue géré par l'admin ------------------------------------------
DO $$ BEGIN
  IF public.module_enabled('shop') THEN RAISE EXCEPTION 'shop devrait être éteint'; END IF;
  IF (SELECT value -> 'shipping_cents' FROM public.site_settings WHERE key = 'shop') IS NULL THEN
    RAISE EXCEPTION 'réglages de la boutique absents'; END IF;
END $$;

SELECT pg_temp.as_user('00000000-0000-0000-0000-0000000000a1', 'manuel.rohaut@gmail.com');
INSERT INTO public.shop_products (id, slug, title, kind, price_cents, stock, published) VALUES
  ('00000000-0000-0000-0000-0000000000b1', 'mug', 'Mug du studio', 'physique', 1500, 3, true),
  ('00000000-0000-0000-0000-0000000000b2', 'guide-pdf', 'Guide PDF', 'pdf', 900, 50, true),
  ('00000000-0000-0000-0000-0000000000b3', 'brouillon', 'Brouillon', 'physique', 1000, NULL, false),
  ('00000000-0000-0000-0000-0000000000b4', 'ebook-sans-fichier', 'Ebook sans fichier', 'ebook', 500, NULL, true);
INSERT INTO public.shop_product_files (product_id, path, file_name) VALUES
  ('00000000-0000-0000-0000-0000000000b2', 'produits/guide.pdf', 'guide.pdf');
DO $$ BEGIN
  -- Un fichier numérique n'a pas de stock.
  IF (SELECT stock FROM public.shop_products WHERE slug = 'guide-pdf') IS NOT NULL THEN
    RAISE EXCEPTION 'stock posé sur un produit numérique'; END IF;
END $$;
SELECT pg_temp.expect_error($$INSERT INTO public.shop_products (slug, title, price_cents) VALUES ('gratuit', 'Gratuit', 0)$$, 'prix nul');
SELECT pg_temp.expect_error($$INSERT INTO public.shop_products (slug, title, price_cents) VALUES ('Mauvais Slug', 'X', 100)$$, 'adresse invalide');
SELECT pg_temp.expect_error($$INSERT INTO public.shop_products (slug, title, price_cents, kind) VALUES ('x', 'X', 100, 'service')$$, 'type inconnu');

-- Membre et visiteur : aucune écriture ; boutique éteinte = catalogue invisible.
SELECT pg_temp.as_user('00000000-0000-0000-0000-0000000000a2', 'membre@test.fr');
SELECT pg_temp.expect_error($$INSERT INTO public.shop_products (slug, title, price_cents) VALUES ('pirate', 'Pirate', 100)$$, 'membre crée un produit');
DO $$ BEGIN
  UPDATE public.shop_products SET price_cents = 1 WHERE slug = 'mug';
  IF EXISTS (SELECT 1 FROM public.shop_products WHERE price_cents = 1) THEN RAISE EXCEPTION 'membre change un prix'; END IF;
  IF EXISTS (SELECT 1 FROM public.shop_products) THEN RAISE EXCEPTION 'catalogue visible boutique éteinte'; END IF;
  IF EXISTS (SELECT 1 FROM public.shop_product_files) THEN RAISE EXCEPTION 'fichier visible par un membre'; END IF;
END $$;
RESET ROLE;
UPDATE public.site_settings SET value = value || '{"shop": true}' WHERE key = 'modules';
UPDATE public.site_settings
SET value = '{"shipping_cents": 590, "free_shipping_from_cents": 5000, "countries": ["fr", "BE", "xx1"]}'
WHERE key = 'shop';
SELECT pg_temp.as_anon();
DO $$ BEGIN
  IF (SELECT count(*) FROM public.shop_products) <> 3 THEN RAISE EXCEPTION 'catalogue public : 3 produits publiés attendus'; END IF;
END $$;
SELECT pg_temp.expect_error($$SELECT * FROM public.shop_product_files$$, 'visiteur lit les fichiers');
SELECT pg_temp.expect_error($$SELECT * FROM public.shop_orders$$, 'visiteur lit les commandes');

-- 2. Démarrer une commande : réservé au serveur, tout est lu en base ---------------------------------
SELECT pg_temp.as_user('00000000-0000-0000-0000-0000000000a2', 'membre@test.fr');
SELECT pg_temp.expect_error($$SELECT public.shop_start_checkout('00000000-0000-0000-0000-0000000000a2', '[{"product_id":"00000000-0000-0000-0000-0000000000b1","quantity":1}]', true)$$, 'membre démarre une commande lui-même');
SELECT pg_temp.expect_error($$SELECT public.shop_download('00000000-0000-0000-0000-0000000000a2', gen_random_uuid())$$, 'membre télécharge sans le serveur');
RESET ROLE;

SELECT pg_temp.expect_error($$SELECT public.shop_start_checkout('00000000-0000-0000-0000-0000000000a2', '[]', true)$$, 'panier vide');
SELECT pg_temp.expect_error($$SELECT public.shop_start_checkout('00000000-0000-0000-0000-0000000000a2', '[{"product_id":"00000000-0000-0000-0000-0000000000b3","quantity":1}]', true)$$, 'produit non publié');
SELECT pg_temp.expect_error($$SELECT public.shop_start_checkout('00000000-0000-0000-0000-0000000000a2', '[{"product_id":"00000000-0000-0000-0000-0000000000b1","quantity":4}]', true)$$, 'stock insuffisant');
SELECT pg_temp.expect_error($$SELECT public.shop_start_checkout('00000000-0000-0000-0000-0000000000a2', '[{"product_id":"00000000-0000-0000-0000-0000000000b1","quantity":0}]', true)$$, 'quantité nulle');
SELECT pg_temp.expect_error($$SELECT public.shop_start_checkout('00000000-0000-0000-0000-0000000000a2', '[{"product_id":"00000000-0000-0000-0000-0000000000b1","quantity":"1; DROP"}]', true)$$, 'quantité non numérique');
SELECT pg_temp.expect_error($$SELECT public.shop_start_checkout('00000000-0000-0000-0000-0000000000a2', '[{"product_id":"00000000-0000-0000-0000-0000000000b1","quantity":1},{"product_id":"00000000-0000-0000-0000-0000000000b1","quantity":1}]', true)$$, 'produit en double');
SELECT pg_temp.expect_error($$SELECT public.shop_start_checkout('00000000-0000-0000-0000-0000000000a2', '[{"product_id":"00000000-0000-0000-0000-0000000000b2","quantity":1}]', false)$$, 'numérique sans renonciation');
SELECT pg_temp.expect_error($$SELECT public.shop_start_checkout('00000000-0000-0000-0000-0000000000a2', '[{"product_id":"00000000-0000-0000-0000-0000000000b4","quantity":1}]', true)$$, 'ebook sans fichier');
SELECT pg_temp.expect_error($$SELECT public.shop_start_checkout('00000000-0000-0000-0000-0000000000a2', '[{"product_id":"pas-un-uuid","quantity":1}]', true)$$, 'identifiant invalide');

-- Objet seul : pas de renonciation (droit de rétractation de 14 jours), livraison facturée.
CREATE TEMP TABLE c1 AS SELECT * FROM public.shop_start_checkout('00000000-0000-0000-0000-0000000000a2',
  '[{"product_id":"00000000-0000-0000-0000-0000000000b1","quantity":2}]', false);
DO $$ BEGIN
  IF (SELECT total_cents FROM c1) <> 3590 OR (SELECT shipping_cents FROM c1) <> 590 THEN RAISE EXCEPTION 'total objet : %', (SELECT total_cents FROM c1); END IF;
  IF (SELECT countries FROM c1) <> ARRAY['BE', 'FR'] THEN RAISE EXCEPTION 'pays de livraison : %', (SELECT countries FROM c1); END IF;
  IF jsonb_array_length((SELECT lines FROM c1)) <> 2 THEN RAISE EXCEPTION 'lignes Stripe : produit + livraison'; END IF;
  IF (SELECT waiver_accepted_at FROM public.payments WHERE id = (SELECT payment_id FROM c1)) IS NOT NULL THEN
    RAISE EXCEPTION 'renonciation datée pour un objet'; END IF;
END $$;
UPDATE public.payments SET stripe_session_id = 'cs_shop_1' WHERE id = (SELECT payment_id FROM c1);

-- Nouvelle commande avant paiement (deux onglets) : la précédente est remplacée, sa session à expirer.
CREATE TEMP TABLE c2 AS SELECT * FROM public.shop_start_checkout('00000000-0000-0000-0000-0000000000a2',
  '[{"product_id":"00000000-0000-0000-0000-0000000000b1","quantity":3},{"product_id":"00000000-0000-0000-0000-0000000000b2","quantity":5}]', true);
DO $$ BEGIN
  IF (SELECT superseded_sessions FROM c2) <> ARRAY['cs_shop_1'] THEN RAISE EXCEPTION 'session remplacée non rendue'; END IF;
  IF (SELECT status FROM public.shop_orders WHERE id = (SELECT order_id FROM c1)) <> 'expired' THEN RAISE EXCEPTION 'commande remplacée'; END IF;
  -- 3 x 15 € + 1 PDF (quantité ramenée à 1) = 54 € : livraison offerte dès 50 €.
  IF (SELECT total_cents FROM c2) <> 5400 OR (SELECT shipping_cents FROM c2) <> 0 THEN RAISE EXCEPTION 'total mixte : %', (SELECT total_cents FROM c2); END IF;
  IF (SELECT waiver_accepted_at FROM public.shop_orders WHERE id = (SELECT order_id FROM c2)) IS NULL THEN RAISE EXCEPTION 'renonciation non datée'; END IF;
  IF (SELECT sum(quantity) FROM public.shop_order_items WHERE order_id = (SELECT order_id FROM c2)) <> 4 THEN RAISE EXCEPTION 'lignes de commande'; END IF;
END $$;
UPDATE public.payments SET stripe_session_id = 'cs_shop_2' WHERE id = (SELECT payment_id FROM c2);
GRANT SELECT ON c1, c2 TO authenticated;

-- 3. Webhook : montant vérifié, idempotent, stock décompté, adresse enregistrée ----------------------
DO $$ BEGIN
  IF public.payment_mark_paid('cs_shop_2', 'pi_shop_2', 100, 'eur') THEN RAISE EXCEPTION 'montant différent accepté'; END IF;
  IF NOT public.payment_mark_paid('cs_shop_2', 'pi_shop_2', 5400, 'eur') THEN RAISE EXCEPTION 'paiement non enregistré'; END IF;
  IF public.payment_mark_paid('cs_shop_2', 'pi_shop_2', 5400, 'eur') THEN RAISE EXCEPTION 'paiement appliqué deux fois'; END IF;
  IF (SELECT status FROM public.shop_orders WHERE id = (SELECT order_id FROM c2)) <> 'paid' THEN RAISE EXCEPTION 'commande non payée'; END IF;
  IF (SELECT stock FROM public.shop_products WHERE slug = 'mug') <> 0 THEN RAISE EXCEPTION 'stock non décompté'; END IF;
  IF NOT public.shop_set_customer('cs_shop_2', 'membre@test.fr', 'Membre Test',
       '{"line1": "1 rue de la Paix", "postal_code": "75002", "city": "Paris", "country": "FR"}') THEN
    RAISE EXCEPTION 'adresse non enregistrée'; END IF;
  IF (SELECT shipping_address ->> 'city' FROM public.shop_orders WHERE id = (SELECT order_id FROM c2)) <> 'Paris' THEN
    RAISE EXCEPTION 'ville'; END IF;
END $$;
-- Stock épuisé : plus de commande possible.
SELECT pg_temp.expect_error($$SELECT public.shop_start_checkout('00000000-0000-0000-0000-0000000000a3', '[{"product_id":"00000000-0000-0000-0000-0000000000b1","quantity":1}]', false)$$, 'stock épuisé');
-- Fichier déjà acheté : pas de second achat.
SELECT pg_temp.expect_error($$SELECT public.shop_start_checkout('00000000-0000-0000-0000-0000000000a2', '[{"product_id":"00000000-0000-0000-0000-0000000000b2","quantity":1}]', true)$$, 'fichier acheté deux fois');

-- 4. Téléchargement : acheteur seulement, compteur, limite ------------------------------------------
DO $$
DECLARE
  _item uuid := (SELECT id FROM public.shop_order_items WHERE order_id = (SELECT order_id FROM c2) AND kind = 'pdf');
  _mug uuid := (SELECT id FROM public.shop_order_items WHERE order_id = (SELECT order_id FROM c2) AND kind = 'physique');
BEGIN
  IF (SELECT path FROM public.shop_download('00000000-0000-0000-0000-0000000000a2', _item)) <> 'produits/guide.pdf' THEN
    RAISE EXCEPTION 'chemin du fichier'; END IF;
  BEGIN
    PERFORM public.shop_download('00000000-0000-0000-0000-0000000000a3', _item);
    RAISE EXCEPTION 'un autre membre télécharge l''achat';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    PERFORM public.shop_download('00000000-0000-0000-0000-0000000000a2', _mug);
    RAISE EXCEPTION 'objet physique téléchargé';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  UPDATE public.shop_order_items SET downloads = 20 WHERE id = _item;
  BEGIN
    PERFORM public.shop_download('00000000-0000-0000-0000-0000000000a2', _item);
    RAISE EXCEPTION 'limite de téléchargements ignorée';
  EXCEPTION WHEN program_limit_exceeded THEN NULL;
  END;
  UPDATE public.shop_order_items SET downloads = 1 WHERE id = _item;
END $$;

-- 5. Lecture et expédition ----------------------------------------------------------------------------
SELECT pg_temp.as_user('00000000-0000-0000-0000-0000000000a3', 'autre@test.fr');
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM public.shop_orders) OR EXISTS (SELECT 1 FROM public.shop_order_items) THEN
    RAISE EXCEPTION 'commande d''autrui visible'; END IF;
END $$;
SELECT pg_temp.as_user('00000000-0000-0000-0000-0000000000a2', 'membre@test.fr');
DO $$ BEGIN
  IF (SELECT count(*) FROM public.shop_orders) <> 2 THEN RAISE EXCEPTION 'le membre voit ses 2 commandes'; END IF;
  IF (SELECT count(*) FROM public.shop_order_items) <> 3 THEN RAISE EXCEPTION 'le membre voit ses lignes'; END IF;
  UPDATE public.shop_orders SET status = 'shipped', total_cents = 1 WHERE id = (SELECT order_id FROM c2);
  IF (SELECT status FROM public.shop_orders WHERE id = (SELECT order_id FROM c2)) <> 'paid' THEN
    RAISE EXCEPTION 'le membre expédie sa commande'; END IF;
END $$;
SELECT pg_temp.as_user('00000000-0000-0000-0000-0000000000a1', 'manuel.rohaut@gmail.com');
-- L'admin ne touche ni aux montants ni aux lignes : seulement l'expédition et sa note.
UPDATE public.shop_orders SET status = 'shipped', carrier = ' Colissimo ', tracking_number = '6A123',
  total_cents = 1, shipping_address = '{}' WHERE id = (SELECT order_id FROM c2);
DO $$ BEGIN
  IF (SELECT status FROM public.shop_orders WHERE id = (SELECT order_id FROM c2)) <> 'shipped' THEN RAISE EXCEPTION 'expédition'; END IF;
  IF (SELECT carrier FROM public.shop_orders WHERE id = (SELECT order_id FROM c2)) <> 'Colissimo' THEN RAISE EXCEPTION 'transporteur'; END IF;
  IF (SELECT shipped_at FROM public.shop_orders WHERE id = (SELECT order_id FROM c2)) IS NULL THEN RAISE EXCEPTION 'date d''expédition'; END IF;
  IF (SELECT total_cents FROM public.shop_orders WHERE id = (SELECT order_id FROM c2)) <> 5400 THEN RAISE EXCEPTION 'montant modifié par l''admin'; END IF;
  IF (SELECT shipping_address ->> 'city' FROM public.shop_orders WHERE id = (SELECT order_id FROM c2)) <> 'Paris' THEN RAISE EXCEPTION 'adresse modifiée par l''admin'; END IF;
END $$;
SELECT pg_temp.expect_error($$UPDATE public.shop_orders SET status = 'refunded' WHERE id = (SELECT order_id FROM c2)$$, 'admin rembourse hors Stripe');
SELECT pg_temp.expect_error($$UPDATE public.shop_orders SET status = 'shipped' WHERE id = (SELECT order_id FROM c1)$$, 'expédier une commande abandonnée');
SELECT pg_temp.expect_error($$DELETE FROM public.shop_orders WHERE id = (SELECT order_id FROM c2)$$, 'admin supprime une commande');
UPDATE public.shop_orders SET status = 'delivered' WHERE id = (SELECT order_id FROM c2);
RESET ROLE;

-- 6. Remboursement (tableau de bord Stripe) : téléchargements fermés ----------------------------------
DO $$
DECLARE
  _item uuid := (SELECT id FROM public.shop_order_items WHERE order_id = (SELECT order_id FROM c2) AND kind = 'pdf');
BEGIN
  IF NOT public.payment_mark_refunded('pi_shop_2') THEN RAISE EXCEPTION 'remboursement'; END IF;
  IF (SELECT status FROM public.shop_orders WHERE id = (SELECT order_id FROM c2)) <> 'refunded' THEN RAISE EXCEPTION 'commande non remboursée'; END IF;
  BEGIN
    PERFORM public.shop_download('00000000-0000-0000-0000-0000000000a2', _item);
    RAISE EXCEPTION 'téléchargement après remboursement';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;

-- Session expirée : commande en attente abandonnée.
CREATE TEMP TABLE c3 AS SELECT * FROM public.shop_start_checkout('00000000-0000-0000-0000-0000000000a3',
  '[{"product_id":"00000000-0000-0000-0000-0000000000b2","quantity":1}]', true);
UPDATE public.payments SET stripe_session_id = 'cs_shop_3' WHERE id = (SELECT payment_id FROM c3);
DO $$ BEGIN
  IF NOT public.payment_mark_status('cs_shop_3', 'expired') THEN RAISE EXCEPTION 'expiration'; END IF;
  IF (SELECT status FROM public.shop_orders WHERE id = (SELECT order_id FROM c3)) <> 'expired' THEN RAISE EXCEPTION 'commande non abandonnée'; END IF;
END $$;

-- 7. Boutique fermée : plus de commande --------------------------------------------------------------
UPDATE public.site_settings SET value = value || '{"shop": false}' WHERE key = 'modules';
SELECT pg_temp.expect_error($$SELECT public.shop_start_checkout('00000000-0000-0000-0000-0000000000a3', '[{"product_id":"00000000-0000-0000-0000-0000000000b2","quantity":1}]', true)$$, 'boutique fermée');

-- 8. Suppression du compte : commandes conservées et anonymisées -------------------------------------
SELECT pg_temp.as_user('00000000-0000-0000-0000-0000000000a2', 'membre@test.fr');
SELECT public.delete_my_account();
RESET ROLE;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM public.shop_orders WHERE user_id = '00000000-0000-0000-0000-0000000000a2') THEN
    RAISE EXCEPTION 'commande non anonymisée'; END IF;
  IF (SELECT count(*) FROM public.shop_orders WHERE user_id = '00000000-0000-0000-0000-000000000000') <> 2 THEN
    RAISE EXCEPTION 'commandes supprimées au lieu d''être anonymisées'; END IF;
END $$;
ROLLBACK;
