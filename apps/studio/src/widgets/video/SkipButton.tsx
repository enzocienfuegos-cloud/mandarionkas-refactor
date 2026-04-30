import type { CSSProperties } from 'react';

export interface SkipButtonConfig {
  countingLabel: string;
  skipLabel: string;
  position: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
  style?: CSSProperties;
}

export const DEFAULT_SKIP_CONFIG: SkipButtonConfig = {
  countingLabel: 'Skip in {seconds}',
  skipLabel: 'Skip Ad ›',
  position: 'bottom-right',
};

interface SkipButtonProps {
  countdownSeconds: number;
  config?: Partial<SkipButtonConfig>;
  onSkip: () => void;
}

const POSITION_STYLES: Record<SkipButtonConfig['position'], CSSProperties> = {
  'bottom-right': { bottom: '12px', right: '12px' },
  'bottom-left': { bottom: '12px', left: '12px' },
  'top-right': { top: '12px', right: '12px' },
  'top-left': { top: '12px', left: '12px' },
};

export function SkipButton({ countdownSeconds, config = {}, onSkip }: SkipButtonProps): JSX.Element {
  const {
    countingLabel = DEFAULT_SKIP_CONFIG.countingLabel,
    skipLabel = DEFAULT_SKIP_CONFIG.skipLabel,
    position = DEFAULT_SKIP_CONFIG.position,
    style = {},
  } = config;

  const canSkip = countdownSeconds <= 0;
  const label = canSkip ? skipLabel : countingLabel.replace('{seconds}', String(Math.ceil(countdownSeconds)));

  const buttonStyle: CSSProperties = {
    position: 'absolute',
    zIndex: 10,
    padding: '6px 14px',
    fontSize: '0.875rem',
    fontWeight: 600,
    border: '1px solid rgba(255,255,255,0.6)',
    borderRadius: '2px',
    cursor: canSkip ? 'pointer' : 'default',
    backgroundColor: 'rgba(0,0,0,0.55)',
    color: '#fff',
    userSelect: 'none',
    transition: 'background-color 0.2s',
    ...POSITION_STYLES[position],
    ...style,
  };

  return (
    <button type="button" style={buttonStyle} disabled={!canSkip} onClick={canSkip ? onSkip : undefined} aria-label={label}>
      {label}
    </button>
  );
}
