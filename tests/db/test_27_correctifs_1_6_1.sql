\set ON_ERROR_STOP 1
\i tests/db/_helpers.sql
BEGIN;
-- Socle 1.6.1 : correctifs issus de l'audit du 13/10 (messagerie privée, stock de la boutique, forum,
-- formulaires ouverts aux visiteurs).
-- b1 : membre · b2 : autre membre · b3 : tiers · b4 : administrateur (section 3)
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

-- 3. Forum : garde-fous à la création -----------------------------------------------------------------
INSERT INTO auth.users (id, email) VALUES ('00000000-0000-0000-0000-0000000000b4', 'admin@test.fr');
INSERT INTO public.user_roles (user_id, role) VALUES ('00000000-0000-0000-0000-0000000000b4', 'admin')
  ON CONFLICT DO NOTHING;
-- b1 : nom dans le profil membre · b2 : nom du compte seulement · b3 : aucun nom.
INSERT INTO public.profiles (id, email, full_name) VALUES
  ('00000000-0000-0000-0000-0000000000b1', 'un@test.fr', 'Compte Un'),
  ('00000000-0000-0000-0000-0000000000b2', 'deux@test.fr', 'Compte Deux'),
  ('00000000-0000-0000-0000-0000000000b3', 'tiers@test.fr', NULL)
  ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name;
INSERT INTO public.member_profiles (user_id, display_name) VALUES
  ('00000000-0000-0000-0000-0000000000b1', 'Membre Un'),
  ('00000000-0000-0000-0000-0000000000b2', 'Membre')
  ON CONFLICT (user_id) DO UPDATE SET display_name = EXCLUDED.display_name;
DELETE FROM public.member_profiles WHERE user_id = '00000000-0000-0000-0000-0000000000b3';

-- Un membre crée un sujet avec des vues gonflées, des dates truquées, un verrou et un nom d'emprunt.
SELECT pg_temp.as_user('00000000-0000-0000-0000-0000000000b1', 'un@test.fr');
INSERT INTO public.forum_topics (id, author_id, author_name, title, content, views, locked, created_at, updated_at, last_activity_at) VALUES
  ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000b1', 'Admin officiel', 'Sujet truqué', 'Texte',
   999999, true, '2001-01-01', '2099-01-01', '2099-01-01');
RESET ROLE;
DO $$
DECLARE _t public.forum_topics;
BEGIN
  SELECT * INTO _t FROM public.forum_topics WHERE id = '00000000-0000-0000-0000-0000000000f1';
  IF _t.views <> 0 THEN RAISE EXCEPTION 'sujet : vues %', _t.views; END IF;
  IF _t.locked THEN RAISE EXCEPTION 'sujet : créé verrouillé'; END IF;
  IF _t.last_activity_at <> now() THEN RAISE EXCEPTION 'sujet : date d''activité %', _t.last_activity_at; END IF;
  IF _t.created_at <> now() OR _t.updated_at <> now() THEN RAISE EXCEPTION 'sujet : dates'; END IF;
  IF _t.author_name <> 'Membre Un' THEN RAISE EXCEPTION 'sujet : nom %', _t.author_name; END IF;
  IF _t.title <> 'Sujet truqué' OR _t.content <> 'Texte' THEN RAISE EXCEPTION 'sujet : contenu modifié'; END IF;
END $$;
-- Un membre n'ouvre toujours pas un sujet au nom d'un autre.
SELECT pg_temp.as_user('00000000-0000-0000-0000-0000000000b1', 'un@test.fr');
SELECT pg_temp.expect_error($$INSERT INTO public.forum_topics (author_id, title, content) VALUES ('00000000-0000-0000-0000-0000000000b2', 'Usurpé', 'Texte')$$, 'sujet au nom d''un autre');

-- b2 répond au sujet de b1 : réponse « retenue », date et nom truqués.
SELECT pg_temp.as_user('00000000-0000-0000-0000-0000000000b2', 'deux@test.fr');
INSERT INTO public.forum_replies (id, topic_id, author_id, author_name, content, accepted, created_at) VALUES
  ('00000000-0000-0000-0000-0000000000f2', '00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000b2',
   'Admin officiel', 'Réponse', true, '2099-01-01');
