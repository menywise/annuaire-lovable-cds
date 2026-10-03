# Cloner CDS pour un nouveau projet

CDS est le **socle**. Chaque projet (annuaire des sites, manuelrohaut.fr, VDI…) est un **clone** : il
part du socle, règle son identité, allume ses modules, puis ajoute ce qui lui est propre **dans son
propre dépôt**. Le socle ne contient jamais rien de propre à un projet.

Durée indicative : une heure, hors contenus.

## 1. Créer le clone

1. Dans Lovable, ouvrir le projet **CDS Framework** → menu du projet → **Remix**. Nommer le clone
   (par exemple « Annuaire des sites »).
2. Dans le clone : **GitHub → Connect** pour créer son dépôt (`menywise/<nom>`).
3. Activer **Lovable Cloud** si ce n'est pas fait : le clone a sa propre base de données, vide.

## 2. Passer le SQL du socle

Le remix copie le code ; les données du socle ne suivent pas. Vérifier dans le clone (Cloud →
Database) si les tables existent déjà. Sinon, dans l'éditeur SQL du clone (Cloud → SQL), passer les
migrations de `supabase/migrations/` dans l'ordre des noms de fichiers. Pour les lots livrés en
blocs (`supabase/seed/<lot>/`), passer les blocs à la place de la migration, un par un.

Règles de l'éditeur de Lovable : il coupe le script à chaque ligne vide et refuse l'antislash et
l'opérateur « ? ». Les blocs du socle les respectent déjà.

## 3. Devenir administrateur

Créer son compte sur la prévisualisation du clone **avant de publier** : sur une base sans
administrateur, le premier compte qui se connecte devient administrateur, une seule fois. Les
suivants sont de simples membres ; un administrateur en nomme d'autres dans Administration →
Utilisateurs. Le dernier administrateur ne peut ni se retirer ni supprimer son compte.

## 4. Régler l'identité (Administration → Paramètres)

- Nom complet, nom court, signature.
- **Adresse publique** (`https://…`) : liens canoniques, plan du site, e-mails.
- Mentions légales (société, adresse, directeur de la publication) et hébergeur.
- **Apparence** : couleur principale, couleur de la barre du navigateur, logo, icône d'onglet,
  icône d'application et image de partage (déposées dans la médiathèque). Vide : habillage neutre.
- **Page d'accueil** : titre et texte de l'accueil par défaut, en attendant une page d'accueil du
  module « Pages ».
- **Envoi des e-mails** : sous-domaine délégué au service de Lovable (Cloud → Emails, par exemple
  `notify.exemple.fr`) et domaine de l'expéditeur (`exemple.fr`). Chaque site à domaine propre gère
  ses e-mails ; un site du studio sans domaine propre peut garder `notify.manuelrohaut.fr`.

## 5. Secrets d'environnement (Lovable → Cloud → Secrets)

| Secret | Quand | Rôle |
| --- | --- | --- |
| `LOVABLE_API_KEY` | toujours (fourni par Lovable) | service d'envoi des e-mails |
| `LOVABLE_CRON_SECRET` | conseillé | tâches planifiées (purge des messages de contact) |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | paiement des formations ou Boutique | Stripe ; webhook vers `<adresse>/api/stripe-webhook` |
| `CDS_RECETTE_*` (secrets GitHub) | recette en écriture réelle | comptes de test du robot |

Les clés ne vont jamais dans le code ni en base.

## 6. Choisir les modules (Administration → Modules)

Les modules sont les briques facultatives du projet : **tous éteints au départ**. Allumer ceux dont le
projet a besoin, dépendances comprises, puis enregistrer ; enregistrer sans rien allumer vaut aussi
choix. L'écran Démarrage reste « à faire » tant qu'aucun choix n'est enregistré. Un module éteint ne
laisse aucune trace (pages, menus, plan du site, administration).

Le pilotage (conformité, recettage), la médiathèque (logo, icônes, image de partage) et la recherche
ne sont pas des modules : ce sont des outils d'administration du socle, toujours allumés.

## 7. Retirer la démonstration (Administration → Démarrage)

L'écran **Démarrage** liste ce qui reste à régler et retire, en deux gestes :

- les **exemples de la recette** (contenus « Exemple — » et leur membre fictif) ;
- les **contenus de démarrage** (FAQ, offres, article d'origine), sauf ceux déjà modifiés.

## 8. Ajouter ce qui est propre au projet

Dans le dépôt du clone uniquement : nouvelles pages, nouvelles tables (migrations datées après
celles du socle), modules métier (par exemple la veille de sites pour l'annuaire).

## 9. Recevoir les améliorations du socle

Le socle évolue (nouveaux modules, correctifs). Pour les reporter dans un clone : ajouter le dépôt du
socle comme source distante, fusionner sa branche `main` dans le clone (jamais de réécriture
d'historique), puis passer dans la base du clone les nouvelles migrations du socle. Garder les
ajouts du clone dans des fichiers à part limite les conflits.
Mode d'emploi détaillé, ordre des étapes et exemple de l'annuaire : `docs/MISE_A_NIVEAU.md`.
