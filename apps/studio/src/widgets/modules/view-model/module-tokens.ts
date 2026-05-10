import { exportTokens } from '../../../export/export-tokens';
import type {
  ModuleClassNames,
  ModuleCssVars,
  ModuleRenderSurface,
  ModuleSkin,
  ModuleSkinDensity,
  ModuleSkinMotion,
  ModuleSkinPresetId,
  ModuleSkinRadius,
  ModuleSkinSurface,
  ModuleSkinTone,
  ModuleTokens,
} from './types';

export const MODULE_SKIN_PRESET_OPTIONS = [
  { value: 'solid', label: 'Solid' },
  { value: 'glass', label: 'Glass' },
  { value: 'editorial', label: 'Editorial' },
  { value: 'commerce', label: 'Commerce' },
  { value: 'social', label: 'Social' },
] as const satisfies ReadonlyArray<{ value: ModuleSkinPresetId; label: string }>;

const SKIN_SURFACES = ['solid', 'glass', 'editorial', 'commerce', 'social'] as const;
const SKIN_DENSITIES = ['compact', 'standard', 'immersive'] as const;
const SKIN_RADII = ['sm', 'md', 'lg', 'xl'] as const;
const SKIN_MOTIONS = ['none', 'subtle', 'premium'] as const;
const SKIN_TONES = ['neutral', 'brand', 'dark', 'light'] as const;
const SKIN_PRESETS = ['solid', 'glass', 'editorial', 'commerce', 'social'] as const;

const SKIN_PRESET_MAP: Record<ModuleSkinPresetId, ModuleSkin> = {
  solid: {
    surface: 'solid',
    density: 'standard',
    radius: 'md',
    motion: 'subtle',
    tone: 'neutral',
  },
  glass: {
    surface: 'glass',
    density: 'standard',
    radius: 'lg',
    motion: 'premium',
    tone: 'neutral',
  },
  editorial: {
    surface: 'editorial',
    density: 'immersive',
    radius: 'xl',
    motion: 'subtle',
    tone: 'dark',
  },
  commerce: {
    surface: 'commerce',
    density: 'standard',
    radius: 'lg',
    motion: 'premium',
    tone: 'brand',
  },
  social: {
    surface: 'social',
    density: 'compact',
    radius: 'xl',
    motion: 'premium',
    tone: 'light',
  },
};

function isSkinValue<T extends readonly string[]>(value: unknown, allowed: T): value is T[number] {
  return typeof value === 'string' && allowed.includes(value as T[number]);
}

function isSkinPreset(value: unknown): value is ModuleSkinPresetId {
  return isSkinValue(value, SKIN_PRESETS);
}

function pickSkinValue<T extends readonly string[]>(style: Record<string, unknown>, keys: string[], allowed: T, fallback: T[number]): T[number] {
  const match = keys
    .map((key) => style[key])
    .find((value) => isSkinValue(value, allowed));
  return match ?? fallback;
}

export function getModuleSkinPreset(style: Record<string, unknown> = {}): ModuleSkinPresetId | null {
  const preset = style.modulePreset ?? style.skinPreset ?? style.visualPreset;
  return isSkinPreset(preset) ? preset : null;
}

export function getModuleSkinPresetPatch(preset: ModuleSkinPresetId): Record<string, ModuleSkinPresetId | ModuleSkinDensity | ModuleSkinRadius | ModuleSkinMotion | ModuleSkinTone | ModuleSkinSurface> {
  const base = SKIN_PRESET_MAP[preset];
  return {
    modulePreset: preset,
    moduleSurface: base.surface,
    moduleDensity: base.density,
    moduleRadius: base.radius,
    moduleMotion: base.motion,
    moduleTone: base.tone,
  };
}

function resolveForeground(surface: ModuleSkinSurface, tone: ModuleSkinTone): string {
  if (tone === 'dark') return exportTokens.ink;
  if (tone === 'light') return exportTokens.text;
  if (surface === 'editorial' || surface === 'commerce') return exportTokens.ink;
  return exportTokens.text;
}

function resolveMutedForeground(surface: ModuleSkinSurface, tone: ModuleSkinTone): string {
  if (tone === 'dark') return exportTokens.mutedTextStrong;
  if (tone === 'light') return exportTokens.muted;
  if (surface === 'editorial' || surface === 'commerce') return exportTokens.mutedTextStrong;
  return exportTokens.muted;
}

function resolveAccent(surface: ModuleSkinSurface, tone: ModuleSkinTone): string {
  if (tone === 'brand') return exportTokens.accent;
  if (tone === 'dark') return exportTokens.ink;
  if (tone === 'light') return exportTokens.white;
  if (surface === 'commerce') return exportTokens.accent;
  if (surface === 'social') return '#f472b6';
  return exportTokens.white;
}

export function resolveSkinFromStyle(style: Record<string, unknown> = {}): ModuleSkin {
  const preset = getModuleSkinPreset(style);
  const presetSkin = preset ? SKIN_PRESET_MAP[preset] : SKIN_PRESET_MAP.solid;

  return {
    surface: pickSkinValue(style, ['moduleSurface', 'skinSurface', 'surfaceStyle'], SKIN_SURFACES, presetSkin.surface),
    density: pickSkinValue(style, ['moduleDensity', 'skinDensity'], SKIN_DENSITIES, presetSkin.density),
    radius: pickSkinValue(style, ['moduleRadius', 'skinRadius'], SKIN_RADII, presetSkin.radius),
    motion: pickSkinValue(style, ['moduleMotion', 'skinMotion'], SKIN_MOTIONS, presetSkin.motion),
    tone: pickSkinValue(style, ['moduleTone', 'skinTone'], SKIN_TONES, presetSkin.tone),
  };
}

