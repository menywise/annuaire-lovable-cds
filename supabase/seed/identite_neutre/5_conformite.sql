INSERT INTO public.template_checks (code, area, label, requirement, status, severity, evidence, position)
SELECT v.code, v.area, v.label, v.requirement, v.status, v.severity, v.evidence,
       coalesce((SELECT max(position) FROM public.template_checks), 0) + v.n
FROM (VALUES
  (1, 'V0-IDENTITE-NEUTRE', 'Socle', 'Identité neutre et premier administrateur',
   'Aucune adresse ni marque dans le code : le premier compte d''une base vide devient administrateur, une seule fois ; couleurs, logo, icônes, image de partage et accueil se règlent dans les paramètres.',
   'a_verifier', 'bloquant', 'tests/db/test_19_premier_administrateur.sql ; tests/unit/identite-neutre.test.ts')
) AS v(n, code, area, label, requirement, status, severity, evidence)
ON CONFLICT (code) DO NOTHING;
