INSERT INTO public.socle_versions (version, niveau, publie_le, resume, detail, migration_reference)
VALUES ('1.5.0', 'brique', '2026-10-07',
  'Géographie alimentée par le référentiel du Studio (GeoAnnonces) et verrouillée contre l''export en masse.',
  'Import d''un pays depuis GeoAnnonces par clé (secrets CDS_GEO_URL et CDS_GEO_CLE, fonction geo_importer) ; lecture de geo_places fermée aux visiteurs, pages servies par fonctions à l''unité (geo_lieu, geo_communes_principales, geo_neighbours, geo_search).',
  '20261007200000_v1_5_0_referentiel_studio')
ON CONFLICT (version) DO NOTHING;
INSERT INTO public.site_settings (key, value)
VALUES ('socle', jsonb_build_object('version', '1.5.0', 'publie_le', '2026-10-07',
  'migration_reference', '20261007200000_v1_5_0_referentiel_studio'))
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()
WHERE string_to_array(coalesce(public.site_settings.value ->> 'version', '0.0.0'), '.')::int[]
      < string_to_array('1.5.0', '.')::int[];
