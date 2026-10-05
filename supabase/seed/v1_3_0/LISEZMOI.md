# Socle 1.3.0 — blocs pour l'éditeur SQL de Lovable

Blocs 1 à 5 : même contenu que la migration
`supabase/migrations/20261004120000_v1_3_0_accroches_greffes.sql`, sans commentaires. Bloc 6 :
propre à une installation (projet né d'un Remix du socle), à ne pas passer dans le socle. Chaque
bloc se passe seul, dans l'ordre, après ceux de la 1.2.0. Tous sont rejouables.

| Bloc | Effet | Socle | Installation |
| --- | --- | --- | --- |
| `1_cle_greffe.sql` | La base reconnaît une clé de module de projet (`greffe_<nom>`). | oui | oui |
| `2_etat_module.sql` | Un module de projet est lu par les règles d'accès, éteint par défaut. | oui | oui |
| `3_controle_reglage.sql` | Le réglage « modules » accepte les clés `greffe_…` (vrai ou faux). | oui | oui |
| `4_extension_annuaire.sql` | Deux fonctions donnent les droits d'une fiche de l'annuaire à une table de greffe. | oui | oui |
| `5_version.sql` | Version 1.3.0 publiée, réglage « socle » à 1.3.0. | oui | oui |
| `6_inscription.sql` | Inscrit la mise à niveau 1.3.0 dans `socle_installation`, datée du jour. | non | oui |
| `7_controle.sql` | Contrôle : 6 lignes. | oui | oui |

## Résultat attendu du bloc 7

| Contrôle | Valeur |
| --- | --- |
| version du socle | 1.3.0 |
| cle greffe reconnue | true |
| module de projet eteint par defaut | true |
| modules de projet allumes | aucun (ou ceux du projet, une fois allumés) |
| fonctions des fiches | 2 |
| versions publiees | 1.0.0 1.1.0 1.2.0 1.3.0 |
