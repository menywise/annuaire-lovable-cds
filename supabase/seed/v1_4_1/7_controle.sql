SELECT 'version du socle' AS controle, (SELECT value ->> 'version' FROM public.site_settings WHERE key = 'socle') AS valeur
UNION ALL SELECT 'tables sans protection', (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p') AND NOT c.relrowsecurity)::text
UNION ALL SELECT 'regles geo_places', (SELECT count(*) FROM pg_policies WHERE schemaname = 'public' AND tablename = 'geo_places')::text
UNION ALL SELECT 'visiteur peut ecrire geo_places', has_table_privilege('anon', 'public.geo_places', 'DELETE')::text
UNION ALL SELECT 'colonne public_visible', (SELECT count(*) FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'roadmap_items' AND column_name = 'public_visible')::text
UNION ALL SELECT 'point SEC-RLS', (SELECT count(*) FROM public.template_checks WHERE code = 'SEC-RLS')::text
UNION ALL SELECT 'annuaire ferme si eteint', (SELECT count(*) FROM pg_policies WHERE schemaname = 'public' AND policyname IN ('dir_list_insert_auth', 'dir_rev_insert_auth') AND with_check LIKE '%module_enabled%')::text;
