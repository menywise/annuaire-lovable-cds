\set ON_ERROR_STOP 1
\i tests/db/_helpers.sql
BEGIN;
-- Socle 1.6.1 : correctifs issus de l'audit du 13/10 (messagerie privée, stock de la boutique).
-- b1 : membre · b2 : autre membre · b3 : tiers
INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-0000000000b1', 'un@test.fr'),
  ('00000000-0000-0000-0000-0000000000b2', 'deux@test.fr'),
  ('00000000-0000-0000-0000-0000000000b3', 'tiers@test.fr');

-- 1. Messagerie privée : messages et conversations verrouillés ----------------------------------------
SELECT pg_temp.as_user('00000000-0000-0000-0000-0000000000b1', 'un@test.fr');
INSERT INTO public.conversations (id, user_a, user_b) VALUES
  ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000b2');
RESET ROLE;
UPDATE public.conversations SET last_message_at = now() - interval '1 day'
  WHERE id = '00000000-0000-0000-0000-0000000000c1';

-- b1 écrit à b2 : l'envoi met toujours à jour la date du dernier message.
SELECT pg_temp.as_user('00000000-0000-0000-0000-0000000000b1', 'un@test.fr');
INSERT INTO public.messages (id, conversation_id, sender_id, content) VALUES
  ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000b1', 'Bonjour');
DO $$ BEGIN
  IF (SELECT last_message_at FROM public.conversations WHERE id = '00000000-0000-0000-0000-0000000000c1')
     < now() - interval '1 minute' THEN RAISE EXCEPTION 'last_message_at non mis à jour'; END IF;
END $$;
-- L'expéditeur ne marque pas son propre message comme lu.
UPDATE public.messages SET read_at = now() WHERE id = '00000000-0000-0000-0000-0000000000d1';
DO $$ BEGIN
  IF (SELECT read_at FROM public.messages WHERE id = '00000000-0000-0000-0000-0000000000d1') IS NOT NULL
  THEN RAISE EXCEPTION 'expéditeur marque son message comme lu'; END IF;
END $$;

-- b2 (destinataire) ne réécrit ni le texte, ni l'expéditeur, ni la date, ni la conversation.
SELECT pg_temp.as_user('00000000-0000-0000-0000-0000000000b2', 'deux@test.fr');
SELECT pg_temp.expect_error($$UPDATE public.messages SET content = 'Réécrit' WHERE id = '00000000-0000-0000-0000-0000000000d1'$$, 'destinataire réécrit le texte');
SELECT pg_temp.expect_error($$UPDATE public.messages SET sender_id = '00000000-0000-0000-0000-0000000000b2' WHERE id = '00000000-0000-0000-0000-0000000000d1'$$, 'destinataire change l''expéditeur');
SELECT pg_temp.expect_error($$UPDATE public.messages SET created_at = now() - interval '1 year' WHERE id = '00000000-0000-0000-0000-0000000000d1'$$, 'destinataire change la date');
SELECT pg_temp.expect_error($$UPDATE public.messages SET conversation_id = conversation_id WHERE id = '00000000-0000-0000-0000-0000000000d1'$$, 'destinataire change la conversation');
SELECT pg_temp.expect_error($$DELETE FROM public.messages WHERE id = '00000000-0000-0000-0000-0000000000d1'$$, 'destinataire supprime le message');
SELECT pg_temp.expect_error($$TRUNCATE public.messages$$, 'membre vide les messages');
-- Il marque toujours le message reçu comme lu (même requête que l'écran de messagerie).
UPDATE public.messages SET read_at = now()
  WHERE conversation_id = '00000000-0000-0000-0000-0000000000c1'
    AND sender_id <> '00000000-0000-0000-0000-0000000000b2' AND read_at IS NULL;
DO $$ BEGIN
  IF (SELECT read_at FROM public.messages WHERE id = '00000000-0000-0000-0000-0000000000d1') IS NULL
  THEN RAISE EXCEPTION 'destinataire ne marque plus comme lu'; END IF;
END $$;
-- Il ne remet pas un message lu à « non lu ».
SELECT pg_temp.expect_error($$UPDATE public.messages SET read_at = NULL WHERE id = '00000000-0000-0000-0000-0000000000d1'$$, 'destinataire remet à non lu');
RESET ROLE;
DO $$ BEGIN
  IF (SELECT read_at FROM public.messages WHERE id = '00000000-0000-0000-0000-0000000000d1') IS NULL
  THEN RAISE EXCEPTION 'message remis à non lu'; END IF;
  IF (SELECT content FROM public.messages WHERE id = '00000000-0000-0000-0000-0000000000d1') <> 'Bonjour'
  THEN RAISE EXCEPTION 'texte du message modifié'; END IF;
END $$;

-- Aucun participant ne change les membres ni la date d'une conversation.
SELECT pg_temp.as_user('00000000-0000-0000-0000-0000000000b2', 'deux@test.fr');
SELECT pg_temp.expect_error($$UPDATE public.conversations SET user_a = '00000000-0000-0000-0000-0000000000b3' WHERE id = '00000000-0000-0000-0000-0000000000c1'$$, 'participant remplace user_a');
SELECT pg_temp.expect_error($$UPDATE public.conversations SET user_b = '00000000-0000-0000-0000-0000000000b3' WHERE id = '00000000-0000-0000-0000-0000000000c1'$$, 'participant remplace user_b');
SELECT pg_temp.expect_error($$UPDATE public.conversations SET last_message_at = now() + interval '1 year' WHERE id = '00000000-0000-0000-0000-0000000000c1'$$, 'participant change last_message_at');
SELECT pg_temp.expect_error($$DELETE FROM public.conversations WHERE id = '00000000-0000-0000-0000-0000000000c1'$$, 'participant supprime la conversation');
SELECT pg_temp.expect_error($$TRUNCATE public.conversations CASCADE$$, 'membre vide les conversations');
-- Le tiers ne lit toujours rien.
SELECT pg_temp.as_user('00000000-0000-0000-0000-0000000000b3', 'tiers@test.fr');
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM public.conversations) OR EXISTS (SELECT 1 FROM public.messages)
  THEN RAISE EXCEPTION 'tiers lit la messagerie'; END IF;
