import { useState } from 'react';
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
  onChangeDuration,
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
  onChangeDuration: (ms: number) => void;
}): JSX.Element {
  const [editingDuration, setEditingDuration] = useState(false);
  const [draftDurationSec, setDraftDurationSec] = useState('');

  function startEditDuration(): void {
    setDraftDurationSec((sceneDurationMs / 1000).toFixed(1));
    setEditingDuration(true);
  }

  function commitDuration(): void {
    const seconds = parseFloat(draftDurationSec);
    if (!Number.isNaN(seconds)) {
      const ms = Math.round(Math.max(500, Math.min(120_000, seconds * 1000)));
      onChangeDuration(ms);
    }
    setEditingDuration(false);
  }

  function handleDurationKeyDown(event: React.KeyboardEvent<HTMLInputElement>): void {
    if (event.key === 'Enter') commitDuration();
    if (event.key === 'Escape') setEditingDuration(false);
  }

  return (
    <div className="timeline-header-strip timeline-header-strip--ux">
      <div className="timeline-title-stack">
        <button className="timeline-resize-handle" type="button" title="Resize timeline" onPointerDown={(event) => { event.preventDefault(); onResizeStart(event.clientY); }}>↕</button>
        <div className="timeline-title-copy">
          <strong>Timeline</strong>
          <small>{displayedCount} track{displayedCount === 1 ? '' : 's'} · {selectedCount} selected</small>
        </div>
      </div>
      <div className="timeline-controls">
        <div className="timeline-ctrl-group">
          <button className="ghost" type="button" title="Go to start" onClick={onResetPlayhead}>⏮</button>
          <button className={`ghost timeline-play-toggle${isPlaying ? ' is-active' : ''}`} type="button" onClick={onTogglePlay}>
            {isPlaying ? '⏸ Pause' : '▶ Play'}
          </button>
          <div className={`timeline-live-pill${isPlaying ? ' is-live' : ''}`} aria-live="polite">
            {isPlaying ? 'Live' : 'Idle'}
          </div>
        </div>

        <div className="timeline-ctrl-divider" aria-hidden="true" />

        <div className="timeline-ctrl-group">
          <button
            className={`ghost${snapEnabled ? ' is-active' : ''}`}
            type="button"
            onClick={onToggleSnap}
            title={snapEnabled ? `Snap enabled — step ${snapStepMs}ms` : 'Snap disabled'}
          >
            {snapEnabled ? `Snap · ${snapStepMs}ms` : 'Snap off'}
          </button>
        </div>

        <div className="timeline-ctrl-divider" aria-hidden="true" />

        <div className="timeline-ctrl-group">
          <button
            className={`ghost${selectedOnly ? ' is-active' : ''}`}
            type="button"
            onClick={onToggleSelectedOnly}
            title={selectedOnly ? 'Showing selected layers only — click to show all' : 'Click to show selected layers only'}
          >
            {selectedOnly ? 'Selection' : 'All'}
          </button>
        </div>

        <div className="timeline-ctrl-divider" aria-hidden="true" />

        <div className="timeline-ctrl-group">
          <button className="ghost" type="button" onClick={onZoomOut} title="Zoom out" aria-label="Zoom out">−</button>
          <span className="pill timeline-zoom-pill" title={`Zoom: ${timelineZoom.toFixed(2)}×`}>
            {Math.round(timelineZoom * 100)}%
          </span>
          <button className="ghost" type="button" onClick={onZoomIn} title="Zoom in" aria-label="Zoom in">+</button>
        </div>

        <div className="timeline-ctrl-divider" aria-hidden="true" />

        <div className="timeline-ctrl-group timeline-ctrl-group--duration">
          <span className="timeline-playhead-time">{formatTime(playheadMs)}</span>
          <span className="timeline-duration-sep">/</span>
          {editingDuration ? (
            <input
              className="timeline-duration-input"
              type="number"
              min={0.5}
              max={120}
              step={0.5}
              value={draftDurationSec}
              onChange={(event) => setDraftDurationSec(event.target.value)}
              onBlur={commitDuration}
              onKeyDown={handleDurationKeyDown}
              autoFocus
              aria-label="Banner duration in seconds"
              title="Banner duration (seconds) — press Enter to confirm"
            />
          ) : (
            <button
              className="ghost timeline-duration-btn"
              type="button"
              onClick={startEditDuration}
              title="Click to change banner duration"
              aria-label={`Banner duration: ${formatTime(sceneDurationMs)} — click to edit`}
            >
              {formatTime(sceneDurationMs)}
            </button>
          )}
          {snapLabel ? (
            <span className="pill timeline-snap-pill" title="Snap target">⇄ {snapLabel}</span>
          ) : null}
        </div>

        <button className="icon-button ghost panel-collapse-button" type="button" title="Hide timeline" aria-label="Hide timeline" onClick={onToggleCollapse}>⌄</button>
      </div>
    </div>
  );
}
