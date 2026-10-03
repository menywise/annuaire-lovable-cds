REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.bootstrap_current_user(text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.bootstrap_current_user(text) TO authenticated;