END $$;
RESET ROLE;
DO $$ BEGIN
  IF has_table_privilege('authenticated', 'public.conversations', 'UPDATE')
     OR has_table_privilege('authenticated', 'public.messages', 'UPDATE')
     OR has_column_privilege('authenticated', 'public.messages', 'content', 'UPDATE')
     OR has_column_privilege('authenticated', 'public.messages', 'sender_id', 'UPDATE')
     OR has_column_privilege('authenticated', 'public.messages', 'created_at', 'UPDATE')
     OR has_column_privilege('authenticated', 'public.messages', 'conversation_id', 'UPDATE')
     OR NOT has_column_privilege('authenticated', 'public.messages', 'read_at', 'UPDATE')
  THEN RAISE EXCEPTION 'droits de modification de la messagerie'; END IF;
END $$;

-- 2. Boutique : stock réservé à la commande, rendu une seule fois, pas de double décompte ------------
-- e1 : objet en stock 1 · e2 : PDF (sans stock) · e3 : objet sans limite de stock
RESET ROLE;
UPDATE public.site_settings SET value = value || '{"shop": true}' WHERE key = 'modules';
UPDATE public.site_settings SET value = '{"shipping_cents": 0, "countries": ["FR"]}' WHERE key = 'shop';
INSERT INTO public.shop_products (id, slug, title, kind, price_cents, stock, published) VALUES
  ('00000000-0000-0000-0000-0000000000e1', 'carnet', 'Carnet', 'physique', 1000, 1, true),
  ('00000000-0000-0000-0000-0000000000e2', 'fiche-pdf', 'Fiche PDF', 'pdf', 500, NULL, true),
  ('00000000-0000-0000-0000-0000000000e3', 'affiche', 'Affiche', 'physique', 800, NULL, true);
INSERT INTO public.shop_product_files (product_id, path, file_name) VALUES
  ('00000000-0000-0000-0000-0000000000e2', 'produits/fiche.pdf', 'fiche.pdf');
CREATE FUNCTION pg_temp.stock() RETURNS integer LANGUAGE sql AS
  $$ SELECT stock FROM public.shop_products WHERE id = '00000000-0000-0000-0000-0000000000e1' $$;
-- Message lu par l'acheteur dans le panier.
CREATE FUNCTION pg_temp.refus(_user uuid, _items jsonb) RETURNS text LANGUAGE plpgsql AS $$
BEGIN
  PERFORM public.shop_start_checkout(_user, _items, false);
  RETURN NULL;