-- b3, sans aucun nom en base : « Membre ».
SELECT pg_temp.as_user('00000000-0000-0000-0000-0000000000b3', 'tiers@test.fr');
INSERT INTO public.forum_replies (id, topic_id, author_id, author_name, content) VALUES
  ('00000000-0000-0000-0000-0000000000f3', '00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000b3',
   'Admin officiel', 'Autre réponse');
RESET ROLE;
DO $$
DECLARE _r public.forum_replies;
BEGIN
  SELECT * INTO _r FROM public.forum_replies WHERE id = '00000000-0000-0000-0000-0000000000f2';
  IF _r.accepted THEN RAISE EXCEPTION 'réponse : créée retenue'; END IF;
  IF _r.created_at <> now() THEN RAISE EXCEPTION 'réponse : date %', _r.created_at; END IF;
  -- Profil membre resté au nom par défaut : le nom du compte s'affiche.
  IF _r.author_name <> 'Compte Deux' THEN RAISE EXCEPTION 'réponse : nom %', _r.author_name; END IF;
  IF _r.content <> 'Réponse' THEN RAISE EXCEPTION 'réponse : contenu modifié'; END IF;
  IF (SELECT author_name FROM public.forum_replies WHERE id = '00000000-0000-0000-0000-0000000000f3') <> 'Membre'
  THEN RAISE EXCEPTION 'réponse : nom sans profil'; END IF;
END $$;
-- L'auteur du sujet retient toujours une réponse après coup.
SELECT pg_temp.as_user('00000000-0000-0000-0000-0000000000b1', 'un@test.fr');
UPDATE public.forum_replies SET accepted = true WHERE id = '00000000-0000-0000-0000-0000000000f2';
RESET ROLE;
DO $$ BEGIN
  IF NOT (SELECT accepted FROM public.forum_replies WHERE id = '00000000-0000-0000-0000-0000000000f2')
  THEN RAISE EXCEPTION 'l''auteur du sujet ne retient plus une réponse'; END IF;
END $$;