export function resolveTokensFromSkin(skin: ModuleSkin): ModuleTokens {
  const backgroundBySurface: Record<ModuleSkinSurface, { background: string; backgroundStrong: string; border: string; shadow: string; backdropBlur: string }> = {
    solid: {
      background: exportTokens.inkPanel,
      backgroundStrong: exportTokens.ink,
      border: exportTokens.whiteBorder12,
      shadow: '0 18px 40px rgba(15,23,42,0.26)',
      backdropBlur: '0px',
    },
    glass: {
      background: 'rgba(15,23,42,0.72)',
      backgroundStrong: 'rgba(15,23,42,0.88)',
      border: 'rgba(255,255,255,0.18)',
      shadow: '0 20px 48px rgba(15,23,42,0.34)',
      backdropBlur: '18px',
    },
    editorial: {
      background: '#ffffff',
      backgroundStrong: '#f8fafc',
      border: 'rgba(15,23,42,0.08)',
      shadow: '0 14px 30px rgba(15,23,42,0.12)',
      backdropBlur: '0px',
    },
    commerce: {
      background: '#fff7ed',
      backgroundStrong: '#ffedd5',
      border: 'rgba(249,115,22,0.16)',
      shadow: '0 18px 36px rgba(249,115,22,0.16)',
      backdropBlur: '0px',
    },
    social: {
      background: '#111827',
      backgroundStrong: '#0f172a',
      border: 'rgba(244,114,182,0.22)',
      shadow: '0 22px 48px rgba(17,24,39,0.28)',
      backdropBlur: '12px',
    },
  };

  const paddingByDensity: Record<ModuleSkinDensity, { x: string; y: string; gap: string }> = {
    compact: { x: '12px', y: '10px', gap: '8px' },
    standard: { x: '16px', y: '14px', gap: '12px' },
    immersive: { x: '20px', y: '18px', gap: '16px' },
  };

  const radiusByScale: Record<ModuleSkinRadius, string> = {
    sm: '10px',
    md: '14px',
    lg: '20px',
    xl: '28px',
  };

  const durationByMotion: Record<ModuleSkinMotion, string> = {
    none: '0ms',
    subtle: '180ms',
    premium: '320ms',
  };

  const timingByMotion: Record<ModuleSkinMotion, string> = {
    none: 'linear',
    subtle: 'cubic-bezier(0.22, 1, 0.36, 1)',
    premium: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
  };

  const surfaceTokens = backgroundBySurface[skin.surface];
  const spacingTokens = paddingByDensity[skin.density];

  return {
    background: surfaceTokens.background,
    backgroundStrong: surfaceTokens.backgroundStrong,
    foreground: resolveForeground(skin.surface, skin.tone),
    foregroundMuted: resolveMutedForeground(skin.surface, skin.tone),
    accent: resolveAccent(skin.surface, skin.tone),
    border: surfaceTokens.border,
    shadow: surfaceTokens.shadow,
    radius: radiusByScale[skin.radius],
    paddingX: spacingTokens.x,
    paddingY: spacingTokens.y,
    gap: spacingTokens.gap,
    backdropBlur: surfaceTokens.backdropBlur,
    transitionDuration: durationByMotion[skin.motion],
    transitionTiming: timingByMotion[skin.motion],
  };
}

export function resolveClassNamesFromSkin(skin: ModuleSkin, surface: ModuleRenderSurface): ModuleClassNames {
  const base = [
    'module-vm',
    `module-vm--surface-${surface}`,
    `module-vm--skin-${skin.surface}`,
    `module-vm--density-${skin.density}`,
    `module-vm--radius-${skin.radius}`,
    `module-vm--motion-${skin.motion}`,
    `module-vm--tone-${skin.tone}`,
  ].join(' ');

  return {
    root: `${base} module-vm__root`,
    panel: `${base} module-vm__panel`,
    eyebrow: `${base} module-vm__eyebrow`,
    title: `${base} module-vm__title`,
    body: `${base} module-vm__body`,
    cta: `${base} module-vm__cta`,
  };
}

export function resolveCssVarsFromTokens(tokens: ModuleTokens): ModuleCssVars {
  return {
    '--module-background': tokens.background,
    '--module-backgroundStrong': tokens.backgroundStrong,
    '--module-foreground': tokens.foreground,
    '--module-foregroundMuted': tokens.foregroundMuted,
    '--module-accent': tokens.accent,
    '--module-border': tokens.border,
    '--module-shadow': tokens.shadow,
    '--module-radius': tokens.radius,
    '--module-paddingX': tokens.paddingX,
    '--module-paddingY': tokens.paddingY,
    '--module-gap': tokens.gap,
    '--module-backdropBlur': tokens.backdropBlur,
    '--module-transitionDuration': tokens.transitionDuration,
    '--module-transitionTiming': tokens.transitionTiming,
  };
}
