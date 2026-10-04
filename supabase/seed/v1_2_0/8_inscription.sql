INSERT INTO public.socle_installation (version, niveau, installe_le, resume, detail, migration_reference)
VALUES ('1.2.0', 'mise_a_niveau', CURRENT_DATE,
  'Mise à niveau vers le socle 1.2.0.',
  'Modules facultatifs éteints par défaut, à choisir dans l''écran Démarrage ; pilotage, médiathèque et recherche toujours allumés.',
  '20261003150000_v1_2_0_modules_facultatifs')
ON CONFLICT (version) DO NOTHING;