EXCEPTION WHEN check_violation THEN
  RETURN SQLERRM;
END $$;

-- b1 commande le dernier carnet : le stock est réservé tout de suite.
CREATE TEMP TABLE k1 AS SELECT * FROM public.shop_start_checkout('00000000-0000-0000-0000-0000000000b1',
  '[{"product_id":"00000000-0000-0000-0000-0000000000e1","quantity":1}]', false);
UPDATE public.payments SET stripe_session_id = 'cs_stock_1' WHERE id = (SELECT payment_id FROM k1);
DO $$ BEGIN
  IF pg_temp.stock() <> 0 THEN RAISE EXCEPTION 'stock non réservé : %', pg_temp.stock(); END IF;
  IF (SELECT reserved_quantity FROM public.shop_order_items WHERE order_id = (SELECT order_id FROM k1)) <> 1
  THEN RAISE EXCEPTION 'réserve de la ligne'; END IF;
END $$;
-- b2 commande ensuite le même carnet : refus lisible, aucune commande créée.
DO $$
DECLARE _m text := pg_temp.refus('00000000-0000-0000-0000-0000000000b2',
  '[{"product_id":"00000000-0000-0000-0000-0000000000e1","quantity":1}]');
BEGIN
  IF _m IS NULL THEN RAISE EXCEPTION 'seconde commande acceptée : survente'; END IF;
  IF _m <> '« Carnet » est épuisé : retirez-le du panier pour commander.' THEN RAISE EXCEPTION 'message : %', _m; END IF;
  IF EXISTS (SELECT 1 FROM public.shop_orders WHERE user_id = '00000000-0000-0000-0000-0000000000b2')
  THEN RAISE EXCEPTION 'commande refusée enregistrée'; END IF;
  IF pg_temp.stock() <> 0 THEN RAISE EXCEPTION 'stock après refus'; END IF;
END $$;

-- La session de b1 expire : le stock revient, une seule fois même si la restitution est rappelée.
DO $$ BEGIN
  IF NOT public.payment_mark_status('cs_stock_1', 'expired') THEN RAISE EXCEPTION 'expiration'; END IF;
  IF pg_temp.stock() <> 1 THEN RAISE EXCEPTION 'stock non rendu à l''expiration : %', pg_temp.stock(); END IF;
  IF public.shop_release_stock((SELECT order_id FROM k1)) THEN RAISE EXCEPTION 'restitution rejouée'; END IF;
  PERFORM public.shop_release_stock((SELECT order_id FROM k1));
  IF pg_temp.stock() <> 1 THEN RAISE EXCEPTION 'stock rendu deux fois : %', pg_temp.stock(); END IF;
END $$;

-- Commande remplacée par une nouvelle (deux onglets) : l'ancienne rend son stock d'abord.
CREATE TEMP TABLE k2 AS SELECT * FROM public.shop_start_checkout('00000000-0000-0000-0000-0000000000b2',
  '[{"product_id":"00000000-0000-0000-0000-0000000000e1","quantity":1}]', false);
CREATE TEMP TABLE k3 AS SELECT * FROM public.shop_start_checkout('00000000-0000-0000-0000-0000000000b2',
  '[{"product_id":"00000000-0000-0000-0000-0000000000e1","quantity":1}]', false);
UPDATE public.payments SET stripe_session_id = 'cs_stock_3' WHERE id = (SELECT payment_id FROM k3);
DO $$ BEGIN
  IF (SELECT status FROM public.shop_orders WHERE id = (SELECT order_id FROM k2)) <> 'expired' THEN RAISE EXCEPTION 'commande remplacée'; END IF;
  IF pg_temp.stock() <> 0 THEN RAISE EXCEPTION 'stock après remplacement : %', pg_temp.stock(); END IF;
  IF (SELECT reserved_quantity FROM public.shop_order_items WHERE order_id = (SELECT order_id FROM k2)) <> 0
  THEN RAISE EXCEPTION 'réserve de la commande remplacée'; END IF;
END $$;

