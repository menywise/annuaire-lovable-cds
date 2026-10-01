INSERT INTO public.template_checks (code, area, label, requirement, status, severity, evidence, position)
SELECT v.code, v.area, v.label, v.requirement, v.status, v.severity, v.evidence,
       coalesce((SELECT max(position) FROM public.template_checks), 0) + v.n
FROM (VALUES
  (1, 'V0-KIT-DEMARRAGE', 'Socle', 'Kit de démarrage d''un clone',
   'Aucune valeur propre à un projet dans le code : nom, adresse et domaine d''envoi des e-mails lus dans les réglages ; écran Démarrage (réglages, secrets, contenus de démonstration) ; mode d''emploi docs/CLONER.md.',
   'a_verifier', 'bloquant', 'tests/db/test_18 ; écran /admin/demarrage')
) AS v(n, code, area, label, requirement, status, severity, evidence)
ON CONFLICT (code) DO NOTHING;
