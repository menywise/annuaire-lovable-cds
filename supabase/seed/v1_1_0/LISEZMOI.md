# Socle 1.1.0 — blocs pour l'éditeur SQL de Lovable

Blocs 1 à 4 : même contenu que la migration
`supabase/migrations/20261003120000_v1_1_0_versions_installation.sql`, sans commentaires. Blocs 5
et 6 : propres à une installation (projet né d'un Remix du socle), à ne pas passer dans le socle.
Chaque bloc se passe seul, dans l'ordre. Tous sont rejouables.

| Bloc | Effet | Socle | Installation |
| --- | --- | --- | --- |
| `1_versions.sql` | Table `socle_versions` (versions publiées du socle), lecture publique. | oui | oui |
| `2_installation.sql` | Table `socle_installation` (version embarquée par cette base), lecture publique. | oui | oui |
| `3_historique.sql` | Lignes 1.0.0 et 1.1.0 de `socle_versions` (le Remix ne copie pas les données). | oui | oui |
| `4_reglage.sql` | Réglage « socle » à 1.1.0, jamais revu à la baisse. | oui | oui |
| `5_purge_nocturne.sql` | Replanifie la purge nocturne des messages de contact (le Remix ne copie pas la tâche pg_cron). | non | oui |
| `6_inscription.sql` | Inscrit la mise à niveau 1.1.0 dans `socle_installation`, datée du jour. | non | oui |
| `7_controle.sql` | Contrôle : 6 lignes. | oui | oui |

## Résultat attendu du bloc 7

| Contrôle | Socle | Installation |
| --- | --- | --- |
| versions publiees | 1.0.0 1.1.0 | 1.0.0 1.1.0 |
| reglage socle | 1.1.0 | 1.1.0 |
| registre installation | vide | 0.0.0 anterieur, 1.1.0 mise_a_niveau |
| politiques de lecture | 2 | 2 |
| starter_status | starter_status() | starter_status() |
| purge nocturne | 1 | 1 |
