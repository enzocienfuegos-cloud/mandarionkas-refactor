import type { CSSProperties, RefObject } from 'react';
import type { TimelineDisplayRow } from '../types';
import { clamp } from '../timeline-utils';

function buildTimelineOverviewBarStyle(left: number, width: number): CSSProperties {
  return {
    '--timeline-overview-left': `${left}%`,
    '--timeline-overview-width': `${Math.max(width, 1)}%`,
  } as CSSProperties;
}

export function TimelineOverview({
  overviewRef,
  displayedWidgets,
  selectedIds,
  sceneDurationMs,
  onSeek,
}: {
  overviewRef: RefObject<HTMLDivElement>;
  displayedWidgets: TimelineDisplayRow[];
  selectedIds: string[];
  sceneDurationMs: number;
  onSeek: (ms: number) => void;
}): JSX.Element {
  function seekFromPointer(target: HTMLDivElement, clientX: number): void {
    const bounds = target.getBoundingClientRect();
    const ratio = clamp((clientX - bounds.left) / Math.max(1, bounds.width), 0, 1);
    onSeek(Math.round(sceneDurationMs * ratio));
  }

  return (
    <div className="timeline-overview-shell section">
      <div className="timeline-overview-labels">
        <span className="pill">Overview</span>
      </div>
      <div
        ref={overviewRef}
        className="timeline-overview"
        onPointerDown={(event) => {
          event.preventDefault();
          const target = event.currentTarget;
          seekFromPointer(target, event.clientX);

          const handleMove = (moveEvent: PointerEvent) => {
            seekFromPointer(target, moveEvent.clientX);
          };
          const handleUp = () => {
            window.removeEventListener('pointermove', handleMove);
            window.removeEventListener('pointerup', handleUp);
            window.removeEventListener('pointercancel', handleUp);
          };

          window.addEventListener('pointermove', handleMove);
          window.addEventListener('pointerup', handleUp, { once: true });
          window.addEventListener('pointercancel', handleUp, { once: true });
        }}
      >
        {displayedWidgets.map(({ widget, timing }) => {
          const left = (timing.startMs / Math.max(1, sceneDurationMs)) * 100;
          const width = ((timing.endMs - timing.startMs) / Math.max(1, sceneDurationMs)) * 100;
          return (
            <span
              key={widget.id}
              className={`timeline-overview-bar ${selectedIds.includes(widget.id) ? 'is-selected' : ''}`}
              style={buildTimelineOverviewBarStyle(left, width)}
            />
          );
        })}
        <span className="timeline-overview-playhead" />
      </div>
    </div>
  );
}
