import type { VASTCompanion, VASTCompanionResource } from '@smx/vast';

const companionImageStyle = {
  display: 'block',
  width: '100%',
  height: '100%',
  objectFit: 'contain',
} as const;

const companionIframeStyle = {
  width: '100%',
  height: '100%',
  border: 'none',
} as const;

const companionHtmlIframeStyle = {
  ...companionIframeStyle,
  background: 'transparent',
} as const;

interface CompanionAdSlotProps {
  zoneId: string;
  companions: VASTCompanion[];
  onCompanionClick?: (companion: VASTCompanion) => void;
  style?: React.CSSProperties;
}

function renderResource(resource: VASTCompanionResource): JSX.Element {
  switch (resource.kind) {
    case 'static':
      return <img src={resource.src} alt="" decoding="async" style={companionImageStyle} draggable={false} />;
    case 'iframe':
      return <iframe title="companion-ad" src={resource.src} sandbox="allow-scripts allow-same-origin" scrolling="no" style={companionIframeStyle} />;
    case 'html':
      return <iframe title="companion-ad" srcDoc={resource.html} sandbox="allow-scripts" scrolling="no" style={companionHtmlIframeStyle} />;
  }
}

function buildCompanionSlotStyle(
  current: VASTCompanion,
  style?: React.CSSProperties,
): React.CSSProperties {
  return {
    display: 'inline-block',
    width: current.width,
    height: current.height,
    cursor: current.clickThrough ? 'pointer' : 'default',
    overflow: 'hidden',
    ...style,
  };
}

export function CompanionAdSlot({ zoneId, companions, onCompanionClick, style }: CompanionAdSlotProps): JSX.Element | null {
  const companion = companions.find((item) => item.zoneId === zoneId);
  if (!companion) return null;
  const current = companion;

  function handleClick(): void {
    current.clickTrackingUrls.forEach((url) => {
      try {
        new Image().src = url;
      } catch {
        // noop
      }
    });
    if (current.clickThrough) {
      window.open(current.clickThrough, '_blank', 'noopener,noreferrer');
    }
    onCompanionClick?.(current);
  }

  return (
    <div
      style={buildCompanionSlotStyle(current, style)}
      onClick={current.clickThrough ? handleClick : undefined}
      role={current.clickThrough ? 'link' : undefined}
      aria-label={current.altText ?? 'Advertisement'}
    >
      {renderResource(current.resource)}
    </div>
  );
}
