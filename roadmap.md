# CDS — Feuille de route

## Fait
- Tokens CDS (thème clair uniquement), typographie Inter, rayons et ombres, source de vérité `CDS_TOKENS.md`
- Bibliothèque de composants (`/composants`)
- Comptes réels : inscription, connexion Google et e-mail, vérification, mot de passe oublié
- Espace connecté : tableau de bord, mon compte, mon profil public, messagerie
- Back-office `/admin` : paramètres, contenus, modération, forum, témoignages, pilotage, conformité, abonnés
- Communauté : forum enrichi (thématiques, j'aime, suivi, réponse retenue, membres actifs), annuaire, messagerie privée, témoignages
- Blog de niveau communauté : recherche, étiquettes, temps de lecture, texte enrichi, articles liés, commentaires modérés, partage, flux RSS
- FAQ : recherche, sommaire par catégorie, ancres, données structurées FAQPage
- SEO : `seo()` partout, canonical, Open Graph/Twitter, JSON-LD, sitemap dynamique, robots.txt, flux RSS
- Installation sur l'écran d'accueil (manifeste + icônes)
- Pilotage : plan directeur, feuille de route, audits avec mémoire, **grille de conformité du modèle** avec score et audits datés

## En pause (décision utilisateur)
- Paiement des offres — sera Stripe, activation plus tard
- Envoi des e-mails — passera par le domaine des projets, configuration plus tard

## À venir
- Vulnérabilités js-yaml héritées de @tanstack/react-start : aucun correctif amont, à re-vérifier
- Mesures non réalisées : poids des fichiers livrés, temps de réponse, test mobile réel, test lecteur d'écran
