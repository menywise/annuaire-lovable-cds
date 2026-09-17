/**
 * CDS — Consensus Design System — Tokens TypeScript
 * Source de vérité : CDS_TOKENS.md
 * Usage : import { cds } from '@/lib/cds-tokens'
 */
export const cds = {
  colors: {
    primary: '#0d6efd',
    primaryHover: '#0a58ca',
    success: '#198754',
    warning: '#ffc107',
    danger: '#dc3545',
    info: '#0dcaf0',
    secondary: '#6c757d',
    purple: '#7c3aed',
    text: '#1e293b',
    textMuted: '#64748b',
    bg: '#f8fafc',
    bgAlt: '#f3f4f6',
    border: '#e5e7eb',
    white: '#ffffff',
  },
  radius: {
    sm: '0.25rem',
    default: '0.375rem',
    md: '0.5rem',
    lg: '0.75rem',
    card: '0.75rem',
    button: '0.375rem',
  },
  shadow: {
    xs: '0 1px 2px rgba(0, 0, 0, 0.04)',
    sm: '0 1px 3px rgba(0, 0, 0, 0.04), 0 1px 2px rgba(0, 0, 0, 0.02)',
    md: '0 4px 12px rgba(0, 0, 0, 0.08), 0 2px 4px rgba(0, 0, 0, 0.04)',
    lg: '0 8px 24px rgba(0, 0, 0, 0.12)',
  },
} as const;
