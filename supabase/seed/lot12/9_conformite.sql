INSERT INTO public.template_checks (code, area, label, requirement, status, severity, evidence, position)
SELECT v.code, v.area, v.label, v.requirement, v.status, v.severity, v.evidence,
       coalesce((SELECT max(position) FROM public.template_checks), 0) + v.n
FROM (VALUES
  (1, 'V0-VEILLE', 'Modules', 'Veille de sites : découverte, technologies, disponibilité',
   'Règles de détection et seuils en base ; adresses internes refusées ; agents authentifiés par un secret dédié (jamais la clé publique) ; propositions des membres limitées à 5 par jour et jamais publiées sans l''admin.',
   'a_verifier', 'majeur', 'tests/db/test_18 ; à dérouler avec la clé Firecrawl')
) AS v(n, code, area, label, requirement, status, severity, evidence)
ON CONFLICT (code) DO NOTHING;
