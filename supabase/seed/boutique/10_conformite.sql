INSERT INTO public.template_checks (code, area, label, requirement, status, severity, evidence, position)
SELECT v.code, v.area, v.label, v.requirement, v.status, v.severity, v.evidence,
       coalesce((SELECT max(position) FROM public.template_checks), 0) + v.n
FROM (VALUES
  (1, 'V0-K-BOUTIQUE', 'Modules', 'Boutique : objets, PDF et livres numériques',
   'Prix, livraison et stock lus en base au paiement ; fichiers dans un espace privé, liens signés de 5 minutes réservés à l''acheteur ; commande conservée et anonymisée avec le compte.',
   'a_verifier', 'bloquant', 'tests/db/test_17 ; à dérouler en mode test Stripe (carte 4242…)')
) AS v(n, code, area, label, requirement, status, severity, evidence)
ON CONFLICT (code) DO NOTHING;
