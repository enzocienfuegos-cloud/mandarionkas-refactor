import type { VASTCompanion, VASTCompanionResource } from '@smx/vast';

interface CompanionAdSlotProps {
  zoneId: string;
  companions: VASTCompanion[];
  onCompanionClick?: (companion: VASTCompanion) => void;
  style?: React.CSSProperties;
}

function renderResource(resource: VASTCompanionResource): JSX.Element {
  switch (resource.kind) {
    case 'static':
      return <img src={resource.src} alt="" style={{ display: 'block', width: '100%', height: '100%', objectFit: 'contain' }} draggable={false} />;
    case 'iframe':
      return <iframe title="companion-ad" src={resource.src} sandbox="allow-scripts allow-same-origin" scrolling="no" style={{ width: '100%', height: '100%', border: 'none' }} />;
    case 'html':
      return <iframe title="companion-ad" srcDoc={resource.html} sandbox="allow-scripts" scrolling="no" style={{ width: '100%', height: '100%', border: 'none', background: 'transparent' }} />;
  }
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
      style={{
        display: 'inline-block',
        width: current.width,
        height: current.height,
        cursor: current.clickThrough ? 'pointer' : 'default',
        overflow: 'hidden',
        ...style,
      }}
      onClick={current.clickThrough ? handleClick : undefined}
      role={current.clickThrough ? 'link' : undefined}
      aria-label={current.altText ?? 'Advertisement'}
    >
      {renderResource(current.resource)}
    </div>
  );
}
