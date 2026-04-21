import { formatTime } from '../timeline-utils';

export function TimelineHeader({
  displayedCount,
  selectedCount,
  isPlaying,
  playheadMs,
  sceneDurationMs,
  snapEnabled,
  snapStepMs,
  selectedOnly,
  timelineZoom,
  snapLabel,
  onResizeStart,
  onToggleCollapse,
  onTogglePlay,
  onResetPlayhead,
  onToggleSnap,
  onToggleSelectedOnly,
  onZoomOut,
  onZoomIn,
}: {
  displayedCount: number;
  selectedCount: number;
  isPlaying: boolean;
  playheadMs: number;
  sceneDurationMs: number;
  snapEnabled: boolean;
  snapStepMs: number;
  selectedOnly: boolean;
  timelineZoom: number;
  snapLabel?: string;
  onResizeStart: (startY: number) => void;
  onToggleCollapse: () => void;
  onTogglePlay: () => void;
  onResetPlayhead: () => void;
  onToggleSnap: () => void;
  onToggleSelectedOnly: () => void;
  onZoomOut: () => void;
  onZoomIn: () => void;
}): JSX.Element {
  return (
    <div className="section timeline-header-strip premium-timeline-header timeline-header-strip--ux">
      <div className="timeline-title-stack">
        <button className="timeline-resize-handle" type="button" title="Resize timeline" onPointerDown={(event) => { event.preventDefault(); onResizeStart(event.clientY); }}>↕</button>
        <div className="timeline-title-copy">
          <strong>Timeline</strong>
          <small>{displayedCount} track{displayedCount === 1 ? '' : 's'} · {selectedCount} selected</small>
        </div>
      </div>
      <div className="timeline-header-actions">
        <button className="ghost" onClick={onResetPlayhead}>⏮</button>
        <button className={`ghost timeline-play-toggle ${isPlaying ? 'is-active' : ''}`} onClick={onTogglePlay}>{isPlaying ? '⏸ Pause' : '▶ Play'}</button>
        <div className={`timeline-live-pill ${isPlaying ? 'is-live' : ''}`}>{isPlaying ? 'Live' : 'Idle'}</div>
        <button className={`ghost ${snapEnabled ? 'is-active' : ''}`} onClick={onToggleSnap}>{snapEnabled ? 'Snap on' : 'Snap off'}</button>
        <div className="pill">{snapEnabled ? `${snapStepMs}ms` : 'Free'}</div>
        <button className="ghost" onClick={onToggleSelectedOnly}>{selectedOnly ? 'Show all' : 'Selected only'}</button>
        <button className="ghost" onClick={onZoomOut}>−</button>
        <div className="pill">{timelineZoom.toFixed(2)}×</div>
        <button className="ghost" onClick={onZoomIn}>＋</button>
        <div className="pill">{formatTime(playheadMs)} / {formatTime(sceneDurationMs)}</div>
        {snapLabel ? <div className="pill timeline-snap-pill">⇄ {snapLabel}</div> : null}
        <button className="icon-button ghost panel-collapse-button" type="button" title="Hide timeline" aria-label="Hide timeline" onClick={onToggleCollapse}>⌄</button>
      </div>
    </div>
  );
}
