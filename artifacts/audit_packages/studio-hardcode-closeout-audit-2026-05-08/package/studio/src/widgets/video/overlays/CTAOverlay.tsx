import type { CTAContent, OverlayPosition } from '@smx/contracts';

interface CTAOverlayProps {
  content: CTAContent;
  position: OverlayPosition;
  onClick?: (url: string) => void;
}

export function CTAOverlay({ content, position, onClick }: CTAOverlayProps): JSX.Element {
  const positionStyle: React.CSSProperties = {
    position: 'absolute',
    left: `${position.left}%`,
    top: `${position.top}%`,
    width: position.width !== undefined ? `${position.width}%` : 'auto',
    height: position.height !== undefined ? `${position.height}%` : 'auto',
    pointerEvents: 'auto',
  };

  const defaultButtonStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '0.5rem 1.25rem',
    borderRadius: '4px',
    border: 'none',
    cursor: 'pointer',
    fontWeight: 600,
    fontSize: '0.95rem',
    backgroundColor: '#fff',
    color: '#111',
    textDecoration: 'none',
    boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
    ...content.style,
  };

  function handleClick(event: React.MouseEvent): void {
    event.stopPropagation();
    onClick?.(content.url);
    if (content.openInNewTab !== false) {
      window.open(content.url, '_blank', 'noopener,noreferrer');
    }
  }

  return (
    <div style={positionStyle}>
      <button type="button" style={defaultButtonStyle} onClick={handleClick}>
        {content.label}
      </button>
    </div>
  );
}
