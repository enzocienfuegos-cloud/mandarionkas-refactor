function isHexColor(value: string): boolean {
  return /^#[0-9a-fA-F]{6}$/.test(value);
}

function hexToRgb(value: string): [number, number, number] {
  const normalized = value.slice(1);
  return [
    Number.parseInt(normalized.slice(0, 2), 16),
    Number.parseInt(normalized.slice(2, 4), 16),
    Number.parseInt(normalized.slice(4, 6), 16),
  ];
}

function toAlphaColor(value: string, alpha: number): string {
  if (!isHexColor(value)) {
    throw new Error(`exportAlpha requires a six-digit hex token, received: ${value}`);
  }
  const [red, green, blue] = hexToRgb(value);
  const normalizedAlpha = Math.max(0, Math.min(1, alpha));
  return `rgba(${red},${green},${blue},${normalizedAlpha})`;
}

const exportCoreTokens = {
  bg: '#111820',
  panel: '#18222d',
  panelLight: '#ffffff',
  text: '#eef3f8',
  ink: '#0b1116',
  muted: '#9db0c2',
  accent: '#2563eb',
  accentSoft: '#8ab4ff',
  success: '#27c286',
  danger: '#e26a6a',
  warning: '#e8b34a',
  white: '#ffffff',
  slate50: '#f8fafc',
  slate: '#0f172a',
  darkSurface: '#1f2937',
  navy700: '#0b3b7a',
  teal700: '#0f766e',
  softBlue: '#dbeafe',
  softText: '#475569',
  mutedText: '#555555',
  mutedTextSecondary: '#666666',
  mutedTextStrong: '#334155',
  green: '#22c55e',
  teal: '#2dd4bf',
  sky: '#60a5fa',
  cyan: '#67e8f9',
  amber: '#f59e0b',
  red: '#ef4444',
  pink: '#ec4899',
  orange: '#f97316',
  bronze: '#9a3412',
  mapsBlue: '#4285f4',
  wazeBlue: '#08d4ff',
} as const;

/**
 * Canonical export colors must stay aligned with shared/theme.css for the core
 * shell palette. Export-only literals remain here for HTML/runtime-specific
 * rendering where CSS variables are not available.
 */
export const exportTokens = {
  ...exportCoreTokens,
  darkOverlay: toAlphaColor(exportCoreTokens.slate, 0.68),
  whitePanel: toAlphaColor(exportCoreTokens.white, 0.78),
  inkPanel: toAlphaColor('#111827', 0.94),
  darkOverlaySoft: toAlphaColor(exportCoreTokens.slate, 0.24),
  blackOverlay18: 'rgba(0,0,0,0.18)',
  blackShadow20: 'rgba(0,0,0,0.2)',
  blackShadow24: 'rgba(0,0,0,0.24)',
  darkInputBorder: toAlphaColor(exportCoreTokens.slate, 0.12),
  darkInputBorderSoft: toAlphaColor(exportCoreTokens.slate, 0.10),
  softPanelBorder: 'rgba(0,0,0,0.08)',
  darkShadowSoft: toAlphaColor(exportCoreTokens.slate, 0.08),
  darkShadowMedium: toAlphaColor(exportCoreTokens.slate, 0.12),
  whiteText40: toAlphaColor(exportCoreTokens.white, 0.4),
  whiteText45: toAlphaColor(exportCoreTokens.white, 0.45),
  whiteText94: toAlphaColor(exportCoreTokens.white, 0.94),
  whiteBorder08: toAlphaColor(exportCoreTokens.white, 0.08),
  whiteBorder12: toAlphaColor(exportCoreTokens.white, 0.12),
  whiteBorder18: toAlphaColor(exportCoreTokens.white, 0.18),
  greenGaugeGlow: 'rgba(34,197,94,0.20)',
  tealGaugeGlow: 'rgba(45,212,191,0.28)',
  greenGaugeBorder: 'rgba(120,255,196,0.24)',
  slateGradient: 'linear-gradient(135deg,#0f172a,#1e293b)',
  forestGradient: 'linear-gradient(135deg,#14532d,#365314)',
  skyGradient: 'linear-gradient(135deg,#dbeafe,#bfdbfe)',
  heroGradient: 'linear-gradient(160deg,#0f172a,#1d4ed8)',
  transparentToBlack: 'rgba(15,23,42,0)',
} as const;

export type ExportToken = keyof typeof exportTokens;

export const exportZIndex = {
  localBase: 0,
  local1: 1,
  local2: 2,
  raised: 100,
  sticky: 200,
  floating: 300,
  popover: 400,
  modal: 500,
  toast: 600,
  top: 700,
} as const;

export function exportColor(token: ExportToken): string {
  return exportTokens[token];
}

export function exportAlpha(token: ExportToken, alpha: number): string {
  return toAlphaColor(exportTokens[token], alpha);
}
