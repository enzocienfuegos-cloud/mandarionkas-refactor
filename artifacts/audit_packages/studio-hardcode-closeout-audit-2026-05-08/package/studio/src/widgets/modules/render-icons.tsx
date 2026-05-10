import type { CSSProperties } from 'react';
import { StudioIcon, StudioIcons } from '../../shared/ui/icons';

type ModuleArrowDirection = 'up' | 'down' | 'left' | 'right';
type ModuleHotspotKind = 'arrow-up' | 'arrow-down' | 'arrow-left' | 'arrow-right' | 'info' | 'plus';

function buildModuleMediaPlaceholderStyle(color: string, background: string): CSSProperties {
  return {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    color,
    background,
    fontSize: 12,
    fontFamily: 'sans-serif',
    textAlign: 'center',
  };
}

function buildVerifiedBadgeStyle(size: number): CSSProperties {
  return {
    width: size,
    height: size,
    background: '#20d5ec',
    borderRadius: '50%',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#000',
    flexShrink: 0,
  };
}

function buildPlayOverlayStyle(size: number): CSSProperties {
  return {
    width: size,
    height: size,
    borderRadius: '50%',
    background: 'rgba(255,255,255,0.12)',
    border: '1px solid rgba(255,255,255,0.3)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backdropFilter: 'blur(6px)',
  };
}

export function ModuleArrowIcon({
  direction,
  size = 18,
  color = 'currentColor',
  strokeWidth = 2.3,
}: {
  direction: ModuleArrowDirection;
  size?: number;
  color?: string;
  strokeWidth?: number;
}): JSX.Element {
  const icon =
    direction === 'up'
      ? StudioIcons.arrowUp
      : direction === 'down'
        ? StudioIcons.arrowDown
        : direction === 'left'
          ? StudioIcons.arrowLeft
          : StudioIcons.arrowRight;
  return <StudioIcon icon={icon} size={size} color={color} strokeWidth={strokeWidth} />;
}

export function ModuleMediaPlaceholder({
  kind,
  label,
  iconSize = 22,
  color = '#90959c',
  background = 'transparent',
}: {
  kind: 'image' | 'video';
  label?: string;
  iconSize?: number;
  color?: string;
  background?: string;
}): JSX.Element {
  return (
    <div
      style={buildModuleMediaPlaceholderStyle(color, background)}
    >
      <StudioIcon icon={kind === 'video' ? StudioIcons.play : StudioIcons.images} size={iconSize} strokeWidth={2.1} />
      <span>{label ?? (kind === 'video' ? 'Video not set' : 'Image not set')}</span>
    </div>
  );
}

export function ModuleHotspotIcon({
  kind,
  size = 16,
  color = 'currentColor',
}: {
  kind: ModuleHotspotKind;
  size?: number;
  color?: string;
}): JSX.Element {
  const icon =
    kind === 'arrow-up'
      ? StudioIcons.arrowUp
      : kind === 'arrow-down'
        ? StudioIcons.arrowDown
        : kind === 'arrow-left'
          ? StudioIcons.arrowLeft
          : kind === 'arrow-right'
            ? StudioIcons.arrowRight
            : kind === 'info'
              ? StudioIcons.info
              : StudioIcons.plus;
  return <StudioIcon icon={icon} size={size} color={color} strokeWidth={2.4} />;
}

export function VerifiedBadgeIcon({ size = 14 }: { size?: number }): JSX.Element {
  return (
    <span style={buildVerifiedBadgeStyle(size)}>
      <StudioIcon icon={StudioIcons.check} size={size * 0.72} strokeWidth={2.7} />
    </span>
  );
}

export function PlayOverlayIcon({ size = 52 }: { size?: number }): JSX.Element {
  return (
    <div style={buildPlayOverlayStyle(size)}>
      <StudioIcon icon={StudioIcons.play} size={size * 0.5} color="#ffffff" strokeWidth={2.3} />
    </div>
  );
}
