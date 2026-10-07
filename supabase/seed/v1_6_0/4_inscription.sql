INSERT INTO public.socle_installation (version, niveau, installe_le, resume, detail, migration_reference)
VALUES ('1.6.0', 'mise_a_niveau', CURRENT_DATE,
  'Mise à niveau vers le socle 1.6.0.',
  'Référentiel des activités (eqNAF) installé.',
  '20261007220000_v1_6_0_activites')
ON CONFLICT (version) DO NOTHING;
