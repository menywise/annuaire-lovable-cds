INSERT INTO public.socle_versions (version, niveau, publie_le, resume, detail, migration_reference)
VALUES ('1.3.0', 'brique', '2026-10-04',
  'Accroches pour greffes : un projet ajoute ses modules, ses menus, ses pages et ses tables sans modifier le socle.',
  'Modules greffe_ acceptés et conservés par la base ; prise src/greffe/index.ts lue par les menus, le plan du site, le sitemap, la recette et les pages protégées ; fonctions de droits des fiches de l''annuaire pour les tables d''extension.',
  '20261004120000_v1_3_0_accroches_greffes')
ON CONFLICT (version) DO NOTHING;
INSERT INTO public.site_settings (key, value)
VALUES ('socle', jsonb_build_object('version', '1.3.0', 'publie_le', '2026-10-04',
  'migration_reference', '20261004120000_v1_3_0_accroches_greffes'))
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()
WHERE string_to_array(coalesce(public.site_settings.value ->> 'version', '0.0.0'), '.')::int[]
      < string_to_array('1.3.0', '.')::int[];
