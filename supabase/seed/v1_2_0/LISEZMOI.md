# Socle 1.2.0 — blocs pour l'éditeur SQL de Lovable

Blocs 1 à 7 : même contenu que la migration
`supabase/migrations/20261003150000_v1_2_0_modules_facultatifs.sql`, sans commentaires. Bloc 8 :
propre à une installation (projet né d'un Remix du socle), à ne pas passer dans le socle. Chaque
bloc se passe seul, dans l'ordre, après ceux de la 1.1.0. Tous sont rejouables.

| Bloc | Effet | Socle | Installation |
| --- | --- | --- | --- |
| `1_valeurs_par_defaut.sql` | 22 modules éteints par défaut ; pilotage, médiathèque, recherche allumés. | oui | oui |
| `2_etat_module.sql` | Les outils d'administration répondent toujours « allumé » aux règles d'accès. | oui | oui |
| `3_controle_reglage.sql` | La base refuse d'éteindre un outil d'administration. | oui | oui |
| `4_date_du_choix.sql` | Un administrateur qui enregistre les modules date son choix (réglage « demarrage »). | oui | oui |
| `5_bases_existantes.sql` | Choix déjà fait par un admin : gardé et daté. Aucun choix : tout éteint sauf les outils. | oui | oui |
| `6_etat_demarrage.sql` | L'écran Démarrage sait si les modules ont été choisis. | oui | oui |
| `7_version.sql` | Version 1.2.0 publiée, réglage « socle » à 1.2.0. | oui | oui |
| `8_inscription.sql` | Inscrit la mise à niveau 1.2.0 dans `socle_installation`, datée du jour. | non | oui |
| `9_controle.sql` | Contrôle : 6 lignes. | oui | oui |

## Résultat attendu du bloc 9

| Contrôle | Socle | Installation sans choix de modules |
| --- | --- | --- |
| version du socle | 1.2.0 | 1.2.0 |
| modules eteints par defaut | 22 | 22 |
| outils toujours allumes | media search studio | media search studio |
| modules allumes | ceux choisis par l'admin | aucun |
| choix des modules date | date du dernier enregistrement | pas encore |
| declencheur du choix | 1 | 1 |

Installation sans choix : ouvrir Administration → Modules, allumer les briques du projet, enregistrer.
L'étape « Modules » de l'écran Démarrage passe alors à « fait ».
