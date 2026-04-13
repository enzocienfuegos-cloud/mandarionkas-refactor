import { formatTime, ROW_GUTTER } from '../timeline-utils';

export function TimelineRuler({
  rulerTicks,
  rowMsToPx,
  trackWidth,
  playheadLeft,
  playheadMs,
  snapGuideMs,
  onPointerDown,
}: {
  rulerTicks: Array<{ atMs: number; isMajor: boolean }>;
  rowMsToPx: number;
  trackWidth: number;
  playheadLeft: number;
  playheadMs: number;
  snapGuideMs?: number;
  onPointerDown: (clientX: number, startMs: number) => void;
}): JSX.Element {
  return (
    <div className="timeline-ruler" style={{ left: ROW_GUTTER, width: trackWidth }} onPointerDown={(event) => onPointerDown(event.clientX, playheadMs)}>
      {rulerTicks.map((tick) => (
        <div key={tick.atMs} className={`ruler-tick ${tick.isMajor ? 'is-major' : 'is-minor'}`} style={{ left: tick.atMs * rowMsToPx }}>
          {tick.isMajor ? <span>{formatTime(tick.atMs)}</span> : null}
        </div>
      ))}
      {snapGuideMs !== undefined ? <div className="timeline-snap-guide" style={{ left: snapGuideMs * rowMsToPx }} /> : null}
      <div className="timeline-playhead" style={{ left: playheadLeft }} />
    </div>
  );
}
