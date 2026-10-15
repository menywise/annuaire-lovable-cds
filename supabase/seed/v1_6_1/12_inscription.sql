INSERT INTO public.socle_installation (version, niveau, installe_le, resume, detail, migration_reference)
VALUES ('1.6.1', 'mise_a_niveau', CURRENT_DATE,
  'Mise à niveau vers le socle 1.6.1.',
  'Correctifs de l''audit du 13/10 : messagerie, boutique, forum, formulaires publics, annuaire, administrateurs, prix, pilotage, compteurs et index.',
  '20261013120000_v1_6_1_correctifs_audit')
ON CONFLICT (version) DO NOTHING;
