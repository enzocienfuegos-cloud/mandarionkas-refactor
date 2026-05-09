import { useState } from 'react';
import { formatTime } from '../timeline-utils';
import { Button } from '../../shared/ui/Button';
import { IconButton } from '../../shared/ui/IconButton';
import { StudioIcon, StudioIcons } from '../../shared/ui/icons';
import { Tooltip } from '../../shared/ui/Tooltip';

/**
 * Scene navigation lives inside the TimelineHeader as a dropdown instead of the
 * originally proposed chip strip.
 *
 * Reasoning: the header already carries transport, snap, selection filter,
 * zoom, duration, and status controls. A full-width chip strip forced either a
 * multi-line header or horizontal overflow on common laptop widths. The
 * dropdown keeps scene switching attached to the timeline, which was the
 * important UX win, while preserving a single-row header.
 *
 * If projects with 5+ scenes prove discoverability friction in user testing,
 * revisit this with either a dedicated strip above the header or a scene
 * overview popover.
 */
export function TimelineHeader({
  displayedCount,
  selectedCount,
  activeSceneId,
  scenes,
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
  onPreviousScene,
  onNextScene,
  onSelectScene,
  onToggleSnap,
  onToggleSelectedOnly,
  onZoomOut,
  onZoomIn,
  onChangeDuration,
}: {
  displayedCount: number;
  selectedCount: number;
  activeSceneId: string;
  scenes: Array<{ id: string; name: string }>;
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
  onPreviousScene: () => void;
  onNextScene: () => void;
  onSelectScene: (sceneId: string) => void;
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
        <IconButton
          className="timeline-resize-handle"
          variant="ghost"
          size="md"
          label="Resize timeline"
          icon={<StudioIcon icon={StudioIcons.chevronsUpDown} size={16} />}
          onPointerDown={(event) => {
            event.preventDefault();
            onResizeStart(event.clientY);
          }}
        />
        <div className="timeline-title-copy">
          <strong>Timeline</strong>
          <small>{displayedCount} track{displayedCount === 1 ? '' : 's'} · {selectedCount} selected</small>
        </div>
      </div>
      <div className="timeline-controls">
        <div className="timeline-scene-switcher" role="group" aria-label="Scene navigation">
          <IconButton
            variant="ghost"
            size="sm"
            className="timeline-scene-switcher__nav"
            onClick={onPreviousScene}
            label="Previous scene"
            icon={<StudioIcon icon={StudioIcons.arrowLeft} size={14} />}
          />
          <label className="timeline-scene-switcher__select">
            <span className="timeline-scene-switcher__label">Scene</span>
            <select value={activeSceneId} onChange={(event) => onSelectScene(event.target.value)} aria-label="Active scene">
              {scenes.map((scene, index) => (
                <option key={scene.id} value={scene.id}>
                  {index + 1}. {scene.name}
                </option>
              ))}
            </select>
          </label>
          <IconButton
            variant="ghost"
            size="sm"
            className="timeline-scene-switcher__nav"
            onClick={onNextScene}
            label="Next scene"
            icon={<StudioIcon icon={StudioIcons.arrowRight} size={14} />}
          />
        </div>

        <div className="timeline-ctrl-divider" aria-hidden="true" />

        <div className="timeline-ctrl-group">
          <IconButton
            variant="ghost"
            size="md"
            label="Go to start"
            icon={<StudioIcon icon={StudioIcons.skipBack} size={16} />}
            onClick={onResetPlayhead}
          />
          <Button
            variant="ghost"
            size="sm"
            className={`timeline-play-toggle${isPlaying ? ' is-active' : ''}`}
            iconBefore={<StudioIcon icon={isPlaying ? StudioIcons.pause : StudioIcons.play} size={16} />}
            onClick={onTogglePlay}
          >
            {isPlaying ? 'Pause' : 'Play'}
          </Button>
          <div className={`timeline-live-pill${isPlaying ? ' is-live' : ''}`} aria-live="polite">
            {isPlaying ? 'Live' : 'Idle'}
          </div>
        </div>

        <div className="timeline-ctrl-divider" aria-hidden="true" />

        <div className="timeline-ctrl-group">
          <Button
            variant="ghost"
            size="sm"
            className={snapEnabled ? 'is-active' : ''}
            onClick={onToggleSnap}
            tooltip={snapEnabled ? `Snap enabled — step ${snapStepMs}ms` : 'Snap disabled'}
          >
            {snapEnabled ? `Snap · ${snapStepMs}ms` : 'Snap off'}
          </Button>
        </div>

        <div className="timeline-ctrl-divider" aria-hidden="true" />

        <div className="timeline-ctrl-group">
          <Button
            variant="ghost"
            size="sm"
            className={selectedOnly ? 'is-active' : ''}
            onClick={onToggleSelectedOnly}
            tooltip={selectedOnly ? 'Showing selected layers only — click to show all' : 'Click to show selected layers only'}
          >
            {selectedOnly ? 'Selection' : 'All'}
          </Button>
        </div>

        <div className="timeline-ctrl-divider" aria-hidden="true" />

        <div className="timeline-ctrl-group">
          <IconButton
            variant="ghost"
            size="md"
            label="Zoom out"
            icon={<StudioIcon icon={StudioIcons.minus} size={16} />}
            onClick={onZoomOut}
          />
          <span className="pill timeline-zoom-pill" aria-label={`Zoom ${timelineZoom.toFixed(2)}x`}>
            {Math.round(timelineZoom * 100)}%
          </span>
          <IconButton
            variant="ghost"
            size="md"
            label="Zoom in"
            icon={<StudioIcon icon={StudioIcons.plus} size={16} />}
            onClick={onZoomIn}
          />
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
              aria-description="Press Enter to confirm the new banner duration."
            />
          ) : (
            <Tooltip content="Click to change banner duration">
              <Button
                variant="ghost"
                size="sm"
                className="timeline-duration-btn"
                onClick={startEditDuration}
                aria-label={`Banner duration: ${formatTime(sceneDurationMs)} — click to edit`}
              >
                {formatTime(sceneDurationMs)}
              </Button>
            </Tooltip>
          )}
          {snapLabel ? (
            <Tooltip content="Snap target">
              <span className="pill timeline-snap-pill" tabIndex={0}>
              <StudioIcon icon={StudioIcons.workflow} size={14} />
              {' '}
              {snapLabel}
              </span>
            </Tooltip>
          ) : null}
        </div>

        <IconButton
          className="panel-collapse-button"
          variant="ghost"
          size="md"
          label="Hide timeline"
          icon={<StudioIcon icon={StudioIcons.chevronDown} size={18} />}
          onClick={onToggleCollapse}
        />
      </div>
    </div>
  );
}
