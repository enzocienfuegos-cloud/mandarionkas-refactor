import type { CustomHtmlContent, OverlayPosition } from '@smx/contracts';
import type { CSSProperties } from 'react';

interface CustomHtmlOverlayProps {
  content: CustomHtmlContent;
  position: OverlayPosition;
}

export function CustomHtmlOverlay({ content, position }: CustomHtmlOverlayProps): JSX.Element {
  const positionStyle: CSSProperties = {
    position: 'absolute',
    left: `${position.left}%`,
    top: `${position.top}%`,
    width: position.width !== undefined ? `${position.width}%` : '100%',
    height: position.height !== undefined ? `${position.height}%` : 'auto',
    pointerEvents: 'auto',
    border: 'none',
    overflow: 'hidden',
  };
  const frameStyle: CSSProperties = {
    ...positionStyle,
    background: 'transparent',
    display: 'block',
  };

  return (
    <iframe
      title="custom-overlay"
      srcDoc={content.html}
      sandbox="allow-scripts"
      scrolling="no"
      style={frameStyle}
    />
  );
}
