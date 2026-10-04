INSERT INTO public.socle_versions (version, niveau, publie_le, resume, detail, migration_reference)
VALUES ('1.2.0', 'brique', '2026-10-03',
  'Modules facultatifs éteints par défaut ; pilotage, médiathèque et recherche deviennent des outils d''administration toujours allumés.',
  'Le choix des modules se fait dans l''écran Démarrage et la base date ce choix (réglage « demarrage »). Une base où aucun administrateur n''a encore choisi repasse à tout éteint.',
  '20261003150000_v1_2_0_modules_facultatifs')
ON CONFLICT (version) DO NOTHING;
INSERT INTO public.site_settings (key, value)
VALUES ('socle', jsonb_build_object('version', '1.2.0', 'publie_le', '2026-10-03',
  'migration_reference', '20261003150000_v1_2_0_modules_facultatifs'))
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()
WHERE string_to_array(coalesce(public.site_settings.value ->> 'version', '0.0.0'), '.')::int[]
      < string_to_array('1.2.0', '.')::int[];
