import type { LogoContent, OverlayPosition } from '@smx/contracts';

interface LogoOverlayProps {
  content: LogoContent;
  position: OverlayPosition;
}

function resolveAssetUrl(assetId: string): string {
  const base = import.meta.env.VITE_ASSETS_BASE_URL ?? '';
  return `${base.replace(/\/$/, '')}/${assetId}`;
}

export function LogoOverlay({ content, position }: LogoOverlayProps): JSX.Element {
  const positionStyle: React.CSSProperties = {
    position: 'absolute',
    left: `${position.left}%`,
    top: `${position.top}%`,
    width: position.width !== undefined ? `${position.width}%` : 'auto',
    height: position.height !== undefined ? `${position.height}%` : 'auto',
    pointerEvents: 'none',
  };

  return (
    <div style={positionStyle}>
      <img
        src={resolveAssetUrl(content.assetId)}
        alt={content.altText ?? ''}
        style={{ display: 'block', maxWidth: '100%', ...content.style }}
        draggable={false}
      />
    </div>
  );
}
