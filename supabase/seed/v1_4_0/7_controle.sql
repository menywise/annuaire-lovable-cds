SELECT 'version du socle' AS controle, (SELECT value ->> 'version' FROM public.site_settings WHERE key = 'socle') AS valeur
UNION ALL SELECT 'points de la grille', (SELECT count(*) FROM public.template_checks)::text
UNION ALL SELECT 'points rattaches a un module', (SELECT count(*) FROM public.template_checks WHERE cardinality(modules) > 0)::text
UNION ALL SELECT 'points module fini', (SELECT count(*) FROM public.template_checks WHERE code LIKE 'MOD-%')::text
UNION ALL SELECT 'points dans le perimetre', (SELECT count(*) FROM public.template_checks t WHERE t.en_perimetre)::text
UNION ALL SELECT 'dont conformes', (SELECT count(*) FROM public.template_checks t WHERE t.en_perimetre AND t.status = 'conforme')::text;
