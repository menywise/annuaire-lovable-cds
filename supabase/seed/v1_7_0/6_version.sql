INSERT INTO public.template_checks (code, area, label, requirement, status, severity, evidence, position, modules)
SELECT 'V1-SIGNALEMENTS-VISITEURS', 'Modération', 'Signalements ouverts aux visiteurs',
  'Erreur, oubli ou correction proposée sans compte : champ piège, délai de 3 secondes, un lien au plus, plafonds par heure et par adresse, code de suivi, réponse publique sur « Le site s''améliore grâce à vous », adresse effacée 3 mois après le traitement.',
  'conforme', 'majeur', 'tests/db/test_28',
  coalesce((SELECT max(position) FROM public.template_checks), 0) + 1, ARRAY['reports']
ON CONFLICT (code) DO NOTHING;
INSERT INTO public.socle_versions (version, niveau, publie_le, resume, detail, migration_reference)
VALUES ('1.7.0', 'brique', '2026-10-15',
  'Signalements ouverts aux visiteurs : erreur, oubli ou correction proposée, avec suivi et réponse publique.',
  'Envoi sans compte par report_submit (champ piège, délai, un lien au plus, plafonds sans adresse IP) ; code de suivi (report_status) ; réponse publique de l''administrateur et page des améliorations (report_improvements) ; adresse e-mail facultative effacée 3 mois après le traitement.',
  '20261015120000_v1_7_0_signalements_ouverts')
ON CONFLICT (version) DO NOTHING;
INSERT INTO public.site_settings (key, value)
VALUES ('socle', jsonb_build_object('version', '1.7.0', 'publie_le', '2026-10-15',
  'migration_reference', '20261015120000_v1_7_0_signalements_ouverts'))
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()
WHERE string_to_array(coalesce(public.site_settings.value ->> 'version', '0.0.0'), '.')::int[]
      < string_to_array('1.7.0', '.')::int[];
