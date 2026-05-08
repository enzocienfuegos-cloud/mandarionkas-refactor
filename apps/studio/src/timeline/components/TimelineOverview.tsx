import type { CSSProperties } from 'react';
import type { TimelineDisplayRow } from '../types';
import { clamp } from '../timeline-utils';

export function TimelineOverview({
  displayedWidgets,
  selectedIds,
  playheadMs,
  sceneDurationMs,
  onSeek,
}: {
  displayedWidgets: TimelineDisplayRow[];
  selectedIds: string[];
  playheadMs: number;
  sceneDurationMs: number;
  onSeek: (ms: number) => void;
}): JSX.Element {
  const overviewStyle = {
    '--timeline-overview-playhead-left': `${(playheadMs / Math.max(1, sceneDurationMs)) * 100}%`,
  } as CSSProperties;

  return (
    <div className="timeline-overview-shell section">
      <div className="timeline-overview-labels">
        <span className="pill">Overview</span>
      </div>
      <div
        className="timeline-overview"
        style={overviewStyle}
        onPointerDown={(event) => {
          const bounds = event.currentTarget.getBoundingClientRect();
          const ratio = clamp((event.clientX - bounds.left) / Math.max(1, bounds.width), 0, 1);
          onSeek(Math.round(sceneDurationMs * ratio));
        }}
      >
        {displayedWidgets.map(({ widget, timing }) => {
          const left = (timing.startMs / Math.max(1, sceneDurationMs)) * 100;
          const width = ((timing.endMs - timing.startMs) / Math.max(1, sceneDurationMs)) * 100;
          return (
            <span
              key={widget.id}
              className={`timeline-overview-bar ${selectedIds.includes(widget.id) ? 'is-selected' : ''}`}
              style={{ '--timeline-overview-left': `${left}%`, '--timeline-overview-width': `${Math.max(width, 1)}%` } as CSSProperties}
            />
          );
        })}
        <span className="timeline-overview-playhead" />
      </div>
    </div>
  );
}
