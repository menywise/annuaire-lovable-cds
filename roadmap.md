# CDS — Feuille de route

## Fait
- Tokens CDS (thème clair uniquement), typographie Inter, rayons et ombres
- Bibliothèque de composants (`/composants`)
- Comptes réels : inscription, connexion, vérification e-mail, mot de passe oublié, nouveau mot de passe
- Espace connecté : tableau de bord, mon compte, mon profil
- Back-office `/admin` : paramètres du site, contenus (FAQ, offres, articles), modération (avis, commentaires, forum), abonnés + export CSV
- Modules publics : FAQ, blog + commentaires modérés, forum, avis et notations, lettre d'information, tarifs, tunnel de vente `/demarrer`
- Notifications colorées par type, menu mobile, bandeau cookies, liens avec attribut `title`
- Pages légales dynamiques (pilotées par l'administration), page de maintenance, page de remerciement, 404 et erreur en français
- SEO : `seo()` sur chaque page, canonical, Open Graph/Twitter, JSON-LD Organization / FAQPage / BlogPosting / fil d'Ariane, sitemap dynamique (articles + discussions), robots.txt

## À venir
- Paiements réels (Stripe ou Paddle) branchés sur les offres tarifaires
- Réécriture DISC des derniers textes hérités (pages légales, écrans d'authentification)

## Ouvert (bloqué)
- Envoi réel par e-mail des messages de contact : nécessite la configuration d'un domaine d'envoi
