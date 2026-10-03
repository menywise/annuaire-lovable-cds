# Mettre une installation à niveau du socle

Une installation est un projet né d'un Remix du socle CDS (exemple : l'annuaire). Ce document dit
comment l'amener à la version courante du socle, puis applique la méthode à l'annuaire
(0.0.0 → 1.1.0).

## Ce qu'il faut savoir avant

- **La référence d'une version est une migration du dépôt du socle**, jamais le journal de
  migrations de la plateforme. Version courante : **1.1.0**, migration
  `20261003120000_v1_1_0_versions_installation`.
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
- **Lovable ne régénère ni `routeTree.gen.ts` ni `types.ts` dans le dépôt.** Le socle les tient à
  jour ; l'installation les reçoit par la fusion.
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

## Cas de l'annuaire : 0.0.0 → 1.1.0

La cible est directement la 1.1.0 : elle contient la 1.0.0.

### État mesuré le 03/10/2026, après nettoyage de l'essai

- Base : 54 tables (les 53 communes + `socle_installation`), 57 fonctions (les 56 communes +
  `starter_status`), 154 politiques sur les tables, 8 sur les fichiers. Réglage « socle » 0.0.0,
  « non mesure ». Une ligne 0.0.0 « anterieur » dans `socle_installation`.
- Manquent par rapport au socle 1.1.0 : la table `socle_versions` et sa politique, l'historique des
  versions, la tâche pg_cron `cds_purge_contact_messages`.
- Dépôt : identique au socle, sauf les fichiers propres à l'installation et les 25 migrations
  retirées par le Remix.

### Étapes

1. **Base de l'annuaire** — éditeur SQL du projet Annuaire Lovable CDS, blocs de
   `supabase/seed/v1_1_0/` : 1, 2, 3, 4, **5 et 6**, puis le contrôle 7. Les blocs 5 et 6 sont
   réservés aux installations.
2. **Code** — branche de l'annuaire, fusion de `main` du socle, PR, fusion.
   Simulation faite le 03/10 : **aucun conflit** ; arrivent seulement la migration 1.1.0, ses blocs,
   son test et la documentation ; aucun fichier propre à l'annuaire touché.
3. **Contrôle** — le bloc 7 doit renvoyer : versions publiees `1.0.0 1.1.0` ; reglage socle
   `1.1.0` ; registre installation `0.0.0 anterieur, 1.1.0 mise_a_niveau` ; politiques de lecture
   `2` ; starter_status présente ; purge nocturne `1`. Puis : 55 tables, 57 fonctions,
   155 politiques sur les tables, comme le socle.

### Décisions du 03/10

- **Les 25 migrations retirées par le Remix : remises** dans le dépôt de l'annuaire, à
  l'identique du socle (PR menywise/annuaire-lovable-cds#1). La vérification automatique
  reconstruit de nouveau la base. Inconnue restante : la réaction de Lovable à des fichiers de
  migration plus anciens que son journal ; après la fusion, contrôler que la base n'a pas bougé.
- **La grille de conformité : recopiée** dans l'annuaire le 03/10, 42 lignes, toutes
  « à vérifier ».
- **La purge nocturne par pg_cron : gardée.** La politique de confidentialité promet
  l'effacement après 3 ans ; le bloc 5 la replanifie dans chaque installation.

### Décision ouverte

- **Les modules allumés par défaut.** `module_defaults()` allume 16 modules sur 25 (blog, FAQ,
  contact, lettre, forum, membres, messagerie, témoignages, avis, tarifs, démarrage, pilotage,
  composants, médiathèque, signalements, recherche). L'annuaire n'a pas de réglage « modules » :
  ces 16 y sont allumés. Passer à « tout éteint par défaut » serait une nouvelle version du socle,
  à trancher avec le plan d'action des briques et modules.
- **Réglage « brand » absent de l'annuaire.** Ce n'est pas un défaut : c'est le parcours normal d'un
  clone, qui règle sa marque dans Administration → Démarrage. Ne pas recopier celle du socle.
