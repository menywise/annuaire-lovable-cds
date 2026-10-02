# Audit de conformité du core à la Loi des Quatre Interdits

Date : 2 octobre 2026.
Objet audité : le dépôt du core (`menywise/cds-mac97000`, branche `main`, commit `5638236`) et sa base (projet Lovable « CDS Framework »).
Le premier site (« Annuaire Lovable CDS ») a servi de contre-épreuve.
Méthode : lecture seule. Aucun fichier, aucune table, aucune migration modifiés. Le seul fichier créé est ce rapport.

Vocabulaire : core, module, site, ext, hook, entry_type, ext_field, taxonomy, seed, promote, upgrade, absorb. Le mot « migration » désigne uniquement un fichier SQL de schéma.


## 1. Inventaire réel constaté

### 1.1 Fichiers (361 fichiers suivis par git)

| Dossier | Fichiers | Contenu |
|---|---|---|
| `src/routes` | 101 | pages et points d'entrée serveur (routage par fichiers) |
| `src/components` | 66 | `cds/` (21 composants du core) et `ui/` (shadcn) |
| `src/lib` | 55 | fonctions serveur, SEO, réglages, e-mails, MCP, paiement |
| `src/config` | 3 | `brand.ts`, `modules.ts`, `features.ts` |
| `src/integrations` | 8 | client Supabase, `types.ts` (généré) |
| `src/routeTree.gen.ts` | 1 | arbre des routes (généré, 2 155 lignes, suivi par git) |
| `supabase/migrations` | 25 | 11 fichiers Lovable (noms en uuid), 14 lots `v0_*` |
| `supabase/seed` | 29 | blocs SQL à passer à la main (boutique, lot11, lot13a, recette) |
| `tests` | 32 | `db/` (21), `e2e/` (4), `unit/` (7) |
| `public` | 4 | `favicon.png`, `apple-touch-icon.png`, `icon-512.png`, `og-cds.jpg` |
| racine et `docs/` | ~20 | `README.md`, `V0.md`, `roadmap.md`, `CDS_TOKENS.md`, `docs/CLONER.md`, `.env`, `supabase/config.toml`, `.lovable/` |

### 1.2 Base du core (production)

- 52 tables dans `public`.
- 56 fonctions dans `public`, hors extensions.
- 40 déclencheurs sur `public`.
- 1 type énuméré : `app_role`.
- 2 espaces de fichiers : `media`, `shop-files`.
- 1 tâche planifiée : `cds_purge_contact_messages`.

Familles de tables :
- `ad_*`, `audits`, `audit_findings` ;
- `blog_*`, `contact_messages`, `conversations`, `messages` ;
- `crm_*` ;
- `directory_*`, `faq_items`, `forum_*`, `geo_*`, `lms_*` ;
- `marketplace_*`, `masterplan_sections`, `media_files`, `member_profiles` ;
- `newsletter_subscribers`, `pages`, `payments`, `pricing_plans`, `profiles` ;
- `reports`, `reviews`, `roadmap_items`, `shop_*`, `site_settings` ;
- `studio_admins`, `template_checks`, `testimonials`, `user_roles`.

### 1.3 Écarts entre la base et le code

Comparaison par nom d'objet : tables, fonctions et déclencheurs. Les déclencheurs `*_moderation` sont créés par une boucle (`supabase/migrations/20260929220000_v0_lot6_moderation.sql:50-51`) ; ils ne sont pas des écarts.

