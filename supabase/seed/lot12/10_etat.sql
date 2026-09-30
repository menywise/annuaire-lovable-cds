SELECT 'tables veille (6 attendues)' AS controle, count(*)::text AS resultat
FROM information_schema.tables WHERE table_schema = 'public' AND table_name LIKE 'watch_%'
UNION ALL
SELECT 'fonctions veille (4 attendues)', count(*)::text FROM pg_proc
WHERE proname IN ('watch_record_check', 'guard_watch_submission', 'watch_publish', 'watch_status')
UNION ALL
SELECT 'règles de détection (43 attendues)', count(*)::text FROM public.watch_detectors
UNION ALL
SELECT 'empreintes Lovable (12 attendues)', count(*)::text FROM public.watch_detectors WHERE weight > 0
UNION ALL
SELECT 'module watch (false attendu)', coalesce((SELECT value ->> 'watch' FROM public.site_settings WHERE key = 'modules'), 'absent')
UNION ALL
SELECT 'réglages de la veille', coalesce((SELECT value::text FROM public.site_settings WHERE key = 'watch'), 'absent');