-- Sujet verrouillé : ni un membre ni l'auteur du sujet n'y répondent.
UPDATE public.forum_topics SET locked = true WHERE id = '00000000-0000-0000-0000-0000000000f1';
SELECT pg_temp.as_user('00000000-0000-0000-0000-0000000000b2', 'deux@test.fr');
SELECT pg_temp.expect_error($$INSERT INTO public.forum_replies (topic_id, author_id, content) VALUES ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000b2', 'Malgré le verrou')$$, 'réponse dans un sujet verrouillé');
SELECT pg_temp.as_user('00000000-0000-0000-0000-0000000000b1', 'un@test.fr');
SELECT pg_temp.expect_error($$INSERT INTO public.forum_replies (topic_id, author_id, content) VALUES ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000b1', 'Malgré le verrou')$$, 'l''auteur répond dans son sujet verrouillé');
RESET ROLE;
DO $$ BEGIN
  IF (SELECT count(*) FROM public.forum_replies WHERE topic_id = '00000000-0000-0000-0000-0000000000f1') <> 2
  THEN RAISE EXCEPTION 'réponse ajoutée malgré le verrou'; END IF;
END $$;

-- Un administrateur garde la main : il répond dans un sujet verrouillé et choisit ses valeurs.
SELECT pg_temp.as_user('00000000-0000-0000-0000-0000000000b4', 'admin@test.fr');
INSERT INTO public.forum_replies (id, topic_id, author_id, author_name, content, accepted, created_at) VALUES
  ('00000000-0000-0000-0000-0000000000f4', '00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000b4',
   'Équipe', 'Réponse de l''équipe', true, '2020-01-01');
INSERT INTO public.forum_topics (id, author_id, author_name, title, content, views, locked, created_at, last_activity_at) VALUES
  ('00000000-0000-0000-0000-0000000000f5', '00000000-0000-0000-0000-0000000000b4', 'Équipe', 'Annonce', 'Texte',
   12, true, '2020-01-01', '2020-01-02');
RESET ROLE;
DO $$
DECLARE _t public.forum_topics; _r public.forum_replies;
BEGIN
  SELECT * INTO _r FROM public.forum_replies WHERE id = '00000000-0000-0000-0000-0000000000f4';
  IF NOT _r.accepted OR _r.author_name <> 'Équipe' OR _r.created_at <> '2020-01-01'::timestamptz
  THEN RAISE EXCEPTION 'administrateur : réponse réécrite'; END IF;
  SELECT * INTO _t FROM public.forum_topics WHERE id = '00000000-0000-0000-0000-0000000000f5';
  IF _t.views <> 12 OR NOT _t.locked OR _t.author_name <> 'Équipe'
     OR _t.created_at <> '2020-01-01'::timestamptz OR _t.last_activity_at <> '2020-01-02'::timestamptz
  THEN RAISE EXCEPTION 'administrateur : sujet réécrit'; END IF;
END $$;

-- Le serveur (données de démarrage, fonctions internes) n'est pas concerné.
INSERT INTO public.forum_topics (id, author_id, author_name, title, content, views) VALUES
  ('00000000-0000-0000-0000-0000000000f6', '00000000-0000-0000-0000-0000000000b1', 'Exemple', 'Sujet du serveur', 'Texte', 7);
DO $$ BEGIN
  IF (SELECT views FROM public.forum_topics WHERE id = '00000000-0000-0000-0000-0000000000f6') <> 7
     OR (SELECT author_name FROM public.forum_topics WHERE id = '00000000-0000-0000-0000-0000000000f6') <> 'Exemple'
  THEN RAISE EXCEPTION 'serveur : sujet réécrit'; END IF;
END $$;

-- Colonne « pinned » ajoutée plus tard (par un projet) : forcée à faux sans toucher à la fonction.
ALTER TABLE public.forum_topics ADD COLUMN pinned boolean NOT NULL DEFAULT false;
SELECT pg_temp.as_user('00000000-0000-0000-0000-0000000000b2', 'deux@test.fr');
INSERT INTO public.forum_topics (id, author_id, title, content, pinned) VALUES
  ('00000000-0000-0000-0000-0000000000f7', '00000000-0000-0000-0000-0000000000b2', 'Sujet épinglé', 'Texte', true);
RESET ROLE;
DO $$ BEGIN
  IF (SELECT pinned FROM public.forum_topics WHERE id = '00000000-0000-0000-0000-0000000000f7')
  THEN RAISE EXCEPTION 'sujet : créé épinglé'; END IF;
END $$;
ALTER TABLE public.forum_topics DROP COLUMN pinned;

-- 4. Formulaires ouverts aux visiteurs ---------------------------------------------------------------------------------
-- Erreur attendue avec un code précis.
CREATE OR REPLACE FUNCTION pg_temp.expect_sqlstate(_sql text, _code text, _label text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  BEGIN
    EXECUTE _sql;
  EXCEPTION WHEN OTHERS THEN
    IF SQLSTATE = _code THEN RETURN; END IF;
    RAISE EXCEPTION 'ÉCHEC % : code % attendu, % reçu (%)', _label, _code, SQLSTATE, SQLERRM;
  END;
  RAISE EXCEPTION 'ÉCHEC attendu non survenu : %', _label;
END $$;
DELETE FROM public.contact_messages;
DELETE FROM public.newsletter_subscribers;

-- 4.1 Contact : bornes de longueur et de format, y compris pour le serveur (contraintes).
SELECT pg_temp.expect_sqlstate($$INSERT INTO public.contact_messages (name, email, subject, message) VALUES ('Serveur', 'pas-une-adresse', 'Objet', 'Texte')$$, '23514', 'contact : e-mail invalide (serveur)');
SELECT pg_temp.as_anon();
SELECT pg_temp.expect_sqlstate($$INSERT INTO public.contact_messages (name, email, subject, message) VALUES ('Visiteur', 'v@test.fr', 'Objet', repeat('x', 2000000))$$, '23514', 'contact : message de 2 000 000 caractères');
SELECT pg_temp.expect_sqlstate($$INSERT INTO public.contact_messages (name, email, subject, message) VALUES ('Visiteur', 'v@test.fr', 'Objet', repeat('x', 5001))$$, '23514', 'contact : message de 5001 caractères');
SELECT pg_temp.expect_sqlstate($$INSERT INTO public.contact_messages (name, email, subject, message) VALUES ('Visiteur', 'v@test.fr', 'Objet', '')$$, '23514', 'contact : message vide');
SELECT pg_temp.expect_sqlstate($$INSERT INTO public.contact_messages (name, email, subject, message) VALUES ('Visiteur', 'pas-une-adresse', 'Objet', 'Texte')$$, '23514', 'contact : e-mail sans arobase');
SELECT pg_temp.expect_sqlstate($$INSERT INTO public.contact_messages (name, email, subject, message) VALUES ('Visiteur', 'a b@test.fr', 'Objet', 'Texte')$$, '23514', 'contact : e-mail avec espace');
SELECT pg_temp.expect_sqlstate($$INSERT INTO public.contact_messages (name, email, subject, message) VALUES ('Visiteur', repeat('a', 250) || '@test.fr', 'Objet', 'Texte')$$, '23514', 'contact : e-mail trop long');
SELECT pg_temp.expect_sqlstate($$INSERT INTO public.contact_messages (name, email, subject, message) VALUES (repeat('n', 121), 'v@test.fr', 'Objet', 'Texte')$$, '23514', 'contact : nom trop long');
SELECT pg_temp.expect_sqlstate($$INSERT INTO public.contact_messages (name, email, subject, message) VALUES ('', 'v@test.fr', 'Objet', 'Texte')$$, '23514', 'contact : nom vide');
SELECT pg_temp.expect_sqlstate($$INSERT INTO public.contact_messages (name, email, subject, message) VALUES ('Visiteur', 'v@test.fr', repeat('o', 201), 'Texte')$$, '23514', 'contact : objet trop long');
-- Aux bornes exactes : accepté. La date choisie par le visiteur est remplacée par maintenant.
INSERT INTO public.contact_messages (name, email, subject, message, created_at)
  VALUES (repeat('n', 120), 'v@test.fr', repeat('o', 200), repeat('x', 5000), '2020-01-01');
RESET ROLE;
DO $$ BEGIN
  IF (SELECT count(*) FROM public.contact_messages) <> 1 THEN RAISE EXCEPTION 'contact : message aux bornes refusé ou message hors borne accepté'; END IF;
  IF (SELECT created_at FROM public.contact_messages) <> now() THEN RAISE EXCEPTION 'contact : date antidatée acceptée'; END IF;
END $$;

-- 4.2 Contact : 5 messages par adresse et par 24 heures (casse et espaces ignorés), puis CDS02.
SELECT pg_temp.as_anon();
INSERT INTO public.contact_messages (name, email, subject, message) VALUES
  ('Visiteur', 'V@Test.fr', 'Objet 2', 'Texte'), ('Visiteur', 'v@test.fr', 'Objet 3', 'Texte'),
  ('Visiteur', 'v@TEST.fr', 'Objet 4', 'Texte'), ('Visiteur', 'v@test.fr', 'Objet 5', 'Texte');
SELECT pg_temp.expect_sqlstate($$INSERT INTO public.contact_messages (name, email, subject, message) VALUES ('Visiteur', 'v@test.fr', 'Objet 6', 'Texte')$$, 'CDS02', 'contact : sixième message de la même adresse');
SELECT pg_temp.expect_sqlstate($$INSERT INTO public.contact_messages (name, email, subject, message) VALUES ('Visiteur', 'V@TEST.FR', 'Objet 6', 'Texte')$$, 'CDS02', 'contact : sixième message, casse différente');
-- Une autre adresse passe ; un membre est soumis au même plafond.
INSERT INTO public.contact_messages (name, email, subject, message) VALUES ('Autre', 'autre@test.fr', 'Objet', 'Texte');
SELECT pg_temp.as_user('00000000-0000-0000-0000-0000000000b1', 'un@test.fr');
SELECT pg_temp.expect_sqlstate($$INSERT INTO public.contact_messages (name, email, subject, message) VALUES ('Membre', 'v@test.fr', 'Objet 6', 'Texte')$$, 'CDS02', 'contact : plafond par adresse pour un membre');
-- Un message de plus de 24 heures ne compte plus.
RESET ROLE;
UPDATE public.contact_messages SET created_at = now() - interval '25 hours' WHERE subject = 'Objet 2';
SELECT pg_temp.as_anon();
INSERT INTO public.contact_messages (name, email, subject, message) VALUES ('Visiteur', 'v@test.fr', 'Objet 7', 'Texte');
RESET ROLE;

-- Plafond global : 30 messages par heure, puis CDS01. 6 messages récents sont déjà là.
INSERT INTO public.contact_messages (name, email, subject, message)
  SELECT 'Foule', 'foule' || i || '@test.fr', 'Objet', 'Texte' FROM generate_series(1, 23) i;
SELECT pg_temp.as_anon();
INSERT INTO public.contact_messages (name, email, subject, message) VALUES ('Trentième', 'trente@test.fr', 'Objet', 'Texte');
SELECT pg_temp.expect_sqlstate($$INSERT INTO public.contact_messages (name, email, subject, message) VALUES ('De trop', 'detrop@test.fr', 'Objet', 'Texte')$$, 'CDS01', 'contact : plafond global');
-- L'administrateur et le serveur ne sont pas plafonnés, et gardent la date qu'ils choisissent.
SELECT pg_temp.as_user('00000000-0000-0000-0000-0000000000b4', 'admin@test.fr');
INSERT INTO public.contact_messages (name, email, subject, message, created_at) VALUES ('Équipe', 'equipe@test.fr', 'Saisie', 'Texte', '2020-01-01');
RESET ROLE;
INSERT INTO public.contact_messages (name, email, subject, message, created_at) VALUES ('Serveur', 'serveur@test.fr', 'Reprise', 'Texte', '2020-01-02');
DO $$ BEGIN
  IF (SELECT count(*) FROM public.contact_messages WHERE created_at > now() - interval '1 hour') <> 30
  THEN RAISE EXCEPTION 'contact : plafond global dépassé'; END IF;
  IF (SELECT created_at FROM public.contact_messages WHERE subject = 'Saisie') <> '2020-01-01'::timestamptz
     OR (SELECT created_at FROM public.contact_messages WHERE subject = 'Reprise') <> '2020-01-02'::timestamptz
  THEN RAISE EXCEPTION 'contact : date de l''administrateur ou du serveur réécrite'; END IF;
END $$;
-- Une heure plus tard, la boîte accepte à nouveau.
UPDATE public.contact_messages SET created_at = now() - interval '61 minutes' WHERE name = 'Foule';
SELECT pg_temp.as_anon();
INSERT INTO public.contact_messages (name, email, subject, message) VALUES ('Plus tard', 'plustard@test.fr', 'Objet', 'Texte');
RESET ROLE;

-- 4.3 Lettre d'information : plus d'insertion directe pour le visiteur ni pour le membre.
SELECT pg_temp.as_anon();
SELECT pg_temp.expect_error($$INSERT INTO public.newsletter_subscribers (email) VALUES ('direct@test.fr')$$, 'lettre : insertion directe par un visiteur');
SELECT pg_temp.as_user('00000000-0000-0000-0000-0000000000b1', 'un@test.fr');
SELECT pg_temp.expect_error($$INSERT INTO public.newsletter_subscribers (email) VALUES ('direct@test.fr')$$, 'lettre : insertion directe par un membre');
-- Abonnement par la fonction : adresse nettoyée, origine inconnue ramenée à « site », dates à maintenant.
RESET ROLE;
SELECT pg_temp.as_anon();
SELECT public.newsletter_subscribe('  Nouveau@Test.fr ', ' Ana ', 'origine-forgée');
SELECT public.newsletter_subscribe('blog@test.fr', NULL, 'blog');
-- Adresse déjà abonnée : aucune erreur, rien de visible, quelle que soit la casse.
SELECT public.newsletter_subscribe('nouveau@test.fr', 'Autre prénom', 'faq');
SELECT public.newsletter_subscribe('NOUVEAU@TEST.FR');
SELECT pg_temp.expect_sqlstate($$SELECT public.newsletter_subscribe('pas-une-adresse')$$, '22023', 'lettre : e-mail invalide');
SELECT pg_temp.expect_sqlstate($$SELECT public.newsletter_subscribe(NULL)$$, '22023', 'lettre : e-mail absent');
SELECT pg_temp.expect_sqlstate($$SELECT public.newsletter_subscribe(repeat('a', 250) || '@test.fr')$$, '22023', 'lettre : e-mail trop long');
SELECT pg_temp.expect_sqlstate($$SELECT public.newsletter_subscribe('long@test.fr', repeat('p', 81))$$, '22023', 'lettre : prénom trop long');
SELECT pg_temp.expect_error($$SELECT count(*) FROM public.newsletter_subscribers$$, 'lettre : liste lue par un visiteur');
RESET ROLE;
DO $$
DECLARE _s public.newsletter_subscribers;
BEGIN
  IF (SELECT count(*) FROM public.newsletter_subscribers) <> 2 THEN RAISE EXCEPTION 'lettre : nombre d''abonnés inattendu'; END IF;
  SELECT * INTO _s FROM public.newsletter_subscribers WHERE email = 'nouveau@test.fr';
  IF _s.first_name <> 'Ana' OR _s.source <> 'site' OR _s.consent_at <> now() OR _s.created_at <> now()
     OR _s.unsubscribed_at IS NOT NULL
  THEN RAISE EXCEPTION 'lettre : abonné mal enregistré ou réécrit par un doublon'; END IF;
  IF (SELECT source FROM public.newsletter_subscribers WHERE email = 'blog@test.fr') <> 'blog'
  THEN RAISE EXCEPTION 'lettre : origine connue perdue'; END IF;
END $$;
-- Adresse désinscrite : réabonnée, consentement daté de maintenant. Ancienne adresse en majuscules : pas de doublon.
UPDATE public.newsletter_subscribers SET unsubscribed_at = now() - interval '1 day', consent_at = '2020-01-01'
  WHERE email = 'nouveau@test.fr';
INSERT INTO public.newsletter_subscribers (email, source, consent_at) VALUES ('Ancien@Test.fr', 'import', '2019-01-01');
SELECT pg_temp.as_anon();
SELECT public.newsletter_subscribe('nouveau@test.fr');
SELECT public.newsletter_subscribe('ancien@test.fr');
RESET ROLE;
DO $$ BEGIN
  IF (SELECT count(*) FROM public.newsletter_subscribers) <> 3 THEN RAISE EXCEPTION 'lettre : doublon créé'; END IF;
  IF (SELECT unsubscribed_at FROM public.newsletter_subscribers WHERE email = 'nouveau@test.fr') IS NOT NULL
     OR (SELECT consent_at FROM public.newsletter_subscribers WHERE email = 'nouveau@test.fr') <> now()
  THEN RAISE EXCEPTION 'lettre : adresse désinscrite non réabonnée'; END IF;
  IF (SELECT consent_at FROM public.newsletter_subscribers WHERE email = 'Ancien@Test.fr') <> '2019-01-01'::timestamptz
     OR (SELECT source FROM public.newsletter_subscribers WHERE email = 'Ancien@Test.fr') <> 'import'
  THEN RAISE EXCEPTION 'lettre : abonné existant réécrit'; END IF;
END $$;
-- Contraintes, y compris pour le serveur.
SELECT pg_temp.expect_sqlstate($$INSERT INTO public.newsletter_subscribers (email) VALUES ('pas-une-adresse')$$, '23514', 'lettre : e-mail invalide (serveur)');
SELECT pg_temp.expect_sqlstate($$INSERT INTO public.newsletter_subscribers (email, first_name) VALUES ('p@test.fr', repeat('p', 81))$$, '23514', 'lettre : prénom trop long (serveur)');
SELECT pg_temp.expect_sqlstate($$INSERT INTO public.newsletter_subscribers (email, source) VALUES ('s@test.fr', repeat('s', 41))$$, '23514', 'lettre : origine trop longue (serveur)');
-- L'administrateur ajoute un abonné à la main et garde ses valeurs.
SELECT pg_temp.as_user('00000000-0000-0000-0000-0000000000b4', 'admin@test.fr');
INSERT INTO public.newsletter_subscribers (email, source, consent_at) VALUES ('salon@test.fr', 'salon', '2021-01-01');
RESET ROLE;
DO $$ BEGIN
  IF (SELECT consent_at FROM public.newsletter_subscribers WHERE email = 'salon@test.fr') <> '2021-01-01'::timestamptz
     OR (SELECT source FROM public.newsletter_subscribers WHERE email = 'salon@test.fr') <> 'salon'
  THEN RAISE EXCEPTION 'lettre : saisie de l''administrateur réécrite'; END IF;
END $$;
-- Filet : si l'insertion directe était rouverte, dates et origine resteraient tenues par la base.
CREATE POLICY "test insertion directe" ON public.newsletter_subscribers FOR INSERT TO anon WITH CHECK (true);
GRANT INSERT ON public.newsletter_subscribers TO anon;
SELECT pg_temp.as_anon();
INSERT INTO public.newsletter_subscribers (email, source, consent_at, created_at, unsubscribed_at)
  VALUES ('filet@test.fr', 'origine-forgée', '2020-01-01', '2020-01-01', '2020-01-02');
RESET ROLE;
DO $$
DECLARE _s public.newsletter_subscribers;
BEGIN
  SELECT * INTO _s FROM public.newsletter_subscribers WHERE email = 'filet@test.fr';
  IF _s.source <> 'site' OR _s.consent_at <> now() OR _s.created_at <> now() OR _s.unsubscribed_at IS NOT NULL
  THEN RAISE EXCEPTION 'lettre : consentement antidaté ou origine forgée acceptés'; END IF;
END $$;
DROP POLICY "test insertion directe" ON public.newsletter_subscribers;
REVOKE INSERT ON public.newsletter_subscribers FROM anon;

-- 4.4 Régie : affichages et clics comptés pour une campagne en cours seulement.
INSERT INTO public.ad_placements (id, name, slug, active) VALUES
  ('00000000-0000-0000-0000-000000000701', 'Colonne', 'test-colonne', true),
  ('00000000-0000-0000-0000-000000000702', 'Éteint', 'test-eteint', false);
INSERT INTO public.ad_campaigns (id, placement_id, advertiser, title, link_url, active, starts_at, ends_at) VALUES
  ('00000000-0000-0000-0000-000000000711', '00000000-0000-0000-0000-000000000701', 'Annonceur', 'En cours', '/a', true, NULL, now() + interval '1 day'),
  ('00000000-0000-0000-0000-000000000712', '00000000-0000-0000-0000-000000000701', 'Annonceur', 'Inactive', '/b', false, NULL, NULL),
  ('00000000-0000-0000-0000-000000000713', '00000000-0000-0000-0000-000000000701', 'Annonceur', 'Terminée', '/c', true, NULL, now() - interval '1 day'),
  ('00000000-0000-0000-0000-000000000714', '00000000-0000-0000-0000-000000000701', 'Annonceur', 'À venir', '/d', true, now() + interval '1 day', NULL),
  ('00000000-0000-0000-0000-000000000715', '00000000-0000-0000-0000-000000000702', 'Annonceur', 'Emplacement éteint', '/e', true, NULL, NULL);
SELECT pg_temp.as_anon();
INSERT INTO public.ad_events (campaign_id, event_type, page_path, user_agent, created_at)
  VALUES ('00000000-0000-0000-0000-000000000711', 'click', '/blog', repeat('u', 250), '2020-01-01');
SELECT pg_temp.expect_sqlstate($$INSERT INTO public.ad_events (campaign_id, event_type) VALUES ('00000000-0000-0000-0000-000000000712', 'click')$$, '42501', 'régie : clic sur une campagne inactive');
SELECT pg_temp.expect_sqlstate($$INSERT INTO public.ad_events (campaign_id, event_type) SELECT '00000000-0000-0000-0000-000000000712', 'click' FROM generate_series(1, 1000)$$, '42501', 'régie : 1000 clics sur une campagne inactive');
SELECT pg_temp.expect_sqlstate($$INSERT INTO public.ad_events (campaign_id, event_type) VALUES ('00000000-0000-0000-0000-000000000713', 'impression')$$, '42501', 'régie : campagne terminée');
SELECT pg_temp.expect_sqlstate($$INSERT INTO public.ad_events (campaign_id, event_type) VALUES ('00000000-0000-0000-0000-000000000714', 'impression')$$, '42501', 'régie : campagne à venir');
SELECT pg_temp.expect_sqlstate($$INSERT INTO public.ad_events (campaign_id, event_type) VALUES ('00000000-0000-0000-0000-000000000715', 'impression')$$, '42501', 'régie : emplacement éteint');
SELECT pg_temp.expect_sqlstate($$INSERT INTO public.ad_events (campaign_id, event_type, user_agent) VALUES ('00000000-0000-0000-0000-000000000711', 'click', repeat('u', 251))$$, '23514', 'régie : user_agent trop long');
SELECT pg_temp.expect_sqlstate($$INSERT INTO public.ad_events (campaign_id, event_type, page_path) VALUES ('00000000-0000-0000-0000-000000000711', 'click', repeat('p', 501))$$, '23514', 'régie : page_path trop long');
SELECT pg_temp.as_user('00000000-0000-0000-0000-0000000000b1', 'un@test.fr');
INSERT INTO public.ad_events (campaign_id, event_type, created_at) VALUES ('00000000-0000-0000-0000-000000000711', 'impression', '2020-01-01');
SELECT pg_temp.expect_sqlstate($$INSERT INTO public.ad_events (campaign_id, event_type) VALUES ('00000000-0000-0000-0000-000000000712', 'click')$$, '42501', 'régie : membre, campagne inactive');
RESET ROLE;
-- Le serveur garde la main (reprise de données).
INSERT INTO public.ad_events (campaign_id, event_type, created_at) VALUES ('00000000-0000-0000-0000-000000000712', 'impression', '2020-01-01');
DO $$ BEGIN
  IF (SELECT count(*) FROM public.ad_events WHERE campaign_id = '00000000-0000-0000-0000-000000000711' AND created_at = now()) <> 2
  THEN RAISE EXCEPTION 'régie : événement antidaté accepté ou événement valide refusé'; END IF;
  IF (SELECT count(*) FROM public.ad_events WHERE campaign_id <> '00000000-0000-0000-0000-000000000711') <> 1
  THEN RAISE EXCEPTION 'régie : événement compté hors campagne en cours'; END IF;
END $$;

-- Rejouable (toujours en dernier) ---------------------------------------------------------------------------------------
\i supabase/migrations/20261013120000_v1_6_1_correctifs_audit.sql
DO $$ BEGIN
  IF has_column_privilege('authenticated', 'public.messages', 'content', 'UPDATE')
     OR NOT has_column_privilege('authenticated', 'public.messages', 'read_at', 'UPDATE')
  THEN RAISE EXCEPTION 'rejeu de la messagerie'; END IF;
  IF pg_temp.stock() <> 1 THEN RAISE EXCEPTION 'rejeu : stock modifié'; END IF;
  IF (SELECT count(*) FROM pg_trigger WHERE tgname = 'shop_orders_release_stock') <> 1 THEN RAISE EXCEPTION 'rejeu : déclencheur'; END IF;
  IF (SELECT count(*) FROM pg_trigger WHERE tgname IN ('forum_topics_guard_insert', 'forum_replies_guard_insert')) <> 2
  THEN RAISE EXCEPTION 'rejeu : déclencheurs du forum'; END IF;
  IF (SELECT count(*) FROM pg_trigger WHERE tgname IN ('contact_messages_guard_insert', 'newsletter_subscribers_guard_insert', 'ad_events_guard_insert')) <> 3
  THEN RAISE EXCEPTION 'rejeu : déclencheurs des formulaires'; END IF;
  IF (SELECT count(*) FROM pg_constraint WHERE convalidated AND conname IN (
        'contact_messages_name_len', 'contact_messages_email_format', 'contact_messages_subject_len',
        'contact_messages_message_len', 'newsletter_subscribers_email_format',
        'newsletter_subscribers_first_name_len', 'newsletter_subscribers_source_len',
        'ad_events_user_agent_len', 'ad_events_page_path_len')) <> 9
  THEN RAISE EXCEPTION 'rejeu : contraintes des formulaires'; END IF;
  IF has_table_privilege('anon', 'public.newsletter_subscribers', 'INSERT')
     OR (SELECT count(*) FROM pg_policies WHERE tablename = 'newsletter_subscribers' AND cmd = 'INSERT') <> 1
  THEN RAISE EXCEPTION 'rejeu : insertion directe des abonnés rouverte'; END IF;
END $$;
-- Existant hors borne : la migration passe, la contrainte reste NOT VALID et s'applique aux nouvelles lignes.
ALTER TABLE public.contact_messages DROP CONSTRAINT contact_messages_email_format;
INSERT INTO public.contact_messages (name, email, subject, message) VALUES ('Ancien', 'ancienne-saisie', 'Objet', 'Texte');
SET client_min_messages = warning;
\i supabase/migrations/20261013120000_v1_6_1_correctifs_audit.sql
RESET client_min_messages;
SELECT pg_temp.expect_sqlstate($$INSERT INTO public.contact_messages (name, email, subject, message) VALUES ('Nouveau', 'pas-une-adresse', 'Objet', 'Texte')$$, '23514', 'contrainte non validée : toujours appliquée');
DO $$ BEGIN
  IF (SELECT convalidated FROM pg_constraint WHERE conname = 'contact_messages_email_format')
  THEN RAISE EXCEPTION 'contrainte validée malgré une ligne hors borne'; END IF;
END $$;
ROLLBACK;
