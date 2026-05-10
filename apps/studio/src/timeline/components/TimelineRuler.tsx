import type { CSSProperties } from 'react';
import { clamp, formatTime, ROW_GUTTER } from '../timeline-utils';

function buildTimelineTickStyle(left: number): CSSProperties {
  return { '--timeline-tick-left': `${left}px` } as CSSProperties;
}

export function TimelineRuler({
  rulerTicks,
  rowMsToPx,
  trackWidth,
  snapGuideMs,
  onPointerDown,
}: {
  rulerTicks: Array<{ atMs: number; isMajor: boolean }>;
  rowMsToPx: number;
  trackWidth: number;
  snapGuideMs?: number;
  onPointerDown: (clientX: number, startMs: number) => void;
}): JSX.Element {
  const rulerStyle = {
    '--timeline-ruler-left': `${ROW_GUTTER}px`,
    '--timeline-track-width': `${trackWidth}px`,
    '--timeline-snap-guide-left': snapGuideMs !== undefined ? `${snapGuideMs * rowMsToPx}px` : undefined,
  } as CSSProperties;

  return (
    <div
      className="timeline-ruler"
      style={rulerStyle}
      onPointerDown={(event) => {
        event.preventDefault();
        const bounds = event.currentTarget.getBoundingClientRect();
        const startMs = clamp(Math.round((event.clientX - bounds.left) / Math.max(rowMsToPx, 0.0001)), 0, Math.round(trackWidth / Math.max(rowMsToPx, 0.0001)));
        onPointerDown(event.clientX, startMs);
      }}
    >
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
