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
  IF _email <> '' AND EXISTS (SELECT 1 FROM public.studio_admins WHERE email = _email) THEN
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
