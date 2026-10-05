INSERT INTO public.socle_installation (version, niveau, installe_le, resume, detail, migration_reference)
VALUES ('1.4.1', 'mise_a_niveau', CURRENT_DATE,
  'Mise à niveau vers le socle 1.4.1.',
  'Correctifs de l''audit : sécurité de la géographie, annuaire fermé quand il est éteint, pilotage complet, pages légales selon les modules, accessibilité.',
  '20261005150000_v1_4_1_correctifs')
ON CONFLICT (version) DO NOTHING;
