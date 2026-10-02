DROP TRIGGER IF EXISTS studio_admins_keep_one ON public.studio_admins;
DROP FUNCTION IF EXISTS public.keep_one_studio_admin();
DELETE FROM public.studio_admins s
WHERE EXISTS (
  SELECT 1 FROM auth.users u
  JOIN public.user_roles r ON r.user_id = u.id AND r.role = 'admin'
  WHERE lower(u.email) = s.email
);
DELETE FROM public.studio_admins WHERE NOT EXISTS (SELECT 1 FROM auth.users);
