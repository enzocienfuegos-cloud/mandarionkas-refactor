import type { CustomHtmlContent, OverlayPosition } from '@smx/contracts';

interface CustomHtmlOverlayProps {
  content: CustomHtmlContent;
  position: OverlayPosition;
}

export function CustomHtmlOverlay({ content, position }: CustomHtmlOverlayProps): JSX.Element {
  const positionStyle: React.CSSProperties = {
    position: 'absolute',
    left: `${position.left}%`,
    top: `${position.top}%`,
    width: position.width !== undefined ? `${position.width}%` : '100%',
    height: position.height !== undefined ? `${position.height}%` : 'auto',
    pointerEvents: 'auto',
    border: 'none',
    overflow: 'hidden',
  };

  return (
    <iframe
      title="custom-overlay"
      srcDoc={content.html}
      sandbox="allow-scripts"
      scrolling="no"
      style={{ ...positionStyle, background: 'transparent', display: 'block' }}
    />
  );
}