| Écart | Où | Constat |
|---|---|---|
| Fonction `starter_status()` absente de la base du core | déclarée dans `supabase/migrations/20261001090000_v0_lot13a_demarrage.sql:79` et `supabase/seed/lot13a/2_etat.sql:1` | Le bloc 2 du lot 13 a n'a pas été appliqué, ou a échoué. L'écran Démarrage affiche alors « État du démarrage indisponible » (`src/routes/_authenticated/admin.demarrage.tsx:43-46`). Le bloc de contrôle `4_controle.sql` aurait dû rendre 1 ligne au lieu de 2. |
| Déclencheur `geo_places_updated_at` absent de la base du core | déclaré dans `supabase/migrations/20260930190000_v0_lot11_geographie.sql:50` et `supabase/seed/lot11/1_lieux.sql` | Cause non vérifiée (bloc coupé par l'éditeur, ou partie non passée). |
| Table `geo_communes` | créée puis supprimée par les migrations | Absente de la base, ce qui est normal. |
| Objets présents en base sans migration | aucun | Tous les objets de la base ont une migration. |

Contre-épreuve sur le site « Annuaire Lovable CDS » :
- **Ce que le Remix copie :** 52 tables, les fonctions (dont `starter_status`, présente dans le site mais absente du core) et les 2 espaces de fichiers.
- **Ce qu'il ne copie pas :**
  - la tâche planifiée `cds_purge_contact_messages` ;
  - les données : 0 ligne dans `studio_admins` et dans `site_settings` ;
  - le dossier `supabase/migrations`, supprimé du dépôt du site.
- **Conséquence :** la base du site suit les fichiers de migration du core, pas sa base de production. Les deux divergent déjà (`starter_status`, `geo_places_updated_at`).


## 2. Conformité interdit par interdit

### I1. Un site ne modifie jamais un fichier du core

**Hooks existants :**

| Hook | Preuve | Portée |
|---|---|---|
| Routage par fichiers | `src/routes/` | Un site ajoute une page en ajoutant un fichier. Mais l'arbre `src/routeTree.gen.ts` est régénéré et modifié (voir écart B2). |
| Réglages clé / valeur | table `site_settings` ; lecture publique `supabase/migrations/20260917200825_05b17ad7-3f8a-49c1-816d-880fc421ca3c.sql:14-17` | Un site peut stocker ses propres clés. Elles sont lisibles par tout visiteur : rien de confidentiel ne peut y aller. |
| Accueil remplaçable | `src/routes/index.tsx:14-15` (module `pages`) | La page d'accueil se remplace sans éditer de fichier. |
| Emplacements publicitaires nommés | `src/components/cds/AdSlot.tsx`, appel dans `src/components/cds/SiteHeader.tsx:442` | Insertion de contenu dans des emplacements prévus. |
| Formulaire d'administration générique | `src/components/cds/RecordEditor.tsx:7-28` (`FieldSpec`) | Réutilisable par un écran d'ext, mais les champs des écrans du core sont écrits dans leurs fichiers (voir écart G6). |
| Filtre par module | `src/config/modules.ts:71-87` (`onlyActive`) | Le mécanisme existe, mais il s'applique à des listes fermées. |

**Ce qu'un site ne peut pas faire aujourd'hui sans éditer un fichier du core :**
- **Ajouter une entrée de menu :**
  - menu public, menu membre et pied de page : `src/components/cds/SiteHeader.tsx:22` (`buildPublicNav`), `:88` (`buildMemberNav`), `:137` (`buildFooterColumns`) ;
  - menu d'administration : `src/components/cds/AdminShell.tsx:18-140`.
- **Ajouter un module :**
  - liste fermée côté code : `src/config/modules.ts:6-31`, avec le type `FeatureKey` dérivé de cette liste en `:38` ; `requireFeature` refuse toute autre clé (`src/config/features.ts`) ;
  - côté base : `public.module_defaults()` (`supabase/migrations/20260930210000_v0_boutique.sql:12-24`) ;
  - une clé inconnue est refusée par `validate_modules_setting` (`supabase/migrations/20260928140000_v0_lot2_socle.sql:31-34`).
- **Protéger une page par module :** liste fermée `src/config/modules.ts:98-125` (`PROTECTED_PATH_MODULES`).
- **Ajouter une page au plan du site ou au sitemap :** `src/routes/sitemap[.]xml.tsx:11` et `src/routes/plan-du-site.tsx:29` et `:126`.
- **Rendre un contenu cherchable :** la fonction `search_site` est une union fixe de tables (`supabase/migrations/20260930170000_v0_lot10_recherche.sql:112-124` et suivantes).
- **Ajouter un champ à un écran d'administration du core :** les `FieldSpec` sont écrits dans chaque route, par exemple `src/routes/_authenticated/admin.annuaire.tsx` (même chose pour `admin.boutique.tsx`, `admin.formations.tsx`, `admin.marketplace.tsx`, `admin.regie.tsx`).
- **Ajouter une colonne à une liste d'administration :** les colonnes sont écrites dans les mêmes fichiers.
- **Ajouter une étape à un parcours :**
  - parcours « Découvrir » : `src/routes/_authenticated/decouvrir.tsx:43` ;
  - liste de contrôle Démarrage : `src/routes/_authenticated/admin.demarrage.tsx:72`.
- **Rendre un contenu signalable :** liste `src/lib/reports.ts:3-16`, plus la contrainte SQL `reports_content_type_check` (`supabase/migrations/20260930090000_v0_lot7_paiement_signalements.sql:236`).
- **Faire tester ses pages par le robot de recette :** `src/lib/qa-plan.ts:38` (`QA_PAGES`).
- **Ajouter un raccourci au tableau de bord :** `src/routes/_authenticated/tableau-de-bord.tsx:32`.
- **Ajouter un e-mail transactionnel :** `src/lib/email-templates/registry.ts:20` (`TEMPLATES`).
- **Ajouter un outil MCP :** `src/lib/mcp/index.ts:28`.
- **Ajouter un script dans l'en-tête (mesure d'audience par exemple) :** `src/routes/__root.tsx:180-187`.

