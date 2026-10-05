INSERT INTO public.socle_versions (version, niveau, publie_le, resume, detail, migration_reference)
VALUES ('1.4.0', 'brique', '2026-10-05',
  'Grille de conformité par module : un clone est mesuré sur ses seuls modules allumés.',
  'Chaque point porte ses modules (aucun = tout site) ; les points dont tous les modules sont éteints sortent du score ; un point « module fini » par module ; une greffe ajoute ses points avec ses modules greffe_.',
  '20261005120000_v1_4_0_grille_par_module')
ON CONFLICT (version) DO NOTHING;
INSERT INTO public.site_settings (key, value)
VALUES ('socle', jsonb_build_object('version', '1.4.0', 'publie_le', '2026-10-05',
  'migration_reference', '20261005120000_v1_4_0_grille_par_module'))
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()
WHERE string_to_array(coalesce(public.site_settings.value ->> 'version', '0.0.0'), '.')::int[]
      < string_to_array('1.4.0', '.')::int[];
