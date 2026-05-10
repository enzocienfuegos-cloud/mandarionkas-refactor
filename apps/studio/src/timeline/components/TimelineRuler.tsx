import type { CSSProperties } from 'react';
import { formatTime, ROW_GUTTER } from '../timeline-utils';

function buildTimelineTickStyle(left: number): CSSProperties {
  return { '--timeline-tick-left': `${left}px` } as CSSProperties;
}

export function TimelineRuler({
  rulerTicks,
  rowMsToPx,
  trackWidth,
  playheadMs,
  snapGuideMs,
  onPointerDown,
}: {
  rulerTicks: Array<{ atMs: number; isMajor: boolean }>;
  rowMsToPx: number;
  trackWidth: number;
  playheadMs: number;
  snapGuideMs?: number;
  onPointerDown: (clientX: number, startMs: number) => void;
}): JSX.Element {
  const rulerStyle = {
    '--timeline-ruler-left': `${ROW_GUTTER}px`,
    '--timeline-track-width': `${trackWidth}px`,
    '--timeline-snap-guide-left': snapGuideMs !== undefined ? `${snapGuideMs * rowMsToPx}px` : undefined,
  } as CSSProperties;

  return (
    <div className="timeline-ruler" style={rulerStyle} onPointerDown={(event) => onPointerDown(event.clientX, playheadMs)}>
      {rulerTicks.map((tick) => (
        <div
          key={tick.atMs}
          className={`ruler-tick ${tick.isMajor ? 'is-major' : 'is-minor'}`}
          style={buildTimelineTickStyle(tick.atMs * rowMsToPx)}
        >
          {tick.isMajor ? <span>{formatTime(tick.atMs)}</span> : null}
        </div>
      ))}
      {snapGuideMs !== undefined ? <div className="timeline-snap-guide" /> : null}
      <div className="timeline-playhead">
        <span className="timeline-playhead-cap" />
      </div>
    </div>
  );
}