### I2. Un site ne modifie jamais une table du core

- **Aucun mécanisme de table d'extension n'existe.** Aucune occurrence de `ext_`, `extension` (hors extensions PostgreSQL), `custom_fields` ou `metadata` dans les migrations. Seule `geo_places.attributes` est un `jsonb` libre (`supabase/migrations/20260930190000_v0_lot11_geographie.sql:22`) ; elle est réservée à l'usage interne de la géographie (`:137`, `:158`).
- **Ce qui n'est pas prévu pour un ext_field :**
  - le lien par identifiant ;
  - la sécurité au niveau des lignes : la règle de lecture d'une fiche (publiée ou brouillon, propriétaire) n'est pas réutilisable par une autre table ;
  - la suppression en cascade ;
  - l'affichage dans l'administration ;
  - la recherche ;
  - l'export.
- Chaque site devrait tout réinventer.
- La contrainte de liste sur `reports.content_type` (voir I1) oblige à modifier une contrainte du core pour signaler un entry_type de site.
- Le nettoyage des clés de modules à chaque upgrade (`supabase/migrations/20260930210000_v0_boutique.sql:26-32`) réécrit la ligne `modules` de `site_settings` et efface toute clé inconnue du core.

### I3. Aucune identité dans le code

Déjà conforme :
- le nom, le nom court, la signature, l'adresse, les mentions légales, l'hébergeur et les domaines d'envoi sont en base et pilotés depuis l'administration ;
- le repli est neutre : `src/config/brand.ts:10-41` ;
- le test `tests/unit/socle-neutre.test.ts:13` interdit `manuelrohaut.fr` et `cds-mac97000.lovable.app` dans `src/`.

Occurrences d'identité écrite en dur :

