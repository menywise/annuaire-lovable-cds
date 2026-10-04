SELECT 'version du socle' AS controle, (SELECT value ->> 'version' FROM public.site_settings WHERE key = 'socle') AS valeur
UNION ALL SELECT 'modules eteints par defaut', (SELECT count(*) FROM jsonb_each_text(public.module_defaults()) WHERE value = 'false')::text
UNION ALL SELECT 'outils toujours allumes', (SELECT string_agg(k, ' ' ORDER BY k) FROM unnest(public.module_socle_keys()) AS k WHERE public.module_enabled(k))
UNION ALL SELECT 'modules allumes', coalesce((SELECT string_agg(key, ' ' ORDER BY key) FROM jsonb_each_text(coalesce((SELECT value FROM public.site_settings WHERE key = 'modules'), '{}'::jsonb)) WHERE value = 'true' AND NOT key = ANY (public.module_socle_keys())), 'aucun')
UNION ALL SELECT 'choix des modules date', coalesce((SELECT value ->> 'modules_choisis_le' FROM public.site_settings WHERE key = 'demarrage'), 'pas encore')
UNION ALL SELECT 'declencheur du choix', (SELECT count(*) FROM pg_trigger WHERE tgname = 'site_settings_mark_modules_choice')::text;
