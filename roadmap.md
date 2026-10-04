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
- MCP d'audit (`/mcp`) : 9 outils pour Claude et Letta, connexion par compte administrateur
- 6 briques optionnelles livrées et éteintes par défaut : annuaire métier, géographie, suivi de contacts, formations, petites annonces, régie publicitaire — base de données, pages publiques, pages d'administration, liens de menus, pied de page, plan du site et sitemap conditionnels
- V0 · lot 1 « Base » : règles d'accès visiteur, forum, messagerie, lettre d'information, admins du studio en base
- V0 · lot 2 « Socle » : paramètres du site lus côté serveur (source unique `site_settings`), zéro valeur en dur, 19 modules pilotés en base (écran « Modules »), écran « Utilisateurs et rôles », suppression de son compte avec anonymisation, annuaire des membres sur inscription volontaire
- V0 · lot 3 « Admin complet » : boîte de réception, contenus entièrement modifiables, offres créées et supprimées, modération verrouillée en base, confirmation avant toute suppression
- V0 · lot 4 : failles des briques 12 à 16 fermées en base (annonces, annuaire, formations) ; contenu des leçons protégé, règlements des formations payantes saisis en admin
- V0 · lot 5 A « Médiathèque » : envoi d'images et de PDF dans Supabase Storage (l'admin dépose, le public lit), écran d'administration, sélecteur d'image dans les formulaires (articles, formations, fiches, annonces, régie)
- V0 · lot 5 C « Pages libres » : pages par sections modifiables sans code, accueil compris (format de données Puck, éditeur maison)
- V0 · lot 6 : CRUD complet dans toute l'administration (annuaire, annonces, formations, régie, témoignages, thématiques du forum) et modération avec note visible (« Modéré par l'équipe : lien retiré »)
- V0 · lot 7 : recette automatisée (robot Playwright, 81 pages, visiteur/membre/admin, ordinateur et mobile, écran « Recette »), module D « Paiement » Stripe pour les formations, signalements de contenus, purge automatique des messages de contact après 3 ans
- V0 · lot 8 : qualité premium (accessibilité, HTML valide, SEO, sécurité, Firefox et Safari, vitesse et poids des pages, textes selon la charte)
- V0 · lot 9 : parcours cliqués (inscription, contact, forum, signalement, formation offerte) avec données « [recette] » purgées ; actifs en écriture réelle dès que les comptes de test sont fournis
- V0 · lot 10 : recherche globale (module F) en français sans accents sur tous les contenus publics, règles de visibilité du site respectées, loupe dans l'en-tête
- V0 · lot 11 : géographie complète au modèle de l'annuaire (régions, départements, intercommunalités, communes, codes postaux, coordonnées, voisinages) importée depuis geo.api.gouv.fr, pages communes
- Module K « Boutique » (30/09) : objets, PDF et livres numériques payés par Stripe, panier, stock, livraison forfaitaire (offerte au-delà d'un seuil), téléchargements réservés à l'acheteur, expédition et suivi en admin, CGV complétées ; éteint par défaut, SQL en 10 blocs + contrôle
- Thème tactile léger : surfaces hiérarchisées, cartes mieux détachées, champs creusés et états actifs renforcés
- Socle 1.1.0 (03/10) : registres des versions (`socle_versions` inscrite au dépôt, `socle_installation` ajoutée, réglage « socle » jamais revu à la baisse), migration `20261003120000_v1_1_0_versions_installation.sql`, test `test_20_versions_socle.sql` ; mode d'emploi de mise à niveau `docs/MISE_A_NIVEAU.md`
- Socle 1.2.0 (03/10) : les 22 modules facultatifs éteints par défaut, choisis au lancement dans l'écran Démarrage (choix daté en base) ; pilotage, médiathèque et recherche deviennent des outils d'administration toujours allumés. Migration `20261003150000_v1_2_0_modules_facultatifs.sql`, test `test_21_modules_facultatifs.sql`

## En attente (décision du 29/09 : « beaucoup à faire avant de lancer les paiements »)

- Paiement Stripe : code prêt et éteint. Avant activation : SQL du lot 7 b (double paiement), secrets `STRIPE_SECRET_KEY` et `STRIPE_WEBHOOK_SECRET`, webhook, parcours test 4242
- E-mails (module B) : envoi installé sur notify.manuelrohaut.fr (e-mails de compte + base des e-mails du site) ; en attente de la validation du domaine chez le registraire
- Purge planifiée des messages de contact dans les installations : le Remix ne recopie pas la tâche pg_cron du socle, la mise à niveau la replanifie
- Paiement des offres de la page Tarifs (abonnements)

## À venir (validé le 30/09)

Premier projet à dupliquer et mettre en conformité : **l'annuaire des sites français** (`annuaire-mac97000`). Il fixe l'ordre des lots 10 à 13.

1. ~~Lot 13 a · Kit de démarrage~~ ✅ (01/10) — identité et domaine d'envoi des e-mails lus dans les réglages (plus aucune adresse de projet dans le code, vérifié par un test), écran Administration → Démarrage, retrait de la démonstration en deux gestes, mode d'emploi `docs/CLONER.md`.
2. **Lot 13 b · Premier clone : l'annuaire des sites** (hors socle, **en pause le 03/10** jusqu'à la fin de la génération du socle et au plan d'action des briques et modules ; tous les modules restent éteints par défaut) — l'annuaire est un clone de CDS, pas une partie du socle. Il reçoit la veille de sites (code prêt : commit `b37f902`, PR #16 fermée sans merge le 01/10), ses données reprises. Sortie de la V0 : grille de conformité à 100 %, robot vert, chaque module « fini » (8 critères de V0.md).
3. **Lot 14 · Briques externes** — Umami (audience sans cookie), zone Revive dans l'emplacement Régie, Ghost en cohabitation.
4. **Lot 15 · Pages libres v2** — éditeur de menu, historique des versions ; Puck quand la dépendance pourra être validée côté Lovable.
5. **Lot 16 · Tri des douze fonctionnalités concurrentes** (03/10) — douze fonctionnalités observées chez un concurrent, triées par une règle unique : une fonctionnalité qui a besoin de savoir qui est le membre connecté s'écrit dans le socle ; une fonctionnalité qui n'en a pas besoin se branche sur un logiciel séparé, comme Umami, Revive Adserver, Shlink et Meilisearch (sinon ce logiciel tiendrait ses propres comptes, une seconde liste de membres à côté de celle du socle).
   - **Branchées sur un logiciel séparé, hors du socle :**
     - *Générateur de QR codes* — version simple : bibliothèque de génération d'image, rien à stocker ; version qui compte les scans : Shlink, déjà retenu au lot 14.
     - *Publication sur les réseaux sociaux* — le socle envoie un texte, une image et une date, et reçoit « publié » ou « échoué » ; aucun membre concerné.
     - *Devis* et *Factures* — une seule et même décision : même moteur de document, même numérotation. Le client d'une facture est une entité comptable à conserver dix ans, incompatible avec l'anonymisation à la suppression du compte imposée par le socle.
     - *Signature électronique* — le logiciel reçoit un document et une adresse, il renvoie une preuve. Un système qui fabrique et conserve lui-même sa preuve n'est pas un tiers de confiance.
   - **Écrites dans le socle :**
     - *Tunnels de vente* — le parcours finit par un paiement rattaché à un compte ; seule la mesure de fréquentation part chez Umami.
     - *Agenda de prise de rendez-vous* — c'est le module G Rendez-vous déjà déclaré dans V0.md, pas un nouveau module. Un rendez-vous appartient à un membre.
     - *Relances et rappels automatiques* — c'est le module E Notifications déjà déclaré dans V0.md, pas un nouveau module. Le scénario lit l'état d'un prospect ou d'un membre en base ; seul l'envoi du courriel part chez un service d'envoi, par le module B E-mails transactionnels.
     - *Sondages et quiz* — un score appartient à un élève et complète le suivi de progression du module Formations.
     - *Formations enrichies* — il manque trois choses au module Formations existant : le certificat, l'expiration des accès, le calcul d'un pourcentage d'avancement.
   - **Coupées en deux :**
     - *Gestion de contrats* — le document se branche à l'extérieur ; les échéances, préavis et reconductions s'écrivent dans le socle, puisque ce sont des relances (module E Notifications).
     - *Assistant IA de rédaction* — rien à brancher, rien à construire. Le sujet réel est l'ouverture de la liste des outils que Claude peut appeler sur le site, aujourd'hui fermée dans le code : rattaché aux accroches manquantes de l'audit du 02/10 (`AUDIT_LOI_QUATRE_INTERDITS.md`), pas à une fonctionnalité.
   - **Deux préalables communs** aux cinq fonctionnalités écrites dans le socle (*Tunnels de vente*, *Agenda de prise de rendez-vous*, *Relances et rappels automatiques*, *Sondages et quiz*, *Formations enrichies*) : (1) le module B E-mails transactionnels, non livré ; (2) un déclencheur automatique à heure fixe : pg_cron est actif dans la base du socle (tâche `cds_purge_contact_messages`), il suffira d'y planifier chaque nouvelle tâche ; la route `/api/cron/purge-contact`, protégée par `LOVABLE_CRON_SECRET`, sert de secours. Le premier préalable reste bloquant : aucune de ces cinq fonctionnalités ne se planifie avant le module B.
6. **Ensuite** — E Notifications (sur le site d'abord), H Événements, I Réalisations, G Rendez-vous, dans l'ordre des besoins des projets. Rôle Modérateur (reporté le 29/09).

## Décisions du 30/09 (soir)

- **01/10 — Le socle ne contient rien de propre à un projet** : la veille de sites (ex-lot 12) part dans le clone de l'annuaire. Chaque projet est un clone du socle.

- **Ordre** : correctifs de sécurité des projets Lovable (faits : kairognosia, skiagnosia, goldwing, annuaire) → lot 13 a kit de démarrage (socle) → lot 13 b clone annuaire avec sa veille de sites (hors socle), puis manuelrohaut.fr, puis VDI → lot 14 Coolify + Umami.
- **Kit (13 a)** ✅ : nom du site, adresse et domaine d'envoi des e-mails lus dans les réglages.
- **manuelrohaut.fr** : devient la vitrine du studio (parcours, projets, CDS), sur une duplication CDS hébergée chez Lovable pour l'instant ; Bootstrap sur VPS plus tard. Refondation : ni redirections 301 ni reprise des anciens articles (réécrits par un agent). S'appuie sur la Boutique.
- **VDI et Beautysané** : sites de niche sur sous-domaines. Les sites WordPress migrent vers des duplications CDS ; le socle vit hors projet.
- **E-mails** : chaque site à domaine propre gère ses e-mails ; les sites Lovable du studio peuvent rester sur notify.manuelrohaut.fr.
- **VPS** : feu vert au début du lot 14 (d'ici là, mutualisé OVH).

## Points de vigilance

- `/tarifs` sur mobile : bouton principal sous la ligne de flottaison (remarque c2 du robot, antérieure au lot 10)

- Comptes de test membre et admin à fournir (secrets GitHub `CDS_RECETTE_*`) : sans eux, recette membre/admin simulée et parcours sans écriture réelle

- Vulnérabilités js-yaml héritées de @tanstack/react-start : aucun correctif amont, à re-vérifier
- Test au lecteur d'écran : manuel, reste à faire (lot 8)
- Temps de réponse serveur du blog entre 800 et 1 400 ms (30/09) : à surveiller avec le robot (p5)
- [x] Modèles d'e-mails de compte à l'identité CDS (français, Inter, bleu de marque, thème clair) : inscription, invitation, lien magique, mot de passe oublié, changement d'adresse, code de vérification
