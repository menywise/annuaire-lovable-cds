# CDS — Feuille de route

> La feuille de route se pilote désormais depuis `/admin/pilotage` (visible par les membres sur `/pilotage`).

## Fait
- Tokens CDS (thème clair uniquement), typographie Inter, rayons et ombres
- Bibliothèque de composants (`/composants`)
- Comptes réels : inscription, connexion Google ou e-mail, vérification, mot de passe oublié
- Espace connecté : tableau de bord, mon compte, mon profil (dont profil public), pilotage, messagerie
- Back-office `/admin` : paramètres, contenus, modération, forum, témoignages, pilotage, abonnés + export CSV
- Modules publics : FAQ, blog + commentaires, avis, lettre d'information, tarifs, tunnel `/demarrer`
- Forum communautaire : texte enrichi, thématiques, vues, j'aime, suivi, réponse retenue, discussions récentes, membres les plus actifs
- Annuaire des membres, profils publics et messagerie privée
- Témoignages : page publique, dépôt par les membres, validation et mise en avant en administration
- Navigation : en-tête collant, menu visiteur ≠ menu connecté, hamburger 44 px, pied de page en 4 colonnes + lettre d'information
- Installation sur mobile (manifeste + icônes), sans service worker
- SEO : `seo()` sur chaque page, canonical, Open Graph/Twitter, JSON-LD, sitemap dynamique, robots.txt

## À venir
- Paiements réels (Stripe ou Paddle) branchés sur les offres tarifaires — choix du prestataire à valider
- Vulnérabilités js-yaml héritées de @tanstack/react-start : aucun correctif amont disponible, à re-vérifier
- Mesures non réalisées : poids des fichiers livrés, temps de réponse, test mobile réel, test lecteur d'écran

## Ouvert (bloqué)
- Envoi réel par e-mail des messages de contact : nécessite la configuration d'un domaine d'envoi
