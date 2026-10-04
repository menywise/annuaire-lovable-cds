SELECT 'versions publiees' AS controle, (SELECT string_agg(version, ' ' ORDER BY version) FROM public.socle_versions) AS valeur
UNION ALL SELECT 'reglage socle', (SELECT value ->> 'version' FROM public.site_settings WHERE key = 'socle')
UNION ALL SELECT 'registre installation', coalesce((SELECT string_agg(version || ' ' || niveau, ', ' ORDER BY version) FROM public.socle_installation), 'vide')
UNION ALL SELECT 'politiques de lecture', (SELECT count(*) FROM pg_policies WHERE policyname IN ('socle_versions_lecture', 'socle_installation_lecture'))::text
UNION ALL SELECT 'starter_status', coalesce(to_regprocedure('public.starter_status()')::text, 'absente')
UNION ALL SELECT 'purge nocturne', CASE WHEN to_regclass('cron.job') IS NULL THEN 'pg_cron absent' ELSE (xpath('/row/n/text()', query_to_xml('SELECT count(*) AS n FROM cron.job WHERE jobname = ''cds_purge_contact_messages''', false, true, '')))[1]::text END;
