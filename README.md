# CDS Framework

# CDS Lovable — Init + fichiers Git

## ÉTAPE 1 — Prompt d'init Lovable (à coller dans Lovable)

```
Crée un projet vide nommé "CDS — Consensus Design System".
C'est un design system réutilisable, pas une application.
Stack : React + Tailwind + shadcn/ui.
Police : Inter (Google Fonts).
Thème clair uniquement, aucun mode sombre.
Fond de page : #f8fafc. Texte principal : #1e293b.
Bleu principal : #0d6efd. Radius boutons : 6px. Radius cartes : 12px.
Ne génère qu'une seule page d'accueil vide avec le texte "Consensus Design System — Prêt" centré.
Aucune navigation, aucun contenu, aucune image.
```

## ÉTAPE 2 — Cloner le repo

Lovable crée automatiquement un repo Git lié au projet.
Dans Lovable > Settings > GitHub, récupère l'URL du repo.
Clone-le :

```
cd C:\DEV
git clone <URL_DU_REPO_LOVABLE> CDS
cd CDS
```

## ÉTAPE 3 — Fichiers à pousser via Git (0 crédits)

### 3.1 — tailwind.config.ts

Remplacer le fichier existant par la version CDS.
Le contenu complet est dans le fichier cds-tailwind-preset.js
que tu possèdes déjà (E:\DEV\_HOLOKAI\03_PROJETS\CDS\).

Intégrer le preset dans tailwind.config.ts comme ceci :

```ts
import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      // COLLER ICI le contenu de theme.extend du fichier cds-tailwind-preset.js
      // (couleurs, typo, spacing, radius, shadows, transitions, layout)
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
```

### 3.2 — index.html

Remplacer la balise <head> pour ajouter Inter et les métas CDS :

```html
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
  <meta name="theme-color" content="#f8fafc" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link
    href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
    rel="stylesheet"
  />
  <title>CDS — Consensus Design System</title>
</head>
```

### 3.3 — src/index.css

Remplacer le contenu par :

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  font-family:
    "Inter",
    system-ui,
    -apple-system,
    "Segoe UI",
    Roboto,
    sans-serif;
  font-size: 14px;
  line-height: 1.5;
  color: #1e293b;
  background-color: #f8fafc;
}

/* INTERDIT : dark mode */
/* Aucun @media (prefers-color-scheme: dark) */
/* Aucune classe .dark */

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  min-height: 100vh;
}
```

### 3.4 — src/lib/cds-tokens.ts (nouveau fichier)

```ts
/**
 * CDS — Consensus Design System — Tokens TypeScript
 * Source de vérité : CDS_TOKENS.md
 * Usage : import { cds } from '@/lib/cds-tokens'
 */
export const cds = {
  colors: {
    primary: "#0d6efd",
    primaryHover: "#0a58ca",
    success: "#198754",
    warning: "#ffc107",
    danger: "#dc3545",
    info: "#0dcaf0",
    secondary: "#6c757d",
    purple: "#7c3aed",
    text: "#1e293b",
    textMuted: "#64748b",
    bg: "#f8fafc",
    bgAlt: "#f3f4f6",
    border: "#e5e7eb",
    white: "#ffffff",
  },
  radius: {
    sm: "0.25rem",
    default: "0.375rem",
    md: "0.5rem",
    lg: "0.75rem",
    card: "0.75rem",
    button: "0.375rem",
  },
  shadow: {
    xs: "0 1px 2px rgba(0, 0, 0, 0.04)",
    sm: "0 1px 3px rgba(0, 0, 0, 0.04), 0 1px 2px rgba(0, 0, 0, 0.02)",
    md: "0 4px 12px rgba(0, 0, 0, 0.08), 0 2px 4px rgba(0, 0, 0, 0.04)",
    lg: "0 8px 24px rgba(0, 0, 0, 0.12)",
  },
} as const;
```

## ÉTAPE 4 — Push

```
git add -A
git commit -m "CDS v1.0.0 — tokens, tailwind preset, Inter, thème clair"
git push origin main
```

Lovable rebuild automatiquement. 0 crédits consommés.

## ÉTAPE 5 — Déclarer comme design system

Dans Lovable > Workspace Settings, marquer ce projet comme Design System.
Après ça, tout nouveau projet peut démarrer depuis CDS.

## ÉTAPE 6 — Appliquer à SKIA et KAIRO (via Git push, 0 crédits)

Pour chaque projet existant :

1. Cloner le repo Git du projet
2. Remplacer tailwind.config.ts par la version CDS (étape 3.1)
3. Remplacer index.html <head> (étape 3.2)
4. Remplacer src/index.css (étape 3.3)
5. Ajouter src/lib/cds-tokens.ts (étape 3.4)
6. Push → rebuild → 0 crédits

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://cds-mac97000.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/ac47a01d-6c74-4f33-a7a4-9391d4f333c7).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
