import type { CountdownContent, OverlayPosition } from '@smx/contracts';

interface CountdownOverlayProps {
  content: CountdownContent;
  position: OverlayPosition;
  videoCurrentTimeSeconds: number;
  triggerTimeSeconds: number;
}

export function CountdownOverlay({
  content,
  position,
  videoCurrentTimeSeconds,
  triggerTimeSeconds,
}: CountdownOverlayProps): JSX.Element {
  const elapsed = Math.max(0, videoCurrentTimeSeconds - triggerTimeSeconds);
  const remaining = Math.max(0, content.fromSeconds - Math.floor(elapsed));
  const isDone = remaining === 0;

  const positionStyle: React.CSSProperties = {
    position: 'absolute',
    left: `${position.left}%`,
    top: `${position.top}%`,
    width: position.width !== undefined ? `${position.width}%` : undefined,
    height: position.height !== undefined ? `${position.height}%` : undefined,
    pointerEvents: 'none',
    userSelect: 'none',
  };

  const defaultStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '2rem',
    fontWeight: 700,
    color: '#fff',
    textShadow: '0 1px 4px rgba(0,0,0,0.6)',
    ...content.style,
  };

  return (
    <div style={positionStyle}>
      <div style={defaultStyle}>
        {isDone && content.completedLabel ? content.completedLabel : remaining}
      </div>
    </div>
  );
}
