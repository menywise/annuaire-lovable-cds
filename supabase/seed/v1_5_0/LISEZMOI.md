# Socle 1.5.0 — blocs pour l'éditeur SQL de Lovable

Blocs 1 à 3 : même contenu que la migration
`supabase/migrations/20261007200000_v1_5_0_referentiel_studio.sql`, sans commentaires. Bloc 4 : propre à
une installation, à ne pas passer dans le socle. Chaque bloc se passe seul, dans l'ordre, après ceux de
la 1.4.1. Tous sont rejouables.

**Ordre avec le code : bloc 1, puis fusion du code 1.5.0, puis blocs 2 à 5.** Le bloc 1 ajoute les
fonctions de lecture que le nouveau code appelle (sans rien retirer : l'ancien code continue de
marcher). Le bloc 2 ferme la lecture directe de `geo_places` : l'ancien code, qui la lit encore, tomberait
en erreur s'il passait avant la fusion.

| Bloc                      | Effet                                                                                                                                                                  | Socle | Installation |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- | ------------ |
| `1_lecture_et_import.sql` | Fonctions de lecture à l'unité `geo_lieu`, `geo_communes_principales` ; `geo_neighbours` et `geo_status` passent en droits du propriétaire ; import `geo_importer` (admin). | oui   | oui          |
| `2_verrou.sql`            | Lecture directe de `geo_places` fermée aux visiteurs ; un membre ne voit rien (règle admin seule).                                                                     | oui   | oui          |
| `3_version.sql`           | Version 1.5.0 publiée, réglage « socle » à 1.5.0.                                                                                                                      | oui   | oui          |
| `4_inscription.sql`       | Inscrit la mise à niveau 1.5.0 dans `socle_installation`.                                                                                                              | non   | oui          |
| `5_controle.sql`          | Contrôle : 5 lignes.                                                                                                                                                   | oui   | oui          |

## Résultat attendu du bloc 5

| Contrôle                  | Valeur |
| ------------------------- | ------ |
| version du socle          | 1.5.0  |
| visiteur lit geo_places   | false  |
| regle de lecture publique | 0      |
| fonctions de lecture      | 4      |
| visiteur importe          | false  |

## Relier le projet au référentiel du Studio

Deux secrets du projet (Lovable → Cloud → Secrets), jamais dans le code :

- `CDS_GEO_URL` : adresse du site GeoAnnonces, sans barre finale ;
- `CDS_GEO_CLE` : clé d'accès créée dans GeoAnnonces (bloc `71_creer_une_cle.sql` de son dépôt), une clé
  par projet.

Puis Administration → Géographie → « Référentiel du Studio » : choisir un pays, « Importer ce pays ».
L'import va niveau par niveau (pays, régions, subdivisions, intercommunalités, communes), par paquets de
1 000, et se relance sans doublon. Il garde les voisinages déjà calculés et les adresses des pages.
