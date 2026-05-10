export type Category = 'content' | 'media' | 'interactive' | 'layout';

export const thumbColors = {
  white: '#ffffff',
  violet50: '#f5f3ff',
  slate50: '#f8fafc',
  slate300: '#cbd5e1',
  slate800: '#1f2937',
  slate900: '#0f172a',
  amber500: '#f59e0b',
  green500: '#22c55e',
  cyan400: '#22d3ee',
  sky400: '#38bdf8',
  blue300: '#93c5fd',
  violet400: '#a78bfa',
  purple950: '#241b34',
  pink500: '#ec4899',
  red500: '#ef4444',
  facebookBlue: '#1877f2',
  navy950: '#020617',
  ink900: '#111827',
  darkCard: '#172033',
  ocean700: '#123b63',
  ocean950: '#082f49',
  slateSoft: '#dbeafe',
} as const;

export const thumbAlpha = {
  white05: 'rgba(255,255,255,0.05)',
  white12: 'rgba(255,255,255,0.12)',
  white18: 'rgba(255,255,255,0.18)',
} as const;

export function ThumbFrame({
  background,
  children,
}: {
  background: string;
  children: import('react').ReactNode;
}): JSX.Element {
  return (
    <svg viewBox="0 0 160 100" aria-hidden="true" className="widget-thumb-svg">
      <rect x="0" y="0" width="160" height="100" rx="18" fill={background} />
      {children}
    </svg>
  );
}

export function PlaceholderThumb({ category }: { category: Category }): JSX.Element {
  const palette = {
    content: { bg: thumbColors.slate800, fg: thumbColors.slate50, accent: thumbColors.amber500 },
    media: { bg: thumbColors.slate900, fg: thumbColors.slateSoft, accent: thumbColors.sky400 },
    interactive: { bg: thumbColors.darkCard, fg: thumbColors.slate50, accent: thumbColors.green500 },
    layout: { bg: thumbColors.purple950, fg: thumbColors.violet50, accent: thumbColors.violet400 },
  }[category];

  return (
    <ThumbFrame background={palette.bg}>
      <rect x="16" y="18" width="128" height="64" rx="14" fill={thumbAlpha.white05} stroke={thumbAlpha.white12} />
      <rect x="30" y="32" width="48" height="36" rx="10" fill={palette.accent} opacity="0.9" />
      <rect x="88" y="34" width="38" height="8" rx="4" fill={palette.fg} opacity="0.88" />
      <rect x="88" y="48" width="28" height="6" rx="3" fill={palette.fg} opacity="0.5" />
      <rect x="88" y="60" width="20" height="6" rx="3" fill={palette.fg} opacity="0.32" />
    </ThumbFrame>
  );
}
