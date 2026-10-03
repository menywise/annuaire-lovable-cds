CREATE OR REPLACE FUNCTION public.garder_un_administrateur()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.premier_administrateur)
     AND NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin') THEN
    RAISE EXCEPTION 'Le dernier administrateur ne peut pas être retiré : nommez-en un autre d''abord' USING ERRCODE = '23514';
  END IF;
  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.garder_un_administrateur() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS user_roles_garder_un_administrateur ON public.user_roles;
CREATE TRIGGER user_roles_garder_un_administrateur AFTER DELETE OR UPDATE ON public.user_roles
  FOR EACH STATEMENT EXECUTE FUNCTION public.garder_un_administrateur();
