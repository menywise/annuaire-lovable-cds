/**
 * CDS — Consensus Design System — Tokens TypeScript
 * VERSION  : 1.0.0
 * DATE     : 2026-09-17
 * SOURCE   : CDS_TOKENS.md (source de vérité unique)
 * USAGE    : import { cds } from '@/lib/cds-tokens'
 */

export const cds = {
  colors: {
    primary: "#0d6efd",
    primaryHover: "#0a58ca",
    success: "#198754",
    warning: "#ffc107",
    warningDark: "#973600",
    danger: "#dc3545",
    info: "#0dcaf0",
    infoDark: "#0891b2",
    secondary: "#6c757d",
    purple: "#7c3aed",
    purpleLight: "#ede9fe",
    text: "#1e293b",
    textMuted: "#64748b",
    textLight: "#8e95a1",
    bg: "#f8fafc",
    bgAlt: "#f3f4f6",
    border: "#e5e7eb",
    white: "#ffffff",
  },
  subtle: {
    blue: { bg: "#dbeafe", text: "#205ee6" },
    green: { bg: "#dcfce7", text: "#008229" },
    amber: { bg: "#fef3c7", text: "#b45200" },
    red: { bg: "#fee2e2", text: "#cf1919" },
    cyan: { bg: "#cffafe", text: "#007899" },
    purple: { bg: "#ede9fe", text: "#7c3aed" },
    gray: { bg: "#f3f4f6", text: "#687179" },
  },
  radius: {
    sm: "0.25rem",
    default: "0.375rem",
    md: "0.5rem",
    lg: "0.75rem",
    full: "50%",
  },
  shadow: {
    xs: "0 1px 2px rgba(0, 0, 0, 0.04)",
    sm: "0 1px 3px rgba(0, 0, 0, 0.04), 0 1px 2px rgba(0, 0, 0, 0.02)",
    md: "0 4px 12px rgba(0, 0, 0, 0.08), 0 2px 4px rgba(0, 0, 0, 0.04)",
    lg: "0 8px 24px rgba(0, 0, 0, 0.12)",
  },
  transition: {
    fast: "150ms",
    default: "200ms",
    slow: "300ms",
  },
  layout: {
    sidebarWidth: "260px",
    headerHeight: "56px",
    maxContentWidth: "1200px",
  },
} as const;

export type CdsColors = keyof typeof cds.colors;
export type CdsSubtle = keyof typeof cds.subtle;
