import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./app/**/*.{ts,tsx}",
    "./src/**/*.{ts,tsx}",
  ],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      /* ── shadcn/ui (conserver tel quel) ──────────────── */
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },

        /* ── CDS — Consensus Design System ────────────── */
        cds: {
          primary: "#0d6efd",
          "primary-hover": "#0a58ca",
          success: "#198754",
          warning: "#ffc107",
          "warning-dark": "#973600",
          danger: "#dc3545",
          info: "#0dcaf0",
          "info-dark": "#0891b2",
          secondary: "#6c757d",
          purple: "#7c3aed",
          "purple-light": "#ede9fe",

          /* Neutres */
          text: "#1e293b",
          "text-muted": "#64748b",
          "text-light": "#8e95a1",
          bg: "#f8fafc",
          "bg-alt": "#f3f4f6",
          border: "#e5e7eb",

          /* Surfaces subtiles */
          "blue-subtle": "#dbeafe",
          "green-subtle": "#dcfce7",
          "amber-subtle": "#fef3c7",
          "red-subtle": "#fee2e2",
          "cyan-subtle": "#cffafe",
          "purple-subtle": "#ede9fe",
          "gray-subtle": "#f3f4f6",

          /* Texte sur surfaces subtiles */
          "on-blue": "#205ee6",
          "on-green": "#008229",
          "on-amber": "#b45200",
          "on-red": "#cf1919",
          "on-cyan": "#007899",
          "on-purple": "#7c3aed",
          "on-gray": "#687179",
        },
      },

      /* ── Typographie CDS ────────────────────────────── */
      fontFamily: {
        sans: [
          "Inter",
          "system-ui",
          "-apple-system",
          '"Segoe UI"',
          "Roboto",
          "sans-serif",
        ],
        mono: ['"Courier New"', "monospace"],
      },

      fontSize: {
        "cds-xs": [".7rem", { lineHeight: "1.1" }],
        "cds-sm": [".78rem", { lineHeight: "1.4" }],
        "cds-base": [".88rem", { lineHeight: "1.5" }],
        "cds-md": [".95rem", { lineHeight: "1.5" }],
        "cds-lg": ["1.15rem", { lineHeight: "1.4" }],
        "cds-xl": ["1.5rem", { lineHeight: "1.2" }],
        "cds-2xl": ["2rem", { lineHeight: "1.2" }],
      },

      /* ── Spacing CDS (base 4px) ─────────────────────── */
      spacing: {
        "cds-xs": ".25rem",
        "cds-sm": ".5rem",
        "cds-md": ".75rem",
        "cds-lg": "1rem",
        "cds-xl": "1.5rem",
        "cds-2xl": "2rem",
      },

      /* ── Border radius CDS ──────────────────────────── */
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
        "cds-sm": ".25rem",
        cds: ".375rem",
        "cds-md": ".5rem",
        "cds-lg": ".75rem",
        "cds-full": "50%",
      },

      /* ── Box shadow CDS ─────────────────────────────── */
      boxShadow: {
        "cds-xs": "0 1px 2px rgba(0, 0, 0, 0.04)",
        "cds-sm":
          "0 1px 3px rgba(0, 0, 0, 0.04), 0 1px 2px rgba(0, 0, 0, 0.02)",
        "cds-md":
          "0 4px 12px rgba(0, 0, 0, 0.08), 0 2px 4px rgba(0, 0, 0, 0.04)",
        "cds-lg": "0 8px 24px rgba(0, 0, 0, 0.12)",
      },

      /* ── Transitions CDS ────────────────────────────── */
      transitionDuration: {
        "cds-fast": "150ms",
        cds: "200ms",
        "cds-slow": "300ms",
      },

      /* ── Layout CDS ─────────────────────────────────── */
      width: {
        "cds-sidebar": "260px",
      },
      height: {
        "cds-header": "56px",
      },
      maxWidth: {
        "cds-content": "1200px",
      },

      /* ── Animations shadcn (conserver) ──────────────── */
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
