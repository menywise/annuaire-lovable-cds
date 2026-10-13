-- Socle 1.6.1 — correctifs issus de l'audit (13/10).
-- 1. Messagerie privée : un participant ne réécrit plus un message (texte, date, expéditeur) et ne
--    change plus les membres d'une conversation. Seul le destinataire marque un message comme lu.
-- 2. Boutique : stock réservé à la création de la commande, rendu une seule fois si elle expire ;
--    le paiement ne le décompte plus une seconde fois. Fin de la survente.
-- 3. Forum : garde-fous à la création. Un membre ne choisit plus ses compteurs, ses dates, son nom
--    affiché ni l'état « retenue » ; il ne répond plus dans un sujet verrouillé.
-- 4. Formulaires ouverts aux visiteurs (contact, lettre d'information, régie) : longueurs et format
--    d'e-mail bornés, dates forcées, plafonds d'envoi du contact, abonnement par une fonction qui ne
--    révèle pas une adresse déjà inscrite, clics et affichages acceptés pour une campagne en cours.
-- 5. Annuaire : une demande de revendication en attente n'est plus écrasée par celle d'un autre
--    membre. La seconde demande est refusée avec un message ; le même membre peut redemander.
-- 6. Annuaire : une fiche publiée dont l'auteur ou le propriétaire modifie le contenu visible repasse
--    en attente de validation (brouillon), comme une petite annonce. L'administrateur publie de nouveau.
-- 7. Administrateurs nommés d'avance : le rôle n'est donné qu'à un compte dont l'adresse est confirmée
--    (auth.users.email_confirmed_at), à la connexion comme à l'ajout de l'adresse dans la liste.
-- Rejouable sans danger.

-- 1. Messagerie privée -----------------------------------------------------------------------------
-- Messages : seule la colonne read_at reste modifiable. Le retrait au niveau de la table retire aussi
-- les droits par colonne : l'ordre REVOKE puis GRANT compte.
REVOKE UPDATE, DELETE, TRUNCATE ON public.messages FROM anon, authenticated;
GRANT UPDATE (read_at) ON public.messages TO authenticated;
-- Marquer comme lu : uniquement les messages reçus, jamais les siens.
DROP POLICY IF EXISTS "Participants marquent comme lu" ON public.messages;
CREATE POLICY "Participants marquent comme lu" ON public.messages FOR UPDATE TO authenticated
  USING (sender_id <> auth.uid() AND public.is_conversation_participant(conversation_id, auth.uid()))
  WITH CHECK (
    sender_id <> auth.uid()
    AND read_at IS NOT NULL
    AND public.is_conversation_participant(conversation_id, auth.uid())
  );

-- Conversations : aucune modification par un membre. La date du dernier message reste tenue par
-- touch_conversation (déclencheur SECURITY DEFINER, droits du propriétaire).
REVOKE UPDATE, DELETE, TRUNCATE ON public.conversations FROM anon, authenticated;
DROP POLICY IF EXISTS "Participants mettent a jour" ON public.conversations;

-- 2. Boutique : stock réservé à la commande ----------------------------------------------------------
-- Le stock baisse dès la création de la commande (produits verrouillés par identifiant croissant,
-- refus si le stock manque). Il revient quand la commande expire : session Stripe expirée ou
-- échouée, commande remplacée par une nouvelle, ou abandonnée par le serveur. reserved_quantity
-- garde la quantité retenue par ligne : la restitution la remet à zéro, donc elle n'a lieu qu'une fois.
-- Les produits sans stock (numériques, ou physiques illimités) ne changent pas de comportement.
ALTER TABLE public.shop_order_items ADD COLUMN IF NOT EXISTS reserved_quantity integer NOT NULL DEFAULT 0;
ALTER TABLE public.shop_order_items DROP CONSTRAINT IF EXISTS shop_order_items_reserved_check;
ALTER TABLE public.shop_order_items ADD CONSTRAINT shop_order_items_reserved_check
  CHECK (reserved_quantity BETWEEN 0 AND quantity);

-- Restitution d'une commande expirée. Rejouable : une ligne déjà rendue (réserve à zéro) est ignorée.
CREATE OR REPLACE FUNCTION public.shop_release_stock(_order_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- Commande verrouillée : un paiement simultané attend, puis voit la réserve déjà rendue.
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

-- Toute commande qui passe à « expirée » rend son stock, quel que soit le chemin : base
-- (payment_mark_status, shop_start_checkout) ou serveur (src/lib/shop.functions.ts).
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

-- Commande : contrôle et réservation du stock sous verrou ; la commande remplacée rend le sien d'abord.
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
  -- Une seule commande en préparation à la fois par membre (deux onglets = file d'attente).
  PERFORM pg_advisory_xact_lock(hashtextextended('shop:' || _user_id::text, 0));

  -- Verrou des produits du panier et de ceux de la commande en attente remplacée, en une fois et
  -- par identifiant croissant : deux commandes simultanées s'attendent au lieu de s'interbloquer.
  PERFORM 1 FROM public.shop_products p
  WHERE p.id::text IN (SELECT value ->> 'product_id' FROM jsonb_array_elements(_items)
                       WHERE jsonb_typeof(value) = 'object')
     OR p.id IN (SELECT i.product_id FROM public.shop_order_items i
                 JOIN public.shop_orders o ON o.id = i.order_id
                 WHERE o.user_id = _user_id AND o.status = 'pending' AND i.reserved_quantity > 0)
  ORDER BY p.id
  FOR UPDATE OF p;

  -- Commande en attente précédente : remplacée avant le contrôle du stock, qui lui est rendu
  -- (déclencheur shop_orders_release_stock) ; ses sessions Stripe sont à expirer.
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

  -- Réservation : le stock baisse dès la commande (produits déjà verrouillés plus haut).
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

-- Paiement : le stock réservé n'est pas décompté une seconde fois. Partie formations inchangée.
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
      -- Le stock réservé à la commande est déjà décompté. Seules les lignes sans réserve (commande
      -- antérieure à la 1.6.1, ou réserve rendue à l'expiration puis payée quand même) le baissent.
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

-- 3. Forum : garde-fous à la création ----------------------------------------------------------------
-- Les règles d'insertion ne vérifient que l'auteur, et les gardes existantes ne couvrent que la
-- modification. Un membre pouvait donc créer un sujet avec des vues gonflées, une date d'activité
-- future (sujet figé en tête de liste) ou un nom d'emprunt, se donner une réponse « retenue » sur le
-- sujet d'un autre, et répondre dans un sujet verrouillé.
-- Même convention que les gardes de modification : les fonctions internes et le serveur (rôle autre
-- que authenticated ou anon) passent, l'administrateur garde la main.

-- Nom affiché d'un membre, relu en base : profil membre, sinon profil du compte, sinon « Membre ».
-- Le nom par défaut « Membre » du profil membre ne masque pas le nom du compte.
-- Droits de l'appelant : chacun lit son propre profil.
CREATE OR REPLACE FUNCTION public.forum_author_name(_user_id uuid)
RETURNS text LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT coalesce(
    (SELECT nullif(nullif(btrim(mp.display_name), ''), 'Membre')
     FROM public.member_profiles mp WHERE mp.user_id = _user_id),
    (SELECT nullif(btrim(p.full_name), '') FROM public.profiles p WHERE p.id = _user_id),
    'Membre')
$$;
REVOKE ALL ON FUNCTION public.forum_author_name(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.forum_author_name(uuid) TO authenticated, service_role;

-- Sujet : compteur à zéro, non verrouillé, non épinglé, dates à maintenant, nom relu depuis le profil.
CREATE OR REPLACE FUNCTION public.guard_forum_topic_insert()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF current_user NOT IN ('authenticated', 'anon') THEN
    RETURN NEW; -- serveur, données de démarrage, fonctions internes
  END IF;
  IF auth.uid() IS NOT NULL AND public.has_role(auth.uid(), 'admin') THEN
    RETURN NEW;
  END IF;
  -- « pinned » n'existe pas dans le socle : la clé est ignorée tant que la colonne est absente,
  -- et forcée à faux le jour où elle est ajoutée.
  NEW := jsonb_populate_record(NEW, '{"pinned": false}'::jsonb);
  NEW.views := 0;
  NEW.locked := false;
  NEW.created_at := now();
  NEW.updated_at := now();
  NEW.last_activity_at := now();
  NEW.author_name := public.forum_author_name(auth.uid());
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.guard_forum_topic_insert() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS forum_topics_guard_insert ON public.forum_topics;
CREATE TRIGGER forum_topics_guard_insert BEFORE INSERT ON public.forum_topics
  FOR EACH ROW EXECUTE FUNCTION public.guard_forum_topic_insert();

-- Réponse : refusée dans un sujet verrouillé ; jamais « retenue » à la création, date à maintenant,
-- nom relu depuis le profil.
CREATE OR REPLACE FUNCTION public.guard_forum_reply_insert()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF current_user NOT IN ('authenticated', 'anon') THEN
    RETURN NEW;
  END IF;
  IF auth.uid() IS NOT NULL AND public.has_role(auth.uid(), 'admin') THEN
    RETURN NEW;
  END IF;
  IF (SELECT t.locked FROM public.forum_topics t WHERE t.id = NEW.topic_id) THEN
    RAISE EXCEPTION 'Discussion verrouillée' USING ERRCODE = '42501';
  END IF;
  NEW.accepted := false;
  NEW.created_at := now();
  NEW.author_name := public.forum_author_name(auth.uid());
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.guard_forum_reply_insert() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS forum_replies_guard_insert ON public.forum_replies;
CREATE TRIGGER forum_replies_guard_insert BEFORE INSERT ON public.forum_replies
  FOR EACH ROW EXECUTE FUNCTION public.guard_forum_reply_insert();

-- 4. Formulaires ouverts aux visiteurs ---------------------------------------------------------------
-- Les protections du navigateur (champ piège, délai) ne valent rien face à un appel direct : les
-- bornes sont posées ici.

-- 4.1 Bornes de longueur et de format. Ajoutées NOT VALID : elles s'appliquent tout de suite aux
-- nouvelles lignes sans relire l'existant.
ALTER TABLE public.contact_messages
  DROP CONSTRAINT IF EXISTS contact_messages_name_len,
  DROP CONSTRAINT IF EXISTS contact_messages_email_format,
  DROP CONSTRAINT IF EXISTS contact_messages_subject_len,
  DROP CONSTRAINT IF EXISTS contact_messages_message_len;
ALTER TABLE public.contact_messages
  ADD CONSTRAINT contact_messages_name_len CHECK (char_length(name) BETWEEN 1 AND 120) NOT VALID,
  ADD CONSTRAINT contact_messages_email_format CHECK (
    char_length(email) <= 254 AND email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$') NOT VALID,
  ADD CONSTRAINT contact_messages_subject_len CHECK (char_length(subject) BETWEEN 1 AND 200) NOT VALID,
  ADD CONSTRAINT contact_messages_message_len CHECK (char_length(message) BETWEEN 1 AND 5000) NOT VALID;

ALTER TABLE public.newsletter_subscribers
  DROP CONSTRAINT IF EXISTS newsletter_subscribers_email_format,
  DROP CONSTRAINT IF EXISTS newsletter_subscribers_first_name_len,
  DROP CONSTRAINT IF EXISTS newsletter_subscribers_source_len;
ALTER TABLE public.newsletter_subscribers
  ADD CONSTRAINT newsletter_subscribers_email_format CHECK (
    char_length(email) <= 254 AND email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$') NOT VALID,
  ADD CONSTRAINT newsletter_subscribers_first_name_len CHECK (
    first_name IS NULL OR char_length(first_name) <= 80) NOT VALID,
  ADD CONSTRAINT newsletter_subscribers_source_len CHECK (char_length(source) BETWEEN 1 AND 40) NOT VALID;

ALTER TABLE public.ad_events
  DROP CONSTRAINT IF EXISTS ad_events_user_agent_len,
  DROP CONSTRAINT IF EXISTS ad_events_page_path_len;
ALTER TABLE public.ad_events
  ADD CONSTRAINT ad_events_user_agent_len CHECK (char_length(user_agent) <= 250) NOT VALID,
  ADD CONSTRAINT ad_events_page_path_len CHECK (char_length(page_path) <= 500) NOT VALID;

-- Validation de l'existant. Une ancienne ligne hors borne ne fait pas échouer la migration : la
-- contrainte reste alors NOT VALID (toujours appliquée aux nouvelles lignes) et un avis le signale.
DO $$
DECLARE _c record;
BEGIN
  FOR _c IN
    SELECT c.conrelid::regclass AS tbl, c.conname
    FROM pg_constraint c
    WHERE NOT c.convalidated
      AND c.conrelid IN ('public.contact_messages'::regclass, 'public.newsletter_subscribers'::regclass,
                         'public.ad_events'::regclass)
      AND c.conname IN (
        'contact_messages_name_len', 'contact_messages_email_format', 'contact_messages_subject_len',
        'contact_messages_message_len', 'newsletter_subscribers_email_format',
        'newsletter_subscribers_first_name_len', 'newsletter_subscribers_source_len',
        'ad_events_user_agent_len', 'ad_events_page_path_len')
  LOOP
    BEGIN
      EXECUTE format('ALTER TABLE %s VALIDATE CONSTRAINT %I', _c.tbl, _c.conname);
    EXCEPTION WHEN check_violation THEN
      RAISE NOTICE 'Contrainte % non validée : des lignes existantes de % sont hors borne', _c.conname, _c.tbl;
    END;
  END LOOP;
END $$;

-- 4.2 Contact : date forcée et plafonds d'envoi, sans stocker d'adresse IP.
-- Plafond global : 30 messages par heure. Plafond par adresse e-mail : 5 messages par 24 heures.
-- Codes d'erreur lus par le formulaire : CDS01 (plafond global), CDS02 (plafond par adresse).
-- Le déclencheur ne vise que le visiteur et le membre (clause WHEN, évaluée avec le rôle appelant) :
-- la fonction s'exécute avec les droits du propriétaire pour compter des lignes que l'appelant ne lit pas.
CREATE INDEX IF NOT EXISTS contact_messages_created_at_idx ON public.contact_messages (created_at DESC);

CREATE OR REPLACE FUNCTION public.guard_contact_message_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND public.has_role(auth.uid(), 'admin') THEN
    RETURN NEW;
  END IF;
  NEW.created_at := now();
  -- Un envoi à la fois : deux envois simultanés ne passent pas tous les deux sous le plafond.
  PERFORM pg_advisory_xact_lock(hashtext('cds.contact_messages.insert'));
  IF (SELECT count(*) FROM public.contact_messages m
      WHERE m.created_at > now() - interval '1 hour') >= 30 THEN
    RAISE EXCEPTION 'Trop de messages reçus pour le moment. Réessayez dans une heure.'
      USING ERRCODE = 'CDS01';
  END IF;
  IF (SELECT count(*) FROM public.contact_messages m
      WHERE m.created_at > now() - interval '24 hours'
        AND lower(btrim(m.email)) = lower(btrim(NEW.email))) >= 5 THEN
    RAISE EXCEPTION 'Plusieurs messages ont déjà été envoyés avec cette adresse aujourd''hui. Réessayez demain.'
      USING ERRCODE = 'CDS02';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.guard_contact_message_insert() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS contact_messages_guard_insert ON public.contact_messages;
CREATE TRIGGER contact_messages_guard_insert BEFORE INSERT ON public.contact_messages
  FOR EACH ROW WHEN (current_user IN ('anon', 'authenticated'))
  EXECUTE FUNCTION public.guard_contact_message_insert();

-- 4.3 Lettre d'information : l'abonnement passe par une fonction, l'insertion directe est fermée.
-- Origine : liste connue, sinon « site ».
CREATE OR REPLACE FUNCTION public.newsletter_known_source(_source text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE WHEN _source IN ('site', 'pied-de-page', 'faq', 'blog', 'demarrer') THEN _source ELSE 'site' END
$$;
REVOKE ALL ON FUNCTION public.newsletter_known_source(text) FROM PUBLIC, anon, authenticated;

-- Une adresse déjà inscrite ne révèle rien : même retour, aucune erreur de doublon. Une adresse
-- désinscrite qui s'inscrit à nouveau est réabonnée, avec un consentement daté de maintenant.
CREATE OR REPLACE FUNCTION public.newsletter_subscribe(
  _email text, _first_name text DEFAULT NULL, _source text DEFAULT 'site')
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _mail text := lower(btrim(coalesce(_email, '')));
  _name text := nullif(btrim(coalesce(_first_name, '')), '');
  _from text := public.newsletter_known_source(_source);
BEGIN
  IF char_length(_mail) > 254 OR _mail !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' THEN
    RAISE EXCEPTION 'Adresse e-mail invalide' USING ERRCODE = '22023';
  END IF;
  IF char_length(_name) > 80 THEN
    RAISE EXCEPTION 'Prénom trop long (80 caractères au plus)' USING ERRCODE = '22023';
  END IF;
  UPDATE public.newsletter_subscribers s
    SET unsubscribed_at = NULL, consent_at = now(), source = _from, first_name = coalesce(_name, s.first_name)
    WHERE lower(s.email) = _mail AND s.unsubscribed_at IS NOT NULL;
  IF EXISTS (SELECT 1 FROM public.newsletter_subscribers s WHERE lower(s.email) = _mail) THEN
    RETURN;
  END IF;
  INSERT INTO public.newsletter_subscribers (email, first_name, source, consent_at, created_at)
  VALUES (_mail, _name, _from, now(), now())
  ON CONFLICT (email) DO NOTHING;
END;
$$;
REVOKE ALL ON FUNCTION public.newsletter_subscribe(text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.newsletter_subscribe(text, text, text) TO anon, authenticated, service_role;

-- Insertion directe : réservée à l'administrateur.
DROP POLICY IF EXISTS "Tout le monde peut s abonner" ON public.newsletter_subscribers;
REVOKE INSERT ON public.newsletter_subscribers FROM anon;
DROP POLICY IF EXISTS "Les admins ajoutent des abonnes" ON public.newsletter_subscribers;
CREATE POLICY "Les admins ajoutent des abonnes" ON public.newsletter_subscribers FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Filet : si une insertion directe par un visiteur ou un membre redevenait possible, les dates et
-- l'origine resteraient tenues par la base.
CREATE OR REPLACE FUNCTION public.guard_newsletter_subscriber_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND public.has_role(auth.uid(), 'admin') THEN
    RETURN NEW;
  END IF;
  NEW.created_at := now();
  NEW.consent_at := now();
  NEW.unsubscribed_at := NULL;
  NEW.source := public.newsletter_known_source(NEW.source);
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.guard_newsletter_subscriber_insert() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS newsletter_subscribers_guard_insert ON public.newsletter_subscribers;
CREATE TRIGGER newsletter_subscribers_guard_insert BEFORE INSERT ON public.newsletter_subscribers
  FOR EACH ROW WHEN (current_user IN ('anon', 'authenticated'))
  EXECUTE FUNCTION public.guard_newsletter_subscriber_insert();

-- 4.4 Régie : un affichage ou un clic n'est compté que pour une campagne en cours (campagne active,
-- emplacement actif, dates respectées), et toujours daté de maintenant.
CREATE OR REPLACE FUNCTION public.ad_campaign_is_live(_campaign_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.ad_campaigns c
    JOIN public.ad_placements p ON p.id = c.placement_id
    WHERE c.id = _campaign_id AND c.active AND p.active
      AND (c.starts_at IS NULL OR c.starts_at <= now())
      AND (c.ends_at IS NULL OR c.ends_at >= now()))
$$;
REVOKE ALL ON FUNCTION public.ad_campaign_is_live(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ad_campaign_is_live(uuid) TO anon, authenticated, service_role;

DROP POLICY IF EXISTS "ad_ev_insert_anon" ON public.ad_events;
CREATE POLICY "ad_ev_insert_anon" ON public.ad_events FOR INSERT TO anon
  WITH CHECK (public.ad_campaign_is_live(campaign_id));
DROP POLICY IF EXISTS "ad_ev_insert_auth" ON public.ad_events;
CREATE POLICY "ad_ev_insert_auth" ON public.ad_events FOR INSERT TO authenticated
  WITH CHECK (public.ad_campaign_is_live(campaign_id));

CREATE OR REPLACE FUNCTION public.guard_ad_event_insert()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF current_user NOT IN ('authenticated', 'anon') THEN
    RETURN NEW; -- serveur, données de démarrage
  END IF;
  NEW.created_at := now();
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.guard_ad_event_insert() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS ad_events_guard_insert ON public.ad_events;
CREATE TRIGGER ad_events_guard_insert BEFORE INSERT ON public.ad_events
  FOR EACH ROW EXECUTE FUNCTION public.guard_ad_event_insert();

-- 5. Annuaire : une demande de revendication en attente n'est plus écrasée ---------------------------
-- Avant : la mise à jour ne regardait pas claim_requested_by ; le dernier demandeur remplaçait le
-- précédent sans trace. La fiche est maintenant verrouillée le temps de la décision : deux demandes
-- simultanées ne se croisent pas. Une demande en attente d'un autre membre lève CDS03, que la page de
-- la fiche traduit. Le même membre peut redemander : sa demande garde sa date d'origine.
CREATE OR REPLACE FUNCTION public.request_directory_claim(_listing_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid uuid := auth.uid();
  _demandeur uuid;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Non authentifie';
  END IF;
  IF NOT public.module_enabled('directory') THEN
    RETURN false;
  END IF;
  SELECT claim_requested_by INTO _demandeur
    FROM public.directory_listings
   WHERE id = _listing_id
     AND status = 'published'
     AND claimed_by IS NULL
     FOR UPDATE;
  IF NOT FOUND THEN
    RETURN false;
  END IF;
  IF _demandeur = _uid THEN
    RETURN true;
  END IF;
  IF _demandeur IS NOT NULL THEN
    RAISE EXCEPTION 'Une demande est déjà en cours d''examen pour cette fiche.'
      USING ERRCODE = 'CDS03';
  END IF;
  UPDATE public.directory_listings
     SET claim_requested_by = _uid,
         claim_requested_at = now()
   WHERE id = _listing_id;
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.request_directory_claim(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.request_directory_claim(uuid) TO authenticated;

-- 6. Annuaire : une fiche publiée et modifiée repasse en attente de validation ------------------------
-- Avant : l'auteur ou le propriétaire d'une fiche publiée changeait le nom, la description ou le site
-- web, et la fiche restait en ligne sans relecture. Les petites annonces repassent déjà en attente à
-- chaque modification (guard_marketplace_listing_update) : même règle ici.
-- L'attente de validation de l'annuaire est l'état « draft » : c'est celui d'une fiche proposée par un
-- membre, que l'administrateur publie. La fiche modifiée quitte donc le site jusqu'à sa relecture.
-- Contenu visible : tout ce que les pages publiques affichent (nom, adresse de la page, résumé,
-- description, catégorie, mots-clés, adresse, position, coordonnées, site, images, horaires).
-- Une mise à jour qui ne change aucune de ces valeurs laisse la fiche en ligne. L'administrateur et
-- les fonctions du socle (rôle de service, fonctions à droits élevés) ne sont pas concernés.
-- Les interdits d'origine sont repris tels quels : publication, vérification, mise en avant, offre et
-- propriété restent à l'administration.
CREATE OR REPLACE FUNCTION public.guard_directory_listing_update()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF current_user NOT IN ('authenticated', 'anon') OR public.has_role(auth.uid(), 'admin') THEN
    RETURN NEW;
  END IF;
  IF NEW.verified IS DISTINCT FROM OLD.verified
     OR NEW.featured IS DISTINCT FROM OLD.featured
     OR NEW.plan IS DISTINCT FROM OLD.plan
     OR NEW.claimed_by IS DISTINCT FROM OLD.claimed_by
     OR NEW.claimed_at IS DISTINCT FROM OLD.claimed_at
     OR NEW.claim_requested_by IS DISTINCT FROM OLD.claim_requested_by
     OR NEW.claim_requested_at IS DISTINCT FROM OLD.claim_requested_at
     OR NEW.created_by IS DISTINCT FROM OLD.created_by
     OR (NEW.status IS DISTINCT FROM OLD.status AND NEW.status = 'published') THEN
    RAISE EXCEPTION 'Modification réservée à l''administration' USING ERRCODE = '42501';
  END IF;
  IF OLD.status = 'published' AND NEW.status = 'published'
     AND (NEW.name, NEW.slug, NEW.excerpt, NEW.description, NEW.category_id, NEW.tags,
          NEW.address, NEW.postal_code, NEW.city, NEW.departement, NEW.latitude, NEW.longitude,
          NEW.phone, NEW.email, NEW.website, NEW.logo_url, NEW.cover_url, NEW.photos, NEW.hours)
         IS DISTINCT FROM
         (OLD.name, OLD.slug, OLD.excerpt, OLD.description, OLD.category_id, OLD.tags,
          OLD.address, OLD.postal_code, OLD.city, OLD.departement, OLD.latitude, OLD.longitude,
          OLD.phone, OLD.email, OLD.website, OLD.logo_url, OLD.cover_url, OLD.photos, OLD.hours) THEN
    NEW.status := 'draft';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS directory_listings_guard ON public.directory_listings;
CREATE TRIGGER directory_listings_guard BEFORE UPDATE ON public.directory_listings
  FOR EACH ROW EXECUTE FUNCTION public.guard_directory_listing_update();

-- 7. Administrateurs nommés d'avance : adresse confirmée exigée -------------------------------------
-- Avant : bootstrap_current_user (à la connexion) et le déclencheur studio_admins_promote (à l'ajout
-- d'une adresse) donnaient le rôle administrateur sur la seule égalité d'adresse avec studio_admins.
-- Un compte créé avec l'adresse d'un administrateur attendu, sans jamais la confirmer, héritait du rôle.
-- Désormais la promotion par cette liste exige auth.users.email_confirmed_at non nul, et que l'adresse
-- confirmée du compte soit bien celle de la liste (pas celle d'un jeton émis avant un changement).
-- Le premier administrateur d'une base neuve (verrou premier_administrateur) garde son comportement :
-- il ne passe pas par la liste et n'exige pas d'adresse confirmée.
CREATE OR REPLACE FUNCTION public.bootstrap_current_user(_full_name text DEFAULT NULL)
RETURNS public.app_role
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  _name text := nullif(trim(coalesce(_full_name, auth.jwt() -> 'user_metadata' ->> 'full_name', '')), '');
  _role public.app_role := 'user';
  _n integer;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Non authentifie';
  END IF;
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (_uid, _email, _name)
  ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email,
        full_name = COALESCE(EXCLUDED.full_name, public.profiles.full_name);
  IF _email <> ''
     AND EXISTS (SELECT 1 FROM public.studio_admins WHERE email = _email)
     AND EXISTS (SELECT 1 FROM auth.users u
                 WHERE u.id = _uid AND lower(u.email) = _email AND u.email_confirmed_at IS NOT NULL) THEN
    _role := 'admin';
  ELSIF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin') THEN
    INSERT INTO public.premier_administrateur (verrou, user_id) VALUES (true, _uid)
      ON CONFLICT (verrou) DO NOTHING;
    GET DIAGNOSTICS _n = ROW_COUNT;
    IF _n = 1 THEN
      _role := 'admin';
    END IF;
  END IF;
  INSERT INTO public.user_roles (user_id, role)
  VALUES (_uid, _role)
  ON CONFLICT (user_id, role) DO NOTHING;
  IF public.has_role(_uid, 'admin') THEN
    RETURN 'admin';
  END IF;
  RETURN _role;
END;
$$;
REVOKE ALL ON FUNCTION public.bootstrap_current_user(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.bootstrap_current_user(text) TO authenticated;

-- Ajout d'une adresse à la liste : seul un compte existant à l'adresse confirmée est promu aussitôt.
-- Un compte non confirmé le sera à sa première connexion après confirmation (fonction ci-dessus).
CREATE OR REPLACE FUNCTION public.promote_studio_admin()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.user_roles (user_id, role)
  SELECT u.id, 'admin' FROM auth.users u
  WHERE lower(u.email) = NEW.email AND u.email_confirmed_at IS NOT NULL
  ON CONFLICT (user_id, role) DO NOTHING;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.promote_studio_admin() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS studio_admins_promote ON public.studio_admins;
CREATE TRIGGER studio_admins_promote AFTER INSERT ON public.studio_admins
  FOR EACH ROW EXECUTE FUNCTION public.promote_studio_admin();
