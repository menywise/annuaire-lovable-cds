SELECT 'version du socle' AS controle, (SELECT value ->> 'version' FROM public.site_settings WHERE key = 'socle') AS valeur
UNION ALL SELECT 'activites', (SELECT count(*) FROM public.activites)::text
UNION ALL SELECT 'professionnelles cadran S', (SELECT count(*) FROM public.activites WHERE type = 'professionnel' AND cadran = 'S')::text
UNION ALL SELECT 'non professionnelles cadran E', (SELECT count(*) FROM public.activites WHERE type = 'non_professionnel' AND cadran = 'E')::text
UNION ALL SELECT 'categories', (SELECT count(DISTINCT categorie) FROM public.activites)::text
UNION ALL SELECT 'visiteur ecrit activites', has_table_privilege('anon', 'public.activites', 'INSERT')::text;
