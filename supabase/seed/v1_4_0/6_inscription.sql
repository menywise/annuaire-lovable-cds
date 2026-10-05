INSERT INTO public.socle_installation (version, niveau, installe_le, resume, detail, migration_reference)
VALUES ('1.4.0', 'mise_a_niveau', CURRENT_DATE,
  'Mise à niveau vers le socle 1.4.0.',
  'Grille de conformité par module : le score ne compte que les points des modules allumés.',
  '20261005120000_v1_4_0_grille_par_module')
ON CONFLICT (version) DO NOTHING;
