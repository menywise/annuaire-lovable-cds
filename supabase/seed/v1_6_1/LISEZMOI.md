# Socle 1.6.1 — blocs pour l'éditeur SQL de Lovable

Blocs 1 à 11 : même contenu que la migration
`supabase/migrations/20261013120000_v1_6_1_correctifs_audit.sql`, sans commentaires (le bloc 3 porte la
section 3 et la section 13, qui redéfinit le garde des réponses : seule la forme finale y figure).
Bloc 12 : propre à une installation, à ne pas passer dans le socle. Chaque bloc se passe seul, dans
l'ordre, après ceux de la 1.6.0. Tous sont rejouables.

**Ordre avec le code : passer les blocs d'abord, fusionner le code 1.6.1 aussitôt après.** Le code
1.6.1 appelle des fonctions que seule la base 1.6.1 connaît (`newsletter_subscribe`, les compteurs du
forum, des formations et de l'annuaire, `reserved_quantity` de la boutique) : s'il arrivait avant la
base, /forum, /formations, la boutique et l'abonnement à la lettre tomberaient en erreur. Entre les
blocs et la fusion, l'ancien formulaire de la lettre d'information (insertion directe, fermée par le
bloc 4) refuse les inscriptions : garder ce délai court.

| Bloc                    | Effet                                                                                                              | Socle | Installation |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------ | ----- | ------------ |
| `1_messagerie.sql`      | Messages : seul `read_at` reste modifiable, par le destinataire ; conversations figées pour les membres.          | oui   | oui          |
| `2_boutique.sql`        | Stock réservé à la commande (`reserved_quantity`), rendu une fois si elle expire ; le paiement ne le redécompte plus. | oui   | oui          |
| `3_forum.sql`           | Garde-fous à la création d'un sujet et d'une réponse ; réponse refusée dans un sujet verrouillé, ligne du sujet sous verrou. | oui   | oui          |
| `4_formulaires.sql`     | Contact, lettre d'information, régie : bornes, dates forcées, plafonds d'envoi, `newsletter_subscribe`, clics d'une campagne en cours. | oui   | oui          |
| `5_annuaire.sql`        | Demande de revendication en attente protégée (CDS03) ; fiche publiée et modifiée repasse en attente.               | oui   | oui          |
| `6_administrateurs.sql` | Administrateurs nommés d'avance : adresse confirmée exigée, à la connexion comme à l'ajout dans la liste.          | oui   | oui          |
| `7_prix.sql`            | `price_cents >= 0` sur annonces, formations et offres ; `pricing_plans_features_array` validée.                    | oui   | oui          |
| `8_pilotage.sql`        | Plan directeur et feuille de route du socle retirés (texte d'origine exact) ; points MOD-* sans renvoi à V0.md.    | oui   | oui          |
| `9_compteurs.sql`       | Compteurs calculés en base : forum, formations, annuaire ; index de regroupement.                                  | oui   | oui          |
| `10_index.sql`          | Index des clés étrangères et des tris ; `geo_adjacency_place_idx` (doublon) retiré.                                | oui   | oui          |
| `11_version.sql`        | Grille : point boutique réécrit, PIL-1 et PIL-2 « à vérifier » si la base n'a plus de plan ; version 1.6.1 publiée, réglage « socle » à 1.6.1. | oui   | oui          |
| `12_inscription.sql`    | Inscrit la mise à niveau 1.6.1 dans `socle_installation`.                                                          | non   | oui          |
| `13_controle.sql`       | Contrôle : 14 lignes.                                                                                              | oui   | oui          |

## Résultat attendu du bloc 13

| Contrôle                        | Valeur |
| ------------------------------- | ------ |
| version du socle                | 1.6.1  |
| membre reecrit un message       | false  |
| membre modifie une conversation | false  |
| colonne reserved_quantity       | 1      |
| fonctions de la 1.6.1           | 17     |
| reponse sous verrou du sujet    | 1      |
| visiteur s abonne en direct     | false  |
| contraintes de la 1.6.1         | 13     |
| contraintes non validees        | 0      |
| index de la 1.6.1               | 17     |
| index en double retire          | 0      |
| plan directeur du socle         | 0      |
| points renvoyant a V0.md        | 0      |
| version 1.6.1 publiee           | 1      |

Deux lignes peuvent s'écarter sans que le passage ait échoué. « contraintes non validees » au-dessus
de 0 : des lignes existantes sont hors borne (adresse e-mail mal formée, texte trop long, prix négatif,
avantages d'une offre non listés) ; les blocs 4 et 7 ont laissé la contrainte NOT VALID, toujours
appliquée aux nouvelles lignes, et l'ont dit par un avis. Corriger les lignes puis
`ALTER TABLE … VALIDATE CONSTRAINT …`. « points renvoyant a V0.md » au-dessus de 0 : un administrateur
avait retouché l'exigence d'un point « Module fini », le bloc 8 ne touche que le texte d'origine.

## À vérifier après le passage

Administration → Pilotage : le plan directeur et la feuille de route du socle ont disparu ; une ligne
retouchée par un administrateur reste et se retire à la main. Administration → Conformité : PIL-1 et
PIL-2 sont « à vérifier » si la base n'avait que le plan du socle ; V0-K-BOUTIQUE dit désormais le stock
réservé à la commande.
