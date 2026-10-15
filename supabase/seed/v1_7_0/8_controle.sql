SELECT 'version du socle' AS controle, (SELECT value ->> 'version' FROM public.site_settings WHERE key = 'socle') AS valeur
UNION ALL SELECT 'colonnes de la 1.7.0', (SELECT count(*) FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'reports' AND column_name IN ('source', 'proposed_value', 'contact_email', 'tracking_code', 'public_note'))::text
UNION ALL SELECT 'signaleur facultatif', (SELECT is_nullable FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'reports' AND column_name = 'reporter_id')
UNION ALL SELECT 'contraintes de la 1.7.0', (SELECT count(*) FROM pg_constraint WHERE conname IN ('reports_source_check', 'reports_content_type_check', 'reports_reason_check', 'reports_proposed_length', 'reports_public_note_length', 'reports_contact_email_format', 'reports_links_check'))::text
UNION ALL SELECT 'fonctions de la 1.7.0', (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public' AND p.proname IN ('report_submit', 'report_status', 'report_improvements', 'purge_report_contacts'))::text
UNION ALL SELECT 'visiteur envoie un signalement', has_function_privilege('anon', 'public.report_submit(text, text, text, uuid, text, text, text, text)', 'EXECUTE')::text
UNION ALL SELECT 'visiteur ecrit en direct', has_table_privilege('anon', 'public.reports', 'INSERT')::text
UNION ALL SELECT 'visiteur efface les adresses', has_function_privilege('anon', 'public.purge_report_contacts()', 'EXECUTE')::text
UNION ALL SELECT 'point de la grille', (SELECT count(*) FROM public.template_checks WHERE code = 'V1-SIGNALEMENTS-VISITEURS')::text
UNION ALL SELECT 'version 1.7.0 publiee', (SELECT count(*) FROM public.socle_versions WHERE version = '1.7.0' AND niveau = 'brique')::text;
