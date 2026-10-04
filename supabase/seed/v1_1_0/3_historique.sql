INSERT INTO public.socle_versions (version, niveau, publie_le, resume, detail, migration_reference)
VALUES
  ('1.0.0', 'initial', '2026-10-03',
   'État initial consolidé du socle : tout ce qui précède est scellé dans cette version.',
   'Lots 1 à 13 a, Boutique et identité neutre appliqués par l''éditeur SQL, hors journal des migrations. Dernière migration inscrite dans ce journal : 20260918093638. Dernière migration du dépôt appliquée en base : 20261002090000_v0_identite_neutre.',
   '20261002090000_v0_identite_neutre'),
  ('1.1.0', 'brique', '2026-10-03',
   'Registres des versions : socle_versions inscrite au dépôt, socle_installation ajoutée.',
   'Chaque base sait quelle version du socle elle embarque (réglage « socle » et table socle_installation). Rattrapage dans la base du socle de starter_status() et de la ligne V0-KIT-DEMARRAGE du lot 13 a, présentes au dépôt depuis la 1.0.0.',
   '20261003120000_v1_1_0_versions_installation')
ON CONFLICT (version) DO NOTHING;
