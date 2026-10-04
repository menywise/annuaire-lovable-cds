INSERT INTO public.site_settings (key, value)
VALUES ('socle', jsonb_build_object('version', '1.1.0', 'publie_le', '2026-10-03',
  'migration_reference', '20261003120000_v1_1_0_versions_installation'))
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()
WHERE string_to_array(coalesce(public.site_settings.value ->> 'version', '0.0.0'), '.')::int[]
      < string_to_array('1.1.0', '.')::int[];
