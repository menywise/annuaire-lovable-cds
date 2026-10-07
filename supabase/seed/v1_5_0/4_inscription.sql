INSERT INTO public.socle_installation (version, niveau, installe_le, resume, detail, migration_reference)
VALUES ('1.5.0', 'mise_a_niveau', CURRENT_DATE,
  'Mise à niveau vers le socle 1.5.0.',
  'Géographie alimentée par le référentiel du Studio et verrouillée contre l''export en masse.',
  '20261007200000_v1_5_0_referentiel_studio')
ON CONFLICT (version) DO NOTHING;
