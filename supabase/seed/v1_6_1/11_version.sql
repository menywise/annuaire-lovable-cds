UPDATE public.template_checks
SET requirement = 'Prix et livraison lus en base à la commande ; stock réservé à la commande, rendu si elle expire ; fichiers dans un espace privé, liens signés de 5 minutes réservés à l''acheteur ; commande conservée et anonymisée avec le compte.'
WHERE code = 'V0-K-BOUTIQUE'
  AND requirement = 'Prix, livraison et stock lus en base au paiement ; fichiers dans un espace privé, liens signés de 5 minutes réservés à l''acheteur ; commande conservée et anonymisée avec le compte.';
UPDATE public.template_checks SET status = 'a_verifier'
WHERE code = 'PIL-1' AND status = 'conforme' AND evidence = ''
  AND NOT EXISTS (SELECT 1 FROM public.roadmap_items);
UPDATE public.template_checks SET status = 'a_verifier'
WHERE code = 'PIL-2' AND status = 'conforme' AND evidence = ''
  AND NOT EXISTS (SELECT 1 FROM public.masterplan_sections);
INSERT INTO public.socle_versions (version, niveau, publie_le, resume, detail, migration_reference)
VALUES ('1.6.1', 'correctif', '2026-10-14',
  'Correctifs de l''audit du 13/10 : messagerie, boutique, forum, formulaires publics, annuaire, administrateurs, prix, pilotage, compteurs et index.',
  'Messages et conversations verrouillés ; stock réservé à la commande ; garde-fous du forum à la création et verrou du sujet ; bornes et plafonds des formulaires publics, abonnement discret, régie bornée ; revendication d''annuaire non écrasée et fiche modifiée relue ; adresse confirmée exigée pour les administrateurs nommés d''avance ; prix négatifs refusés ; plan et feuille de route du socle retirés ; compteurs calculés en base ; index des clés étrangères et des tris.',
  '20261013120000_v1_6_1_correctifs_audit')
ON CONFLICT (version) DO NOTHING;
INSERT INTO public.site_settings (key, value)
VALUES ('socle', jsonb_build_object('version', '1.6.1', 'publie_le', '2026-10-14',
  'migration_reference', '20261013120000_v1_6_1_correctifs_audit'))
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()
WHERE string_to_array(coalesce(public.site_settings.value ->> 'version', '0.0.0'), '.')::int[]
      < string_to_array('1.6.1', '.')::int[];
