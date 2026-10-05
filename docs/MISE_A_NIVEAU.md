# Mettre une installation à niveau du socle

Une installation est un projet né d'un Remix du socle CDS (exemple : l'annuaire). Ce document dit
comment l'amener à la version courante du socle, puis applique la méthode à l'annuaire
(0.0.0 → 1.2.0).

## Ce qu'il faut savoir avant

- **La référence d'une version est une migration du dépôt du socle**, jamais le journal de
  migrations de la plateforme. Version courante : **1.3.0**, migration
  `20261004120000_v1_3_0_accroches_greffes`.
- **Chaque base dit ce qu'elle embarque.** `socle_versions` liste les versions publiées du socle.
  `socle_installation` trace la vie de cette base (vide dans le socle). Le réglage « socle » de
  `site_settings` donne la version en un coup d'œil.
- **Le Remix copie le code et la structure de la base, pas les données.** Il n'emporte donc ni les
  réglages (`site_settings`), ni l'historique des versions, ni la grille de conformité, ni la tâche
  pg_cron de purge des messages de contact. Il retire aussi `supabase/migrations` du dépôt du clone,
  en gardant l'historique git.
- **Fichiers propres à chaque installation** (à ne jamais écraser par ceux du socle) : `.env`,
  `supabase/config.toml`, `.lovable/mcp/manifest.json` et les quatre fichiers de
  `src/integrations/supabase/` (`auth-attacher.ts`, `auth-middleware.ts`, `client.server.ts`,
  `client.ts`), reformatés par Lovable.
- **Fichiers générés : `src/routeTree.gen.ts` et `src/integrations/supabase/types.ts`.** Le socle les
  tient à jour. Une installation qui a des greffes les modifie aussi (ses pages, ses tables). En cas
  de conflit à la fusion : prendre la version du socle, puis régénérer. L'arbre des pages se
  régénère au build (`npx vite build`) ; les types se régénèrent depuis la base de l'installation,
  ou à défaut on y rajoute à la main les tables `greffe_…`. Ne jamais résoudre ce conflit ligne à
  ligne.
- **Greffes (depuis 1.3.0).** Ce qui est propre à l'installation vit dans `src/greffe/`,
  `src/routes/(greffe)/`, `supabase/greffe/` et `tests/greffe/` : la fusion du socle n'y touche
  pas. Mode d'emploi : `docs/CLONER.md`, « Écrire une greffe ».
- **Une migration du socle qui réécrit le réglage « modules »** garde toujours les modules des
  installations : `value = nouvelles_valeurs || public.module_greffe_values(value)`.
- **Release de design system Lovable.** Si le socle est publié comme design system dans Lovable,
  une installation qui s'y relie reçoit une **copie** du code du socle dans `src/design-system/`, plus
  des consignes pour l'agent de Lovable. Une installation est déjà un clone du socle : elle ne s'y
  relie pas. Si c'est arrivé, détacher le design system puis retirer `src/design-system/` et
  `lovable.toml`. Les mises à niveau passent uniquement par la méthode ci-dessous.
- **Une ancienne migration éditée côté socle** crée un conflit « modifiée d'un côté, supprimée de
  l'autre » à la fusion. Règle du socle : une migration publiée ne se modifie plus, on en ajoute une.

## Méthode générale

1. **Mesurer.** Dans la base de l'installation : réglage « socle », lignes de `socle_installation`,
   nombre de tables, fonctions, politiques. Comparer au socle.
2. **Base d'abord.** Passer les blocs SQL de la version visée (dossier `supabase/seed/vX_Y_Z/`) dans
   l'éditeur SQL du projet, un par un, dans l'ordre, puis le bloc de contrôle. Tous sont
   rejouables : un bloc passé deux fois ne casse rien. La base passe avant le code, pour que le code
   fusionné trouve ses tables.
3. **Code ensuite.** Fusionner `main` du socle dans une branche de l'installation, ouvrir une PR,
   vérifier qu'aucun fichier propre à l'installation n'a bougé, fusionner. Jamais de rebase ni de
   force-push : le projet est relié à Lovable.
