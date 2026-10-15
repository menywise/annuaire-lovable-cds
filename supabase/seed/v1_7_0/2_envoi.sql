CREATE OR REPLACE FUNCTION public.report_submit(
  _content_type text, _reason text, _details text DEFAULT NULL, _content_id uuid DEFAULT NULL,
  _proposed_value text DEFAULT NULL, _reported_url text DEFAULT NULL,
  _contact_email text DEFAULT NULL, _trap text DEFAULT NULL)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid uuid := auth.uid();
  _text text := nullif(btrim(coalesce(_details, '')), '');
  _value text := nullif(btrim(coalesce(_proposed_value, '')), '');
  _mail text := nullif(lower(btrim(coalesce(_contact_email, ''))), '');
  _path text := nullif(btrim(coalesce(_reported_url, '')), '');
  _code text;
BEGIN
  IF NOT public.module_enabled('reports') THEN
    RAISE EXCEPTION 'Les signalements sont désactivés' USING ERRCODE = '42501';
  END IF;
  IF coalesce(_trap, '') <> '' THEN
    RETURN upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10));
  END IF;
  IF _reason = 'correction' AND _value IS NULL THEN
    RAISE EXCEPTION 'Indiquez la correction que vous proposez' USING ERRCODE = '23514';
  END IF;
  IF _uid IS NULL AND char_length(coalesce(_text, '') || coalesce(_value, '')) < 5 THEN
    RAISE EXCEPTION 'Décrivez ce que vous avez vu (5 caractères au moins)' USING ERRCODE = '23514';
  END IF;
  IF _uid IS NULL THEN
    PERFORM pg_advisory_xact_lock(hashtext('cds.reports.visiteur'));
    IF (SELECT count(*) FROM public.reports r
        WHERE r.source = 'visiteur' AND r.created_at > now() - interval '1 hour') >= 30 THEN
      RAISE EXCEPTION 'Beaucoup de signalements reçus pour le moment. Réessayez dans une heure.'
        USING ERRCODE = 'CDS04';
    END IF;
    IF _mail IS NOT NULL AND (SELECT count(*) FROM public.reports r
        WHERE r.source = 'visiteur' AND r.created_at > now() - interval '24 hours'
          AND r.contact_email = _mail) >= 5 THEN
      RAISE EXCEPTION 'Plusieurs signalements ont déjà été envoyés avec cette adresse aujourd''hui. Réessayez demain.'
        USING ERRCODE = 'CDS05';
    END IF;
    IF EXISTS (SELECT 1 FROM public.reports r
        WHERE r.source = 'visiteur' AND r.status = 'en_attente'
          AND r.reported_url IS NOT DISTINCT FROM _path
          AND r.details IS NOT DISTINCT FROM _text
          AND r.proposed_value IS NOT DISTINCT FROM _value) THEN
      RAISE EXCEPTION 'Ce signalement a déjà été reçu : l''équipe l''examine.' USING ERRCODE = 'CDS06';
    END IF;
  END IF;
  INSERT INTO public.reports (reporter_id, source, content_type, content_id, reason, details,
                              proposed_value, reported_url, contact_email)
  VALUES (_uid, CASE WHEN _uid IS NULL THEN 'visiteur' ELSE 'membre' END, _content_type, _content_id,
          _reason, _text, _value, _path, CASE WHEN _uid IS NULL THEN _mail END)
  RETURNING tracking_code INTO _code;
  RETURN _code;
END;
$$;
REVOKE ALL ON FUNCTION public.report_submit(text, text, text, uuid, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.report_submit(text, text, text, uuid, text, text, text, text)
  TO anon, authenticated, service_role;
