UPDATE public.template_checks SET modules = v.modules
FROM (VALUES
  ('CNT-1', ARRAY['blog']), ('SEO-4', ARRAY['blog']),
  ('CNT-2', ARRAY['faq']),
  ('CNT-3', ARRAY['testimonials']),
  ('CNT-4', ARRAY['reviews']),
  ('CNT-5', ARRAY['newsletter']),
  ('COM-1', ARRAY['forum']),
  ('COM-2', ARRAY['members']),
  ('COM-3', ARRAY['messaging']),
  ('LEG-3', ARRAY['contact']), ('OPS-2', ARRAY['contact']), ('V0-PURGE-CONTACT', ARRAY['contact']),
  ('OPS-1', ARRAY['pricing']),
  ('V0-SIGNALEMENTS', ARRAY['reports']),
  ('V0-D-PAIEMENT', ARRAY['payments']),
  ('V0-K-BOUTIQUE', ARRAY['shop']),
  ('PIL-1', ARRAY['studio']), ('PIL-2', ARRAY['studio']), ('PIL-3', ARRAY['studio'])
) AS v(code, modules)
WHERE public.template_checks.code = v.code;
UPDATE public.template_checks
SET label = 'Pied de page en colonnes',
    requirement = 'Colonnes de liens ; inscription à la lettre d''information quand le module est allumé'
WHERE code = 'NAV-2' AND label = 'Pied de page 4 colonnes + lettre d''information';
