SELECT 'version du socle' AS controle, (SELECT value ->> 'version' FROM public.site_settings WHERE key = 'socle') AS valeur
UNION ALL SELECT 'visiteur lit geo_places', has_table_privilege('anon', 'public.geo_places', 'SELECT')::text
UNION ALL SELECT 'regle de lecture publique', (SELECT count(*) FROM pg_policies WHERE schemaname = 'public' AND tablename = 'geo_places' AND policyname = 'geo_places_read')::text
UNION ALL SELECT 'fonctions de lecture', (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public' AND p.proname IN ('geo_lieu', 'geo_communes_principales', 'geo_neighbours', 'geo_search') AND p.prosecdef)::text
UNION ALL SELECT 'visiteur importe', has_function_privilege('anon', 'public.geo_importer(jsonb)', 'EXECUTE')::text;
