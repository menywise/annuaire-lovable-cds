# CDS — Passer au niveau supérieur

Objectif : sortir du « minimum viable » et livrer un modèle complet, au niveau d'une vraie communauté (référence citée : community.cube.fr), avec témoignages, navigation professionnelle, installation sur mobile et un tableau de bord de pilotage.

Le travail est découpé en 5 lots. Ils peuvent être livrés dans cet ordre.

---

## Lot 1 — Forum de niveau communauté

Ce qui existe aujourd'hui : une liste de sujets et des réponses en texte brut. Ce qui est ajouté :

- **Texte enrichi** : éditeur avec gras, italique, listes, liens, citations et blocs de code, pour les sujets et les réponses (nettoyage du contenu à l'affichage pour éviter toute injection).
- **Thématiques** : catégories gérées depuis l'administration (nom, couleur, description), filtre par thématique, page dédiée par thématique.
- **Discussions récentes** : colonne latérale avec les derniers sujets et les dernières réponses.
- **Membres les plus actifs** : classement sur 7 jours, 30 jours et depuis toujours, calculé à partir des sujets, réponses et « j'aime » reçus.
- **J'aime, suivre, partager** : bouton « j'aime » sur les sujets et réponses, « suivre une discussion » (avec liste de ce que je suis dans mon espace), partage déjà en place étendu au forum.
- **Réponse acceptée** : l'auteur peut marquer la réponse qui l'a aidé ; elle remonte en tête.
- **Fil d'Ariane, pagination, compteurs** (réponses, vues) sur chaque sujet.

## Lot 2 — Profils membres et messagerie

- **Annuaire des membres** : page publique listant les membres ayant accepté d'y figurer, avec recherche et tri par activité.
- **Profil public** : pseudo, avatar, présentation courte, date d'arrivée, statistiques (sujets, réponses, j'aime), dernières contributions.
- **Réglages de visibilité** : chaque membre choisit d'apparaître ou non dans l'annuaire et d'accepter ou non les messages privés.
- **Messagerie privée** : conversations entre membres, liste des échanges, pastille de messages non lus, blocage et signalement.
- **Modération** : les signalements arrivent dans l'espace d'administration existant.

## Lot 3 — Témoignages

- Module **témoignages** distinct des avis notés : texte, photo, prénom, rôle/métier, entreprise, résultat obtenu.
- **Page publique dédiée** + bandeau de témoignages réutilisable sur l'accueil, les tarifs et le tunnel « Démarrer ».
- **Dépôt d'un témoignage** par formulaire, validation en administration avant publication.
- Balisage structuré pour les moteurs de recherche.

## Lot 4 — Navigation, responsive, installation sur mobile

- **En-tête fixe** avec réduction au défilement ; menu différent selon que l'on est visiteur ou connecté (espace, messages, notifications, déconnexion).
- **Menu mobile plein écran**, zones cliquables d'au moins 44 px partout.
- **Pied de page 4 colonnes** (Découvrir / Communauté / Ressources / Légal) avec inscription à la lettre d'information intégrée.
- **Responsive revu** : cartes défilables horizontalement sur mobile, tarifs empilés en colonne, aucun débordement horizontal — vérifié écran par écran.
- **Installation sur mobile** : le site devient installable depuis le navigateur (icône sur l'écran d'accueil, nom et couleurs de la marque). Pas de mode hors connexion, sauf demande explicite.
- **Vérification de tous les liens** du site, un par un.

## Lot 5 — Tableau de bord de pilotage

- **Feuille de route** : les tâches passent du fichier texte à une page gérée en base (statut, priorité, lot), modifiable depuis l'administration.
- **Plan directeur** : vision, cibles, modules activés, décisions prises — éditable, sans toucher au code.
- **Audits avec mémoire** : chaque audit est enregistré (date, score, anomalies par gravité) ; le tableau de bord affiche l'évolution du score entre deux audits et ce qui a été corrigé depuis le précédent.
- Vue d'ensemble : activité de la communauté, inscriptions, contenus en attente de modération.

---

## Points techniques

- Nouvelles tables : `forum_categories`, `forum_likes`, `forum_follows`, `member_profiles`, `conversations`, `messages`, `testimonials`, `roadmap_items`, `masterplan`, `audits`, `audit_findings` — chacune avec RLS et GRANT explicites.
- Texte enrichi : éditeur léger, stockage en HTML assaini côté serveur avant insertion.
- Classements et compteurs : vues SQL ou fonctions `security definer` pour éviter les requêtes lourdes côté client.
- Installation mobile : manifeste + icônes uniquement, sans agent de service (pour ne pas casser l'aperçu).
- Chaque nouvelle page publique : `seo()`, titre unique, description, Open Graph, attribut `title` sur chaque lien, ton DISC orienté bénéfices.
- Tout paramètre reste réglable depuis `/admin`, jamais dans un fichier.

## Hors périmètre de ce plan

- Paiement réel des offres (Stripe ou Paddle) : en attente de votre choix de prestataire.
- Envoi des messages de contact par e-mail : nécessite un domaine d'envoi.