4. **Contrôler.** Rejouer le bloc de contrôle, ouvrir l'aperçu Lovable, vérifier `/admin/demarrage`.

## Cas de l'annuaire : 0.0.0 → 1.2.0

La cible est directement la 1.2.0 : on passe les blocs de la 1.1.0 puis ceux de la 1.2.0.

### État mesuré le 03/10/2026, après nettoyage de l'essai

- Base : 54 tables (les 53 communes + `socle_installation`), 57 fonctions (les 56 communes +
  `starter_status`), 154 politiques sur les tables, 8 sur les fichiers. Réglage « socle » 0.0.0,
  « non mesure ». Une ligne 0.0.0 « anterieur » dans `socle_installation`.
- Manquent par rapport au socle 1.2.0 : la table `socle_versions` et sa politique, l'historique des
  versions, la tâche pg_cron `cds_purge_contact_messages`, les modules facultatifs éteints par
  défaut et le choix daté des modules. Pas de réglage « modules » : après la mise à niveau, seuls
  les outils d'administration sont allumés, jusqu'au choix fait dans l'écran Démarrage.
- Grille de conformité recopiée le 03/10 (42 lignes « à vérifier »).
- Dépôt : identique au socle, sauf les fichiers propres à l'installation et les 25 migrations
  retirées par le Remix.

### Étapes

1. **Base de l'annuaire** — éditeur SQL du projet Annuaire Lovable CDS :
   - blocs de `supabase/seed/v1_1_0/` : 1 à 6, puis le contrôle 7 ;
   - blocs de `supabase/seed/v1_2_0/` : 1 à 8, puis le contrôle 9.
   Les blocs 5 et 6 de la 1.1.0 et le bloc 8 de la 1.2.0 sont réservés aux installations.
2. **Code** — branche de l'annuaire, fusion de `main` du socle, PR, fusion.
   Simulation faite le 03/10 : **aucun conflit** ; arrivent seulement les migrations 1.1.0 et 1.2.0,
   leurs blocs, leurs tests, le code des modules et la documentation ; aucun fichier propre à
   l'annuaire touché.
3. **Contrôle** — le bloc 9 de la 1.2.0 doit renvoyer : version du socle `1.2.0` ; 22 modules
   éteints par défaut ; outils `media search studio` ; modules allumés `aucun` ; choix
   `pas encore`. Le bloc 7 de la 1.1.0 : registre installation
   `0.0.0 anterieur, 1.1.0 mise_a_niveau, 1.2.0 mise_a_niveau` ; purge nocturne `1`.
   Puis : 55 tables, 59 fonctions, 155 politiques sur les tables, comme le socle.
4. **Modules** — Administration → Modules : allumer les briques de l'annuaire, enregistrer.
   L'écran Démarrage passe l'étape « Modules » à « fait ».

### Décisions du 03/10

- **Les 25 migrations retirées par le Remix : remises** dans le dépôt de l'annuaire, à
  l'identique du socle (PR menywise/annuaire-lovable-cds#1). La vérification automatique
  reconstruit de nouveau la base. Inconnue restante : la réaction de Lovable à des fichiers de
  migration plus anciens que son journal ; après la fusion, contrôler que la base n'a pas bougé.
- **La grille de conformité : recopiée** dans l'annuaire le 03/10, 42 lignes, toutes
  « à vérifier ».
- **La purge nocturne par pg_cron : gardée.** La politique de confidentialité promet
  l'effacement après 3 ans ; le bloc 5 la replanifie dans chaque installation.

- **Les modules : socle 1.2.0.** Les 22 modules facultatifs sont éteints par défaut et se
  choisissent au lancement, dans l'écran Démarrage. Pilotage, médiathèque et recherche sont des
  outils d'administration toujours allumés.

### À savoir

- **Réglage « brand » absent de l'annuaire.** Ce n'est pas un défaut : c'est le parcours normal d'un
  clone, qui règle sa marque dans Administration → Démarrage. Ne pas recopier celle du socle.
