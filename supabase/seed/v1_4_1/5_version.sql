INSERT INTO public.socle_versions (version, niveau, publie_le, resume, detail, migration_reference)
VALUES ('1.4.1', 'correctif', '2026-10-05',
  'Correctifs de l''audit de l''annuaire : sécurité, états de page, pilotage, pages légales, accessibilité.',
  'Protection de geo_places réaffirmée et contrôle tables_sans_protection() (point SEC-RLS) ; annuaire fermé aux membres quand il est éteint ; « visible du public » retiré du pilotage.',
  '20261005150000_v1_4_1_correctifs')
ON CONFLICT (version) DO NOTHING;
INSERT INTO public.site_settings (key, value)
VALUES ('socle', jsonb_build_object('version', '1.4.1', 'publie_le', '2026-10-05',
  'migration_reference', '20261005150000_v1_4_1_correctifs'))
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()
WHERE string_to_array(coalesce(public.site_settings.value ->> 'version', '0.0.0'), '.')::int[]
      < string_to_array('1.4.1', '.')::int[];
