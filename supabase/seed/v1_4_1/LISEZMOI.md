# Socle 1.4.1 — blocs pour l'éditeur SQL de Lovable

Blocs 1 à 5 : même contenu que la migration
`supabase/migrations/20261005150000_v1_4_1_correctifs.sql`, sans commentaires. Bloc 6 : propre à une
installation, à ne pas passer dans le socle. Chaque bloc se passe seul, dans l'ordre, après ceux de la
1.4.0. Tous sont rejouables.

**Ordre avec le code : fusionner d'abord le code 1.4.1, ensuite passer les blocs.** Le bloc 3 supprime
la colonne `roadmap_items.public_visible` ; l'écran Pilotage d'avant la 1.4.1 la lit encore et tomberait
en erreur si la base passait avant le code.

| Bloc                           | Effet                                                                                       | Socle | Installation |
| ------------------------------ | ------------------------------------------------------------------------------------------- | ----- | ------------ |
| `1_geographie.sql`             | Protection de `geo_places` réaffirmée ; aucune écriture pour un visiteur sur la géographie. | oui   | oui          |
| `2_annuaire.sql`               | Annuaire éteint : un membre ne crée plus de fiche, d'avis ni de demande de propriété.       | oui   | oui          |
| `3_pilotage.sql`               | Colonne `public_visible` de la feuille de route supprimée.                                  | oui   | oui          |
| `4_tables_sans_protection.sql` | Fonction `tables_sans_protection()` (admin) et point de grille SEC-RLS.                     | oui   | oui          |
| `5_version.sql`                | Version 1.4.1 publiée, réglage « socle » à 1.4.1.                                           | oui   | oui          |
| `6_inscription.sql`            | Inscrit la mise à niveau 1.4.1 dans `socle_installation`.                                   | non   | oui          |
| `7_controle.sql`               | Contrôle : 7 lignes.                                                                        | oui   | oui          |

## Résultat attendu du bloc 7

| Contrôle                        | Valeur |
| ------------------------------- | ------ |
| version du socle                | 1.4.1  |
| tables sans protection          | 0      |
| regles geo_places               | 2      |
| visiteur peut ecrire geo_places | false  |
| colonne public_visible          | 0      |
| point SEC-RLS                   | 1      |
| annuaire ferme si eteint        | 2      |
