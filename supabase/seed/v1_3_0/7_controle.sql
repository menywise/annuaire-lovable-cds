SELECT 'version du socle' AS controle, (SELECT value ->> 'version' FROM public.site_settings WHERE key = 'socle') AS valeur
UNION ALL SELECT 'cle greffe reconnue', (public.module_is_greffe('greffe_essai') AND NOT public.module_is_greffe('essai'))::text
UNION ALL SELECT 'module de projet eteint par defaut', (NOT public.module_enabled('greffe_essai'))::text
UNION ALL SELECT 'modules de projet allumes', coalesce((SELECT string_agg(key, ' ' ORDER BY key) FROM jsonb_each_text(public.module_greffe_values((SELECT value FROM public.site_settings WHERE key = 'modules'))) WHERE value = 'true'), 'aucun')
UNION ALL SELECT 'fonctions des fiches', (SELECT count(*) FROM pg_proc WHERE proname IN ('directory_listing_visible', 'directory_listing_modifiable') AND pronamespace = 'public'::regnamespace)::text
UNION ALL SELECT 'versions publiees', (SELECT string_agg(version, ' ' ORDER BY string_to_array(version, '.')::int[]) FROM public.socle_versions);
