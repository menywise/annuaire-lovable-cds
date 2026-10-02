# Identité neutre — blocs pour l'éditeur SQL de Lovable

Même contenu que la migration `supabase/migrations/20261002090000_v0_identite_neutre.sql`, découpé
pour l'éditeur SQL de Lovable : pas de ligne vide dans une fonction, ni antislash ni point
d'interrogation. Chaque bloc se passe seul, dans l'ordre. Tous sont rejouables.

| Bloc | Effet |
| --- | --- |
| `1_verrou.sql` | Crée le verrou du premier administrateur ; le ferme si la base a déjà un administrateur. |
| `2_inscription.sql` | Nouvelle création de compte : premier compte d'une base sans administrateur = administrateur, une seule fois. |
| `3_dernier_admin.sql` | La base refuse de retirer le dernier administrateur (rétrogradation, suppression du compte, suppression depuis la base). |
| `4_adresses.sql` | La liste des adresses nommées d'avance peut être vide ; retire les adresses déjà utilisées (compte existant et déjà administrateur). |
| `5_conformite.sql` | Ligne V0-IDENTITE-NEUTRE dans la grille de conformité. |
| `6_controle.sql` | Contrôle : 5 lignes. |

## Résultat attendu du bloc 6

| Contrôle | Socle CDS (2 administrateurs) | Projet neuf (aucun administrateur) |
| --- | --- | --- |
| verrou | 1 | 0, puis 1 après la première connexion |
| administrateurs | 2 | 0, puis 1 |
| adresses nommees d avance | 0 | 0 |
| declencheur dernier admin | 1 | 1 |
| ancien declencheur liste | 0 | 0 |

## Données supprimées

Le bloc 4 supprime de `studio_admins` les adresses dont le compte existe déjà et est déjà
administrateur. Le rôle reste acquis dans `user_roles` : personne ne perd ses droits. Sur une base
sans aucun compte, il vide la liste (elle ne peut venir que d'une ancienne migration).

## Projet « Annuaire Lovable CDS »

Un compte existe, sans administrateur. Après les blocs 1 à 4, ce compte devient administrateur à sa
prochaine connexion (déconnexion puis reconnexion).

## Habillage du socle CDS lui-même

Le socle est désormais neutre (couleur ardoise, icônes sans marque). Pour retrouver l'habillage de
ce projet : Administration → Paramètres → Apparence, couleur principale `#0d6efd`, puis logo, icônes
et image de partage déposés dans la médiathèque. Les anciennes images restent récupérables dans
l'historique git (`public/og-cds.jpg`, `public/favicon.png`, `public/apple-touch-icon.png`,
`public/icon-512.png` au commit `5638236`).
