SELECT 'verrou' AS controle, (SELECT count(*) FROM public.premier_administrateur)::text AS valeur
UNION ALL SELECT 'administrateurs', (SELECT count(*) FROM public.user_roles WHERE role = 'admin')::text
UNION ALL SELECT 'adresses nommees d avance', (SELECT count(*) FROM public.studio_admins)::text
UNION ALL SELECT 'declencheur dernier admin', (SELECT count(*) FROM pg_trigger WHERE tgname = 'user_roles_garder_un_administrateur')::text
UNION ALL SELECT 'ancien declencheur liste', (SELECT count(*) FROM pg_trigger WHERE tgname = 'studio_admins_keep_one')::text;
