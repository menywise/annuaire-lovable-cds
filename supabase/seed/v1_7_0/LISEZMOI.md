# Socle 1.7.0 — blocs pour l'éditeur SQL de Lovable

Blocs 1 à 4 et 6 : même contenu que la migration
`supabase/migrations/20261015120000_v1_7_0_signalements_ouverts.sql`, sans commentaires. Blocs 5 et 7 :
propres à une installation, à ne pas passer dans le socle (le Remix ne copie pas la tâche pg_cron). Chaque
bloc se passe seul, dans l'ordre, après ceux de la 1.6.1. Tous sont rejouables.

**Ordre avec le code : passer les blocs d'abord, fusionner le code 1.7.0 aussitôt après.** Le code 1.7.0
envoie les signalements par `report_submit` et lit `report_status` et `report_improvements`, que seule la
base 1.7.0 connaît : s'il arrivait avant la base, le bouton « Signaler », la page de suivi et la page des
améliorations tomberaient en erreur. L'ancien code reste compatible avec la base 1.7.0 (insertion directe
d'un membre inchangée).

| Bloc                  | Effet                                                                                                                       | Socle | Installation |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------- | ----- | ------------ |
| `1_table.sql`         | `reports` : signaleur facultatif (visiteur), source, valeur proposée, adresse facultative, code de suivi, réponse publique ; motifs « oubli » et « correction », type « page », un lien au plus ; dépôt figé au traitement. | oui   | oui          |
| `2_envoi.sql`         | `report_submit` : envoi d'un visiteur ou d'un membre, champ piège, plafonds des visiteurs (CDS04, CDS05, CDS06).            | oui   | oui          |
| `3_suivi.sql`         | `report_status` (suivi par code) et `report_improvements` (page « Le site s'améliore grâce à vous »).                        | oui   | oui          |
| `4_effacement.sql`    | `purge_report_contacts` : adresse du visiteur effacée 3 mois après le traitement, 12 mois sans traitement.                   | oui   | oui          |
| `5_planification.sql` | Planifie l'effacement chaque nuit à 03:27 (pg_cron).                                                                         | non   | oui          |
| `6_version.sql`       | Point V1-SIGNALEMENTS-VISITEURS de la grille ; version 1.7.0 publiée, réglage « socle » à 1.7.0.                            | oui   | oui          |
| `7_inscription.sql`   | Inscrit la mise à niveau 1.7.0 dans `socle_installation`.                                                                    | non   | oui          |
| `8_controle.sql`      | Contrôle : 10 lignes.                                                                                                        | oui   | oui          |

## Résultat attendu du bloc 8

| Contrôle                       | Valeur |
| ------------------------------ | ------ |
| version du socle               | 1.7.0  |
| colonnes de la 1.7.0           | 5      |
| signaleur facultatif           | YES    |
| contraintes de la 1.7.0        | 7      |
| fonctions de la 1.7.0          | 4      |
| visiteur envoie un signalement | true   |
| visiteur ecrit en direct       | false  |
| visiteur efface les adresses   | false  |
| point de la grille             | 1      |
| version 1.7.0 publiee          | 1      |

## À vérifier après le passage

Administration → Modules : « Signalements de contenus » allumé. Sur une page publique, le bouton
« Signaler une erreur » s'ouvre sans compte ; l'envoi rend un code de suivi, lisible sur `/signalement`.
Administration → Signalements : le signalement du visiteur porte la mention « Visiteur » ; une réponse
publique sur un signalement « Action prise » apparaît sur `/ameliorations`.
