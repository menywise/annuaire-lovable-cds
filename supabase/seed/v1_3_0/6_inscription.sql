INSERT INTO public.socle_installation (version, niveau, installe_le, resume, detail, migration_reference)
VALUES ('1.3.0', 'mise_a_niveau', CURRENT_DATE,
  'Mise à niveau vers le socle 1.3.0.',
  'Accroches pour greffes : modules greffe_ acceptés par la base, fonctions de droits des fiches de l''annuaire pour les tables d''extension.',
  '20261004120000_v1_3_0_accroches_greffes')
ON CONFLICT (version) DO NOTHING;