-- Paiement de la commande réservée : le stock ne baisse pas une seconde fois.
DO $$ BEGIN
  IF NOT public.payment_mark_paid('cs_stock_3', 'pi_stock_3', (SELECT total_cents FROM k3), 'eur') THEN RAISE EXCEPTION 'paiement'; END IF;
  IF (SELECT status FROM public.shop_orders WHERE id = (SELECT order_id FROM k3)) <> 'paid' THEN RAISE EXCEPTION 'commande non payée'; END IF;
  IF pg_temp.stock() <> 0 THEN RAISE EXCEPTION 'stock décompté deux fois : %', pg_temp.stock(); END IF;
  IF public.shop_release_stock((SELECT order_id FROM k3)) THEN RAISE EXCEPTION 'commande payée restituée'; END IF;
END $$;

-- Quantité au-delà du stock : message qui donne le nombre restant.
UPDATE public.shop_products SET stock = 2 WHERE id = '00000000-0000-0000-0000-0000000000e1';
DO $$
DECLARE _m text := pg_temp.refus('00000000-0000-0000-0000-0000000000b1',
  '[{"product_id":"00000000-0000-0000-0000-0000000000e1","quantity":3}]');
BEGIN
  IF _m IS DISTINCT FROM 'Il reste 2 exemplaire(s) de « Carnet » : ajustez la quantité pour commander.'
  THEN RAISE EXCEPTION 'message : %', _m; END IF;
END $$;

-- Commande expirée puis payée quand même : la réserve rendue est décomptée au paiement.
CREATE TEMP TABLE k4 AS SELECT * FROM public.shop_start_checkout('00000000-0000-0000-0000-0000000000b1',
  '[{"product_id":"00000000-0000-0000-0000-0000000000e1","quantity":1}]', false);
UPDATE public.payments SET stripe_session_id = 'cs_stock_4' WHERE id = (SELECT payment_id FROM k4);
DO $$ BEGIN
  IF pg_temp.stock() <> 1 THEN RAISE EXCEPTION 'réserve k4'; END IF;
  PERFORM public.payment_mark_status('cs_stock_4', 'expired');
  IF pg_temp.stock() <> 2 THEN RAISE EXCEPTION 'restitution k4'; END IF;
  IF NOT public.payment_mark_paid('cs_stock_4', 'pi_stock_4', (SELECT total_cents FROM k4), 'eur') THEN RAISE EXCEPTION 'paiement tardif'; END IF;
  IF pg_temp.stock() <> 1 THEN RAISE EXCEPTION 'paiement tardif non décompté : %', pg_temp.stock(); END IF;
END $$;

-- Produits sans stock (PDF, objet sans limite) : aucun changement.
CREATE TEMP TABLE k5 AS SELECT * FROM public.shop_start_checkout('00000000-0000-0000-0000-0000000000b2',
  '[{"product_id":"00000000-0000-0000-0000-0000000000e2","quantity":1},{"product_id":"00000000-0000-0000-0000-0000000000e3","quantity":4}]', true);
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM public.shop_products WHERE id IN ('00000000-0000-0000-0000-0000000000e2', '00000000-0000-0000-0000-0000000000e3') AND stock IS NOT NULL)
  THEN RAISE EXCEPTION 'stock posé sur un produit sans stock'; END IF;
  IF EXISTS (SELECT 1 FROM public.shop_order_items WHERE order_id = (SELECT order_id FROM k5) AND reserved_quantity <> 0)
  THEN RAISE EXCEPTION 'réserve sur un produit sans stock'; END IF;
END $$;

-- Restitution réservée au serveur.
SELECT pg_temp.as_user('00000000-0000-0000-0000-0000000000b1', 'un@test.fr');
SELECT pg_temp.expect_error($$SELECT public.shop_release_stock('00000000-0000-0000-0000-0000000000e1')$$, 'membre rend du stock');
RESET ROLE;

-- Rejouable (toujours en dernier) ---------------------------------------------------------------------------------------
\i supabase/migrations/20261013120000_v1_6_1_correctifs_audit.sql
DO $$ BEGIN
  IF has_column_privilege('authenticated', 'public.messages', 'content', 'UPDATE')
     OR NOT has_column_privilege('authenticated', 'public.messages', 'read_at', 'UPDATE')
  THEN RAISE EXCEPTION 'rejeu de la messagerie'; END IF;
  IF pg_temp.stock() <> 1 THEN RAISE EXCEPTION 'rejeu : stock modifié'; END IF;
  IF (SELECT count(*) FROM pg_trigger WHERE tgname = 'shop_orders_release_stock') <> 1 THEN RAISE EXCEPTION 'rejeu : déclencheur'; END IF;
END $$;
ROLLBACK;
