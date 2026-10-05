INSERT INTO public.template_checks (code, area, label, requirement, status, severity, evidence, position, modules)
SELECT 'MOD-' || m.key, 'Modules', 'Module fini : ' || m.label,
  'Les 8 critères de V0.md §4 : interrupteur, aucune trace éteint, accès testés, administration complète, états de page, SEO, test automatique, ligne cochée.',
  'a_verifier', 'majeur', '', 200 + m.ordre, ARRAY[m.key]
FROM (VALUES
  ('blog', 'blog, commentaires, RSS', 1), ('faq', 'FAQ', 2), ('contact', 'contact', 3),
  ('newsletter', 'lettre d''information', 4), ('forum', 'forum', 5), ('members', 'membres', 6),
  ('messaging', 'messagerie privée', 7), ('testimonials', 'témoignages', 8), ('reviews', 'avis notés', 9),
  ('pricing', 'tarifs', 10), ('onboarding', 'parcours « Démarrer »', 11), ('directory', 'annuaire métier', 12),
  ('geo', 'géographie', 13), ('crm', 'suivi de contacts', 14), ('lms', 'formations', 15),
  ('marketplace', 'petites annonces', 16), ('adNetwork', 'régie publicitaire', 17),
  ('studio', 'pilotage', 18), ('showcase', 'composants et guide', 19), ('media', 'médiathèque', 20),
  ('pages', 'pages libres', 21), ('payments', 'paiement des formations', 22),
  ('reports', 'signalements', 23), ('search', 'recherche globale', 24), ('shop', 'boutique', 25)
) AS m(key, label, ordre)
ON CONFLICT (code) DO NOTHING;
