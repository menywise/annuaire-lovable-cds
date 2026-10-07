# Greffe de l'annuaire : les fiches « site web »

L'annuaire est un clone du socle CDS. Ce qui lui est propre vit ici, jamais dans une table du socle
(Loi des Quatre Interdits). La fiche du socle (`directory_listings`) est prolongée par des tables
`greffe_…` liées par son identifiant, supprimées avec elle.

| Table                | Contenu                                                                                         | Qui lit                                                    |
| -------------------- | ----------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| `greffe_sites`       | Adresse, hôte, langue, pays, usage principal et secondaire, catégorie et code d'activité, état. | Public, si la fiche est publiée et le module allumé ; admin |
| `greffe_sites_audit` | Empreinte Lovable et audit repris d'OLD (score, palier, détail, date).                          | Administration seule : jamais de note publique nominative  |
| `greffe_classements` | Trace de chaque classement : axe, valeur, règle, version, preuve, confiance, date.               | Administration seule                                       |

Module : `greffe_sites` (« Fiches site web »), déclaré dans `src/greffe/index.ts`, éteint par défaut, à allumer
avec l'annuaire métier dans Administration → Modules.

## Ordre de passage (éditeur SQL du projet Lovable « Annuaire Lovable CDS »)

1. `01_sites_web.sql` : les trois tables et leurs droits.
2. `reprise_old/blocs/` dans l'ordre des noms : `10_fiches_1` et `_2`, `20_sites_1` et `_2`, `30_audits_1` à
   `_5`, `40_classements_1` à `_4`. Tous rejouables.
3. Administration → Modules : allumer « Fiches site web ».

Les fiches arrivent en **brouillon** : rien n'est public tant qu'une fiche n'a pas son contenu éditorial.

## Reprise d'OLD du 07/10/2026

Source : les 1 884 sites « en ligne » d'OLD (instables et morts non repris, règle actée le 05/10/2026), lus
par son interface publique. Script : `reprise_old/generer_reprise.py`.

Règles de classement, version `R1-2026-10-07` :

- **Usage** (signaux relevés par l'audit d'OLD) : boutique si encaissement en ligne ou paiement Stripe ;
  réservation si module de réservation ; application si base de données connectée ; page de lancement si une
  page interne au plus ; média si blog ; sinon vitrine. Le blog donne un usage secondaire « média ».
- **Activité** : secteur d'OLD traduit en catégorie du registre eqNAF, confiance « hypothèse » (les secteurs
  d'OLD étaient inventés) ; six secteurs mélangeaient deux activités et sont marqués « à départager ».
- **Géographie** : lieu rattaché dans OLD, confiance « estimé » au-delà de 0,8, sinon « hypothèse ».
- **Langue** : langue détectée par OLD.
- Sans signal, l'axe reste « à classer » : rien n'est inventé.

Résultat (7 560 classements) :

| Axe        | Classés                                     | À classer |
| ---------- | ------------------------------------------- | --------- |
| Usage      | 1 398 : vitrine 764, lancement 427, application 98, média 90, réservation 12, boutique 7 (109 estimés, 1 289 hypothèses) ; 24 usages secondaires « média » | 486       |
| Activité   | 865 (hypothèses)                            | 1 019     |
| Langue     | 1 400 (estimés)                             | 484       |
| Géographie | 30 (estimés)                                | 1 854     |

Contrôlé sur une base au modèle de l'annuaire : 1 884 fiches en brouillon, 1 884 fiches site web, 1 884 audits,
7 560 classements, blocs rejouables sans doublon ; un visiteur ne voit aucun brouillon, ni l'audit, ni les
classements ; une fiche publiée module allumé est visible avec son usage.

À venir : classements des axes « à classer » (lecture des pages, numéro d'entreprise et code d'activité
officiel, cible), puis contenu éditorial de chaque fiche avant publication. Captures d'OLD perdues (liens
expirés) : à refaire.
