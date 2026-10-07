# Socle 1.6.0 — blocs pour l'éditeur SQL de Lovable

Blocs 1 à 3 : même contenu que la migration `supabase/migrations/20261007220000_v1_6_0_activites.sql`,
sans commentaires. Bloc 4 : propre à une installation, à ne pas passer dans le socle. Chaque bloc se passe
seul, dans l'ordre, après ceux de la 1.5.0. Tous sont rejouables.

**Ordre avec le code : indifférent.** Le code 1.6.0 ne lit pas encore la table `activites` (seuls les types
générés la déclarent) ; la base peut passer avant ou après la fusion.

| Bloc                | Effet                                                                                                   | Socle | Installation |
| ------------------- | ------------------------------------------------------------------------------------------------------- | ----- | ------------ |
| `1_table.sql`       | Table `activites` : lecture publique des activités actives, écriture réservée à l'administrateur.      | oui   | oui          |
| `2_registre.sql`    | Les 164 entrées du registre eqNAF (copie de la table `eqnaf` de la base SCM au 07/10/2026).              | oui   | oui          |
| `3_version.sql`     | Version 1.6.0 publiée, réglage « socle » à 1.6.0.                                                       | oui   | oui          |
| `4_inscription.sql` | Inscrit la mise à niveau 1.6.0 dans `socle_installation`.                                               | non   | oui          |
| `5_controle.sql`    | Contrôle : 6 lignes.                                                                                    | oui   | oui          |

## Résultat attendu du bloc 5

| Contrôle                      | Valeur |
| ----------------------------- | ------ |
| version du socle              | 1.6.0  |
| activites                     | 164    |
| professionnelles cadran S     | 120    |
| non professionnelles cadran E | 44     |
| categories                    | 29     |
| visiteur ecrit activites      | false  |

## Source et mises à jour

La source de vérité du registre est la table `eqnaf` de la base SCM (décision D-ESH-2026-10-06-01). Le bloc 2
en est la copie au 07/10/2026, vérifiée par empreinte. Une activité rencontrée sur le terrain s'ajoute d'abord
dans la base SCM, puis arrive dans les projets par une version suivante du socle. Le bloc 2 met à jour les
entrées existantes sans toucher à celles qu'un projet aurait ajoutées.
