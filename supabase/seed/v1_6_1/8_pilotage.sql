DELETE FROM public.masterplan_sections m
USING (VALUES
  ('Vision', 'CDS est le socle commun de tous les projets du workspace : un thème, un kit de pages système et une communauté prêts à être réutilisés sans repartir de zéro.', 1),
  ('Pour qui', 'Indépendants, artisans et solopreneurs qui veulent un site sérieux sans recommencer chaque fondation à chaque projet.', 2),
  ('Promesse', 'Vous démarrez un nouveau projet avec des fondations déjà auditées : accessibilité, référencement, mentions légales, comptes et communauté.', 3),
  ('Modules activés', 'FAQ, blog, forum, avis, témoignages, lettre d''information, tarifs, tunnel de vente, espace membre, messagerie, administration.', 4)
) AS s(title, content, position)
WHERE m.title = s.title AND m.content = s.content AND m.position = s.position;
DELETE FROM public.roadmap_items r
USING (VALUES
  ('Forum communautaire', 'Thématiques, texte enrichi, j''aime, suivi, réponse acceptée, membres actifs.', 'Lot 1', 'en_cours', 'haute', 1),
  ('Profils et messagerie', 'Annuaire des membres, profil public, messages privés.', 'Lot 2', 'en_cours', 'haute', 2),
  ('Témoignages', 'Page dédiée, bandeau réutilisable, validation en administration.', 'Lot 3', 'en_cours', 'normale', 3),
  ('Navigation et mobile', 'En-tête fixe, pied de page 4 colonnes, installation sur mobile, responsive vérifié.', 'Lot 4', 'en_cours', 'haute', 4),
  ('Tableau de bord de pilotage', 'Feuille de route, plan directeur, audits avec mémoire.', 'Lot 5', 'en_cours', 'normale', 5),
  ('Paiement des offres', 'Brancher Stripe ou Paddle sur les offres tarifaires.', 'À venir', 'bloque', 'haute', 6),
  ('Envoi e-mail du contact', 'Acheminer les messages de contact par e-mail.', 'À venir', 'bloque', 'normale', 7)
) AS s(title, description, lot, status, priority, position)
WHERE r.title = s.title AND r.description = s.description AND r.lot = s.lot
  AND r.status = s.status AND r.priority = s.priority AND r.position = s.position;
UPDATE public.template_checks
SET requirement = 'Les 8 critères d''un module fini : interrupteur, aucune trace éteint, accès testés, administration complète, états de page, SEO, test automatique, ligne cochée.'
WHERE code LIKE 'MOD-%'
  AND requirement = 'Les 8 critères de V0.md §4 : interrupteur, aucune trace éteint, accès testés, administration complète, états de page, SEO, test automatique, ligne cochée.';
