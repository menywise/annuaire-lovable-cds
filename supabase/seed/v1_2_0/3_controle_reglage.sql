CREATE OR REPLACE FUNCTION public.validate_modules_setting()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  _k text;
  _v jsonb;
  _m jsonb;
BEGIN
  IF NEW.key <> 'modules' THEN
    RETURN NEW;
  END IF;
  IF jsonb_typeof(NEW.value) <> 'object' THEN
    RAISE EXCEPTION 'Modules : objet attendu' USING ERRCODE = '22023';
  END IF;
  FOR _k, _v IN SELECT * FROM jsonb_each(NEW.value) LOOP
    IF (public.module_defaults() -> _k) IS NULL THEN
      RAISE EXCEPTION 'Module inconnu : %', _k USING ERRCODE = '22023';
    END IF;
    IF jsonb_typeof(_v) <> 'boolean' THEN
      RAISE EXCEPTION 'Module % : vrai ou faux attendu', _k USING ERRCODE = '22023';
    END IF;
    IF _k = ANY (public.module_socle_keys()) AND NOT _v::text::boolean THEN
      RAISE EXCEPTION 'Outil d''administration toujours allumé : %', _k USING ERRCODE = '23514';
    END IF;
  END LOOP;
  _m := public.module_defaults() || NEW.value;
  IF (_m ->> 'geo')::boolean AND NOT (_m ->> 'directory')::boolean THEN
    RAISE EXCEPTION 'La géographie exige l''annuaire métier' USING ERRCODE = '23514';
  END IF;
  IF (_m ->> 'messaging')::boolean AND NOT (_m ->> 'members')::boolean THEN
    RAISE EXCEPTION 'La messagerie exige les membres' USING ERRCODE = '23514';
  END IF;
  IF (_m ->> 'marketplace')::boolean AND NOT (_m ->> 'messaging')::boolean THEN
    RAISE EXCEPTION 'Les petites annonces exigent la messagerie' USING ERRCODE = '23514';
  END IF;
  IF (_m ->> 'payments')::boolean AND NOT (_m ->> 'lms')::boolean THEN
    RAISE EXCEPTION 'Le paiement en ligne exige les formations' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
