INSERT INTO public.socle_installation (version, niveau, installe_le, resume, detail, migration_reference)
VALUES ('1.7.0', 'mise_a_niveau', CURRENT_DATE,
  'Mise à niveau vers le socle 1.7.0.',
  'Signalements ouverts aux visiteurs : erreur, oubli ou correction proposée, avec suivi et réponse publique.',
  '20261015120000_v1_7_0_signalements_ouverts')
ON CONFLICT (version) DO NOTHING;
