# Socle CDS

CDS est un **socle** : une application web complète (comptes, administration, pages, médiathèque,
blog, forum, messagerie, annuaire, formations, petites annonces, lettre d'information…) dont chaque
projet est un **clone**. Le clone
règle son identité dans l'administration, allume ses modules, puis ajoute ce qui lui est propre
par une **greffe**, dans son propre dépôt. Le socle ne contient jamais rien de propre à un projet.

Ce dépôt est le socle lui-même : sa prise de greffe est vide (`src/greffe/index.ts`).

## Pile technique

- TypeScript, React 19 et [TanStack Start](https://tanstack.com/start) (rendu côté serveur, routage
  par fichiers dans `src/routes/`, serveur Nitro).
- Tailwind CSS 4 et composants shadcn/ui (Radix). Thème clair uniquement, aucun mode sombre.
- Base de données et authentification Supabase, hébergées par Lovable Cloud. Les migrations SQL sont
  dans `supabase/migrations/`, les blocs pour l'éditeur SQL de Lovable dans `supabase/seed/`.
- Build Vite ; dépendances installées depuis le registre npm public, sans fichier de verrouillage.

## Vérifier

```sh
npm install --no-package-lock --no-audit --no-fund
npm run typecheck        # npx tsc --noEmit -p .
npm test                 # node --test tests/unit/*.test.ts
npm run build            # npx vite build
tests/db/run.sh          # forme des blocs SQL, migrations, règles d'accès, égalité migrations/blocs,
                         # sur un Postgres 16 local (PGHOST, PGUSER…)
```

Le CI (`.github/workflows/qualite.yml`) enchaîne ces mêmes commandes, puis une recette automatisée
dans un navigateur (`tests/e2e/`). Un commit poussé sur `main` doit garder la branche en état de
marche : il se synchronise avec l'éditeur Lovable.

## Pour aller plus loin

- [docs/CLONER.md](docs/CLONER.md) : créer un projet à partir du socle, écrire une greffe.
- [docs/MISE_A_NIVEAU.md](docs/MISE_A_NIVEAU.md) : amener une installation à la version courante du socle.
- [AGENTS.md](AGENTS.md) : règles pour toute personne ou tout agent qui modifie ce dépôt ou un clone.
