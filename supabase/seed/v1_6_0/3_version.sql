INSERT INTO public.socle_versions (version, niveau, publie_le, resume, detail, migration_reference)
VALUES ('1.6.0', 'brique', '2026-10-07',
  'Référentiel des activités (eqNAF) : secteurs professionnels et passions, communs à tous les projets.',
  'Table activites (164 entrées du registre eqNAF de la base SCM : 120 codes NAF du cadran S, 44 activités non professionnelles du cadran E, 29 catégories), lecture publique des activités actives, écriture réservée à l''admin.',
  '20261007220000_v1_6_0_activites')
ON CONFLICT (version) DO NOTHING;
INSERT INTO public.site_settings (key, value)
VALUES ('socle', jsonb_build_object('version', '1.6.0', 'publie_le', '2026-10-07',
  'migration_reference', '20261007220000_v1_6_0_activites'))
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()
WHERE string_to_array(coalesce(public.site_settings.value ->> 'version', '0.0.0'), '.')::int[]
      < string_to_array('1.6.0', '.')::int[];
