# Socle 1.4.0 — blocs pour l'éditeur SQL de Lovable

Blocs 1 à 5 : même contenu que la migration
`supabase/migrations/20261005120000_v1_4_0_grille_par_module.sql`, sans commentaires. Bloc 6 :
propre à une installation, à ne pas passer dans le socle. Chaque bloc se passe seul, dans l'ordre,
après ceux de la 1.3.0. Tous sont rejouables et ne touchent pas aux états déjà cochés.

| Bloc | Effet | Socle | Installation |
| --- | --- | --- | --- |
| `1_colonne_modules.sql` | Chaque point de la grille porte ses modules (vide : tout site). | oui | oui |
| `2_perimetre.sql` | La base dit si un point est dans le périmètre (un de ses modules allumé). | oui | oui |
| `3_rattachement.sql` | Les points existants sont rattachés à leur module (blog, FAQ, forum…). | oui | oui |
| `4_points_modules.sql` | Un point « module fini » par module (25). | oui | oui |
| `5_version.sql` | Version 1.4.0 publiée, réglage « socle » à 1.4.0. | oui | oui |
| `6_inscription.sql` | Inscrit la mise à niveau 1.4.0 dans `socle_installation`. | non | oui |
| `7_controle.sql` | Contrôle : 6 lignes. | oui | oui |

## Résultat attendu du bloc 7

| Contrôle | Valeur |
| --- | --- |
| version du socle | 1.4.0 |
| points de la grille | 67 (42 + 25), davantage si le site a ajouté les siens |
| points rattaches a un module | 44 |
| points module fini | 25 |
| points dans le perimetre | dépend des modules allumés |
| dont conformes | dépend de la recette du site |
