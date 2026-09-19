# 6 briques optionnelles CDS, activables par interrupteur

Objectif : livrer dans le modèle CDS six modules complets mais **éteints par défaut**, chacun allumable par un simple interrupteur lors de la réutilisation du modèle sur un nouveau projet.

## Le principe d'activation

Un fichier unique de configuration contient six interrupteurs (Géographie, Annuaire métier, Suivi de prospects, Formations, Petites annonces, Régie publicitaire). Tous sur « éteint » pour CDS.

Quand un module est éteint :

- ses pages renvoient vers l'accueil (jamais d'erreur),
- ses liens disparaissent du menu, du pied de page, du plan du site et de l'administration,
- ses tableaux de données existent en base mais restent vides.

Quand il est allumé : tout apparaît, sans toucher une ligne de code.

## Ce que contient chaque module

**Géographie** — les 101 départements français préchargés, une page par département listant les fiches de la zone, maillage vers les départements voisins. Dépend du module Annuaire métier.

**Annuaire métier** — des fiches de professionnels, distinctes de l'annuaire des membres existant (aucune table partagée). Liste filtrable, page fiche indexable par Google, catégories, avis modérés, badges « vérifié » et « premium », revendication d'une fiche par son propriétaire, soumission par un membre, import/export.

**Suivi de prospects** — espace privé : chaque membre ne voit que ses prospects, avec étapes, historique d'échanges et relances datées. Vue globale et export côté administration.

**Formations** — catalogue, page formation avec programme, lecteur de leçon, progression enregistrée, leçons offertes en aperçu, inscriptions et taux d'achèvement côté administration.

**Petites annonces** — dépôt d'annonce avec photos et prix, liste filtrable, page annonce, contact du vendeur via la messagerie privée existante, modération côté administration.

**Régie publicitaire** — emplacements, campagnes datées (directe, affiliation, échange, sponsorisé), comptage des affichages et des clics, page « Annoncez chez nous », statistiques et export. Un emplacement vide n'affiche rien.

## Ordre de livraison

1. Interrupteurs + branchement menus/pied de page/plan du site/administration
2. Base de données : les 17 tables, règles d'accès, préchargement des départements
3. Annuaire métier, puis Géographie (qui en dépend)
4. Suivi de prospects
5. Formations
6. Petites annonces
7. Régie publicitaire
8. Mise à jour de la grille de conformité, de la feuille de route et du plan du site

## Détails techniques

- `src/config/features.ts` exporte `features` (geo, directory, crm, lms, marketplace, adNetwork), tous `false`. Helper `requireFeature(flag)` qui `throw redirect({ to: "/" })` dans le `beforeLoad` de chaque route concernée.
- Tables préfixées `geo_`, `directory_`, `crm_`, `lms_`, `marketplace_`, `ad_` — aucune collision avec les 24 tables existantes. Chaque `CREATE TABLE` est suivi de ses `GRANT`, puis RLS et policies : lecture `anon` uniquement sur les contenus publiés/approuvés ; écriture propriétaire (`auth.uid()`) ; administration via `has_role(auth.uid(), 'admin')`. CRM : aucune policy `anon`, isolation stricte par `owner_id`.
- Lecture publique via `publicClient()` dans de nouveaux modules `src/lib/directory.functions.ts`, `geo.functions.ts`, `lms.functions.ts`, `marketplace.functions.ts`, `ads.functions.ts` ; CRM en lecture client authentifiée.
- Routes publiques sous `src/routes/annuaire.*`, `formations*`, `marketplace*`, `publicite.tsx` ; routes membres et CRM sous `src/routes/_authenticated/`.
- `seo()` sur chaque page publique, JSON-LD `LocalBusiness` sur la fiche annuaire, `Course` sur la formation, `Product` sur l'annonce ; entrées conditionnelles dans `sitemap.xml`.
- `<AdSlot placement="…" />` : rien si le module est éteint ou sans campagne active ; enregistre affichage et clic dans `ad_events`.
- `AdminShell` : la navigation d'administration filtre ses entrées sur `features`.
- Respect des règles CDS : thème clair seul, Inter, français, attribut `title` sur chaque lien, cibles tactiles 44 px, paramétrage en back-office.
