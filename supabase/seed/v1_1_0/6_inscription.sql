INSERT INTO public.socle_installation (version, niveau, installe_le, resume, detail, migration_reference)
VALUES ('1.1.0', 'mise_a_niveau', CURRENT_DATE,
  'Mise à niveau vers le socle 1.1.0.',
  'Registres des versions, purge nocturne des messages de contact replanifiée, code du socle fusionné.',
  '20261003120000_v1_1_0_versions_installation')
ON CONFLICT (version) DO NOTHING;
