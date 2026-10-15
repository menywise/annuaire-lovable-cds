ALTER TABLE public.contact_messages
  DROP CONSTRAINT IF EXISTS contact_messages_name_len,
  DROP CONSTRAINT IF EXISTS contact_messages_email_format,
  DROP CONSTRAINT IF EXISTS contact_messages_subject_len,
  DROP CONSTRAINT IF EXISTS contact_messages_message_len;
ALTER TABLE public.contact_messages
  ADD CONSTRAINT contact_messages_name_len CHECK (char_length(name) BETWEEN 1 AND 120) NOT VALID,
  ADD CONSTRAINT contact_messages_email_format CHECK (
    char_length(email) <= 254 AND email ~ '^[^@[:space:]]+@[^@[:space:]]+[.][^@[:space:]]+$') NOT VALID,
  ADD CONSTRAINT contact_messages_subject_len CHECK (char_length(subject) BETWEEN 1 AND 200) NOT VALID,
  ADD CONSTRAINT contact_messages_message_len CHECK (char_length(message) BETWEEN 1 AND 5000) NOT VALID;
ALTER TABLE public.newsletter_subscribers
  DROP CONSTRAINT IF EXISTS newsletter_subscribers_email_format,
  DROP CONSTRAINT IF EXISTS newsletter_subscribers_first_name_len,
  DROP CONSTRAINT IF EXISTS newsletter_subscribers_source_len;
ALTER TABLE public.newsletter_subscribers
  ADD CONSTRAINT newsletter_subscribers_email_format CHECK (
    char_length(email) <= 254 AND email ~ '^[^@[:space:]]+@[^@[:space:]]+[.][^@[:space:]]+$') NOT VALID,
  ADD CONSTRAINT newsletter_subscribers_first_name_len CHECK (
    first_name IS NULL OR char_length(first_name) <= 80) NOT VALID,
  ADD CONSTRAINT newsletter_subscribers_source_len CHECK (char_length(source) BETWEEN 1 AND 40) NOT VALID;
ALTER TABLE public.ad_events
  DROP CONSTRAINT IF EXISTS ad_events_user_agent_len,
  DROP CONSTRAINT IF EXISTS ad_events_page_path_len;
ALTER TABLE public.ad_events
  ADD CONSTRAINT ad_events_user_agent_len CHECK (char_length(user_agent) <= 250) NOT VALID,
  ADD CONSTRAINT ad_events_page_path_len CHECK (char_length(page_path) <= 500) NOT VALID;
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
CREATE INDEX IF NOT EXISTS contact_messages_created_at_idx ON public.contact_messages (created_at DESC);
CREATE OR REPLACE FUNCTION public.guard_contact_message_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND public.has_role(auth.uid(), 'admin') THEN
    RETURN NEW;
  END IF;
  NEW.created_at := now();
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
CREATE OR REPLACE FUNCTION public.newsletter_known_source(_source text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE WHEN _source IN ('site', 'pied-de-page', 'faq', 'blog', 'demarrer') THEN _source ELSE 'site' END
$$;
REVOKE ALL ON FUNCTION public.newsletter_known_source(text) FROM PUBLIC, anon, authenticated;
CREATE OR REPLACE FUNCTION public.newsletter_subscribe(
  _email text, _first_name text DEFAULT NULL, _source text DEFAULT 'site')
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _mail text := lower(btrim(coalesce(_email, '')));
  _name text := nullif(btrim(coalesce(_first_name, '')), '');
  _from text := public.newsletter_known_source(_source);
BEGIN
  IF char_length(_mail) > 254 OR _mail !~ '^[^@[:space:]]+@[^@[:space:]]+[.][^@[:space:]]+$' THEN
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
DROP POLICY IF EXISTS "Tout le monde peut s abonner" ON public.newsletter_subscribers;
REVOKE INSERT ON public.newsletter_subscribers FROM anon;
DROP POLICY IF EXISTS "Les admins ajoutent des abonnes" ON public.newsletter_subscribers;
CREATE POLICY "Les admins ajoutent des abonnes" ON public.newsletter_subscribers FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
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
    RETURN NEW;
  END IF;
  NEW.created_at := now();
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.guard_ad_event_insert() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS ad_events_guard_insert ON public.ad_events;
CREATE TRIGGER ad_events_guard_insert BEFORE INSERT ON public.ad_events
  FOR EACH ROW EXECUTE FUNCTION public.guard_ad_event_insert();