| Occurrence | Fichier : ligne |
|---|---|
| Adresses e-mail personnelles qui deviennent administrateur | `supabase/migrations/20260928120000_v0_lot1_fiabilite_base.sql:156` (`studio_admins`) ; version antérieure dans `supabase/migrations/20260917193743_242c525c-7a4f-4e1c-ad00-d0cfb2e6adcc.sql:77`, remplacée depuis |
| Couleur de marque (bleu) | `src/styles.css:66-67`, `:85` (commentaire « bleu CDS ») ; reprise dans `src/lib/cds-tokens.ts` et `CDS_TOKENS.md` |
| Couleur du navigateur | `src/routes/__root.tsx:156` (`theme-color`), `src/routes/manifest[.]webmanifest.tsx:21-22` |
| Logo, favicon, icônes : image « C » bleue | `public/favicon.png`, `public/apple-touch-icon.png`, `public/icon-512.png` ; référencés en `src/routes/__root.tsx:176-177` et `src/routes/manifest[.]webmanifest.tsx:24-25` |
| Image de partage « CDS — Consensus Design System » | `public/og-cds.jpg`, image par défaut de toutes les pages : `src/lib/seo.ts:28` |
| Logo affiché dans l'en-tête | `src/components/cds/SiteHeader.tsx:348` : initiale du nom court, aucun logo réglable |
| Description d'accueil de démonstration | `src/routes/index.tsx:34`, et corps de la page d'accueil de démonstration (`src/routes/index.tsx:80` et suivantes) |
| Mentions « CDS » visibles | `src/routes/_authenticated/admin.demarrage.tsx:18`, `:145` ; `src/routes/_authenticated/admin.conformite.tsx:28` ; `src/routes/composants.tsx:95` ; `src/routes/guide.tsx:22`, `:41`, `:107-110` ; `src/lib/mcp/index.ts:16`, `:19` ; `src/lib/mcp/tools/list-template-checks.ts:10` ; `src/lib/mcp/tools/list-roadmap.ts:10` |
| Noms de dépôts dans des commentaires | `src/lib/qa-plan.ts:520` ; `src/lib/geo-import.ts:4` (sans effet à l'écran) |
| Adresse personnelle dans les tests de base | `tests/db/test_04_socle.sql:6`, `:10`, `:42` ; `tests/db/test_18_demarrage.sql:7`, `:9`, `:25`, `:51` |
| Fichiers propres au projet Lovable du core | `.env`, `supabase/config.toml`, `.lovable/mcp/manifest.json` : différents dans le site, constaté |

**Conséquence constatée :** le premier administrateur d'un site dépend de `studio_admins`.
- Seuls les comptes listés dans `studio_admins` deviennent administrateurs (`supabase/migrations/20260928120000_v0_lot1_fiabilite_base.sql:182-186`).
- Le Remix ne copie pas les données. Dans le site « Annuaire Lovable CDS », un compte est créé mais il y a 0 administrateur.

### I4. Marque réservée pour ce qui appartient à un site

- **Aucune convention n'existe.** Aucun fichier, aucune table, aucune fonction ne distingue un site du core.
- Le core emploie lui-même le préfixe `cds_` (`cds_purge_contact_messages`, `public.cds_fr`) et le préfixe `site_` (`site_settings`). Ces deux préfixes sont donc exclus.
- Préfixes de tables du core relevés : `ad_`, `audit`, `blog_`, `contact_`, `conversations`, `crm_`, `directory_`, `faq_`, `forum_`, `geo_`, `lms_`, `marketplace_`, `masterplan_`, `media_`, `member_`, `messages`, `newsletter_`, `pages`, `payments`, `pricing_`, `profiles`, `reports`, `reviews`, `roadmap_`, `shop_`, `site_`, `studio_`, `template_`, `testimonials`, `user_`.

**Proposition, non mise en œuvre : la marque `ext`.**
- Elle n'est employée nulle part dans le core : aucun fichier, dossier, table, fonction ni chaîne `ext_`, `ext-`, `ext.` ou `(ext)` (recherche sur `src`, `supabase`, `tests`).

| Objet | Forme |
|---|---|
| Tables, vues, fonctions, déclencheurs, politiques, types | `ext_<nom>` |
| Espaces de fichiers | `ext-<nom>` |
| Tâches planifiées | `ext_<nom>` |
| Clés de `site_settings` | `ext.<nom>` |
| Clés de module | `ext_<nom>` (suppose que le hook des modules l'accepte) |
| Code | `src/ext/` |
| Pages | `src/routes/(ext)/` (dossier de groupe qui ne change pas l'adresse publique) |
| SQL du site | `supabase/ext/` (hors `supabase/migrations`, que le Remix supprime) |
| Tests | `tests/ext/` |

Hypothèse non vérifiée : que la version de TanStack Router du core (1.170.18) gère les dossiers de groupe `(ext)` sans effet sur les adresses. À contrôler avant adoption.


## 3. Écarts classés

### BLOQUANT

- **B1. Modules : liste fermée en double, effacée à chaque upgrade.**
  - Un module d'ext exige d'éditer `src/config/modules.ts:6-31` et `public.module_defaults()`.
  - `validate_modules_setting` refuse toute clé inconnue (`supabase/migrations/20260928140000_v0_lot2_socle.sql:31-34`).
  - Toute upgrade qui touche la liste réécrit `module_defaults()` (`CREATE OR REPLACE`) et efface les clés inconnues (`supabase/migrations/20260930210000_v0_boutique.sql:26-32`).
  - Conflit garanti, et perte de réglage du site.
- **B2. Fichiers générés communs :**
  - `src/routeTree.gen.ts` est régénéré dès qu'un site ajoute une page ;
  - `src/integrations/supabase/types.ts` est régénéré par Lovable dès qu'un site ajoute une table (constaté dans le site) ;
  - le core modifie ces deux fichiers à chaque lot ;
  - conflit à chaque upgrade, réglable seulement en régénérant.
- **B3. Aucune marque réservée (I4).** Rien ne garantit mécaniquement l'absence de collision entre un objet de site et un futur objet du core.

### GRAVE

- **G1.** Menus public et membre et pied de page codés en dur : `src/components/cds/SiteHeader.tsx:22`, `:88`, `:137`.
- **G2.** Menu d'administration codé en dur : `src/components/cds/AdminShell.tsx:18-140`.
- **G3.** Pages protégées par module : liste fermée `src/config/modules.ts:98-125`. Le type `FeatureKey` empêche `requireFeature` pour un module d'ext.
- **G4.** Aucune table d'extension (I2) : ni lien, ni sécurité au niveau des lignes, ni suppression en cascade, ni affichage en administration pour un ext_field.
- **G5.** Champs et colonnes des écrans d'administration du core écrits dans les fichiers de route (`admin.annuaire.tsx` et suivants).
- **G6.** Plan du site et sitemap fermés : `src/routes/sitemap[.]xml.tsx:11`, `src/routes/plan-du-site.tsx:29`, `:126`.
- **G7.** Recherche globale fermée : `search_site` (`supabase/migrations/20260930170000_v0_lot10_recherche.sql:112`).
- **G8.** Premier administrateur d'un site neuf : il dépend d'adresses personnelles écrites dans une migration (`supabase/migrations/20260928120000_v0_lot1_fiabilite_base.sql:156`), que le Remix ne copie pas. Constaté : 0 administrateur dans le site. Il en faut un par SQL manuel. Touche aussi I3.
- **G9.** Identité visuelle en dur, qu'un site ne peut remplacer qu'en éditant des fichiers du core :
  - couleur `src/styles.css:66-67` ;
  - favicon et icônes `public/*.png` ;
  - image de partage `public/og-cds.jpg` (`src/lib/seo.ts:28`) ;
  - couleur du navigateur `src/routes/__root.tsx:156`.
- **G10.** Robot de recette : pages à tester en liste fermée (`src/lib/qa-plan.ts:38`).
- **G11.** Signalements : types de contenu fermés, en code (`src/lib/reports.ts:3`) et par contrainte SQL (`supabase/migrations/20260930090000_v0_lot7_paiement_signalements.sql:236`).
- **G12.** Upgrade SQL invérifiable.
  - Le Remix supprime `supabase/migrations`, et aucun registre ne dit quelle version du core est appliquée dans un site.
  - Si le core édite un jour une migration existante, la fusion produit un conflit « modifié d'un côté, supprimé de l'autre ».
  - Constaté : la base du core diverge déjà de ses propres migrations (section 1.3).

### MINEUR

- **M1.** Scripts de l'en-tête non extensibles (`src/routes/__root.tsx:180-187`). Contournable par la future mesure d'audience du core.
- **M2.** Raccourcis du tableau de bord (`src/routes/_authenticated/tableau-de-bord.tsx:32`) et liste de contrôle Démarrage (`src/routes/_authenticated/admin.demarrage.tsx:72`) fermés.
- **M3.** E-mails transactionnels (`src/lib/email-templates/registry.ts:20`) et outils MCP (`src/lib/mcp/index.ts:28`) en listes fermées.
- **M4.** Logo réduit à l'initiale du nom court (`src/components/cds/SiteHeader.tsx:348`).
- **M5.** Description et contenu de l'accueil de démonstration (`src/routes/index.tsx:34`, `:80+`). Contournable par le module `pages`.
- **M6.** Mentions « CDS » visibles dans l'administration, le guide, la page composants et le MCP (liste en I3).
- **M7.** Réglages de site lisibles par tout visiteur (`site_settings`, politique en lecture publique). Un ext ne peut pas y ranger de valeur confidentielle.
- **M8.** Fichiers propres au projet Lovable suivis par git : `.env`, `supabase/config.toml`, `.lovable/mcp/manifest.json`. Différents dans chaque site : conflit si le core les modifie.
- **M9.** Documents de pilotage du core à la racine (`README.md`, `V0.md`, `roadmap.md`, `docs/`). Un site qui les édite crée un conflit.
- **M10.** Adresse personnelle dans les tests de base (`tests/db/test_04_socle.sql`, `tests/db/test_18_demarrage.sql`) et noms de dépôts dans deux commentaires.
- **M11.** Base du core en écart avec ses migrations : `starter_status` et `geo_places_updated_at` absents (section 1.3).


## 4. Hooks manquants, par ordre d'urgence

1. **Registre de modules ouvert**, en code et en base : accepte les modules d'ext, et l'upgrade ne les efface pas (B1, G3).
2. **Fichiers générés** (`routeTree.gen.ts`, `types.ts`) : règle d'upgrade ou séparation core / ext (B2).
3. **Marque réservée** adoptée et vérifiée automatiquement (B3).
4. **Premier administrateur d'un site neuf** sans SQL ni adresse en dur (G8).
5. **Registre de navigation** : menu public, menu membre, pied de page, menu d'administration (G1, G2).
6. **Table d'extension standard** pour un ext_field sur un entry_type du core : lien, sécurité au niveau des lignes, cascade, affichage en administration (G4, G5).
7. **Registre de version du core** appliquée dans chaque site, pour l'upgrade SQL (G12).
8. **Identité visuelle en base** : couleur, logo, favicon, image de partage (G9, M4).
9. **Registres de contenus :** sitemap, plan du site, recherche, signalements, robot de recette (G6, G7, G10, G11).
10. **Registres secondaires :** tableau de bord, Démarrage, e-mails transactionnels, outils MCP, scripts d'en-tête (M1, M2, M3).


## 5. Ce qui n'a pas pu être vérifié

- **Colonnes, contraintes, politiques de sécurité et droits** : la base n'a été comparée aux migrations que par nom d'objet (tables, fonctions, déclencheurs). Des écarts plus fins ne sont pas exclus.
- **Cause des deux écarts de la section 1.3** : bloc non passé ou coupé par l'éditeur SQL. L'historique des requêtes de l'éditeur n'est pas accessible.
- **Ce que l'agent de Lovable modifie quand on lui parle dans un site** : rien ne l'empêche d'éditer un fichier du core. Le respect d'I1 dépend des consignes données à l'agent.
- **Gestion des dossiers de groupe `(ext)` par TanStack Router 1.170.18** : hypothèse à contrôler.
- **Comportement du Remix** pour les secrets d'environnement, le contenu des espaces de fichiers, les réglages d'authentification et d'e-mails : non observé.
- **Comportement d'une fusion git réelle** du core dans le site : non testé (lecture seule).
