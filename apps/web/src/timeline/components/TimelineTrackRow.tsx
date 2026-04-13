import { getWidgetDefinition } from '../../widgets/registry/widget-registry';
import { TimelineRowNameEditor } from './TimelineRowNameEditor';
import { formatTime } from '../timeline-utils';
import type { TimelineDragState, TimelineDisplayRow } from '../types';

export function TimelineTrackRow({
  row,
  selected,
  isActive,
  playheadMs,
  playheadLeft,
  rowMsToPx,
  trackWidth,
  snapGuideMs,
  onSelect,
  onToggleHidden,
  onToggleLocked,
  onRename,
  onReorder,
  onToggleCollapse,
  onDragStart,
}: {
  row: TimelineDisplayRow;
  selected: boolean;
  isActive: boolean;
  playheadMs: number;
  playheadLeft: number;
  rowMsToPx: number;
  trackWidth: number;
  snapGuideMs?: number;
  onSelect: (additive: boolean) => void;
  onToggleHidden: () => void;
  onToggleLocked: () => void;
  onRename: (widgetId: string, nextName: string) => void;
  onReorder: (direction: 'forward' | 'backward') => void;
  onToggleCollapse?: () => void;
  onDragStart: (drag: Exclude<TimelineDragState, null>) => void;
}): JSX.Element {
  const { widget, timing, keyframes, depth, isGroup, childCount, isCollapsed } = row;
  const definition = getWidgetDefinition(widget.type);
  const barLeft = timing.startMs * rowMsToPx;
  const barWidth = Math.max(16, (timing.endMs - timing.startMs) * rowMsToPx);
  const metaIndent = 12 + depth * 18;

  return (
    <div
      className={`timeline-row ${selected ? 'is-selected' : ''} ${isActive ? 'is-active' : ''} ${keyframes.length ? 'has-keyframes' : ''} ${widget.hidden ? 'is-hidden' : ''} ${widget.locked ? 'is-locked' : ''} ${depth ? 'is-nested' : ''} ${isGroup ? 'is-group-row' : ''}`}
      onClick={(event) => onSelect(event.shiftKey || event.metaKey || event.ctrlKey)}
    >
      <div className="timeline-row-meta" style={{ paddingLeft: metaIndent }}>
        <div className="timeline-row-meta-top">
          <div className="timeline-row-hierarchy-controls">
            {isGroup ? (
              <button
                type="button"
                className="timeline-disclosure-button"
                title={isCollapsed ? 'Expand group' : 'Collapse group'}
                aria-label={isCollapsed ? 'Expand group' : 'Collapse group'}
                onClick={(event) => {
                  event.stopPropagation();
                  onToggleCollapse?.();
                }}
              >
                {isCollapsed ? '▸' : '▾'}
              </button>
            ) : <span className="timeline-disclosure-spacer" />}
            <div className="timeline-row-layer-controls">
              <button
                type="button"
                className={`timeline-layer-toggle ${widget.hidden ? 'is-off' : ''}`}
                title={widget.hidden ? 'Show layer' : 'Hide layer'}
                aria-label={widget.hidden ? 'Show layer' : 'Hide layer'}
                onClick={(event) => {
                  event.stopPropagation();
                  onToggleHidden();
                }}
              >
                {widget.hidden ? '🙈' : '👁'}
              </button>
              <button
                type="button"
                className={`timeline-layer-toggle ${widget.locked ? 'is-off' : ''}`}
                title={widget.locked ? 'Unlock layer' : 'Lock layer'}
                aria-label={widget.locked ? 'Unlock layer' : 'Lock layer'}
                onClick={(event) => {
                  event.stopPropagation();
                  onToggleLocked();
                }}
              >
                {widget.locked ? '🔒' : '🔓'}
              </button>
            </div>
          </div>
          <TimelineRowNameEditor widgetId={widget.id} value={widget.name} onCommit={onRename} />
        </div>
        <div className="timeline-row-meta-bottom">
          <small className="muted">
            <span>{definition.label}</span>
            <span>Layer {widget.zIndex + 1}</span>
            {isGroup ? <span>{childCount} child{childCount === 1 ? '' : 'ren'}</span> : null}
            {depth ? <span>Level {depth + 1}</span> : null}
          </small>
          <div className="timeline-row-order-actions">
            <button
              type="button"
              className="timeline-order-button"
              title="Bring forward"
              aria-label="Bring forward"
              onClick={(event) => {
                event.stopPropagation();
                onReorder('forward');
              }}
            >
              ↑
            </button>
            <button
              type="button"
              className="timeline-order-button"
              title="Send backward"
              aria-label="Send backward"
              onClick={(event) => {
                event.stopPropagation();
                onReorder('backward');
              }}
            >
              ↓
            </button>
          </div>
        </div>
      </div>
      <div className="timeline-track" style={{ width: trackWidth }}>
        <div className="timeline-row-playhead" style={{ left: playheadLeft }} />
        {snapGuideMs !== undefined ? <div className="timeline-snap-guide" style={{ left: snapGuideMs * rowMsToPx }} /> : null}
        {keyframes.map((keyframe) => (
          <button
            key={keyframe.id}
            type="button"
            className="timeline-keyframe-dot"
            title={`${keyframe.property} · ${keyframe.atMs}ms · ${keyframe.easing ?? 'linear'}`}
            style={{ left: keyframe.atMs * rowMsToPx }}
            onPointerDown={(event) => {
              event.stopPropagation();
              onSelect(false);
              if (widget.locked) return;
              onDragStart({ mode: 'move-keyframe', widgetId: widget.id, keyframeId: keyframe.id, originX: event.clientX, startAtMs: keyframe.atMs, draftAtMs: keyframe.atMs });
            }}
          />
        ))}
        <div
          className={`timeline-bar ${isActive ? 'is-active' : ''} ${widget.hidden ? 'is-muted' : ''} ${widget.locked ? 'is-locked' : ''} ${isGroup ? 'is-group-bar' : ''}`}
          style={{ left: barLeft, width: barWidth }}
          onPointerDown={(event) => {
            if (widget.locked) return;
            event.stopPropagation();
            onDragStart({ mode: 'move-bar', widgetId: widget.id, originX: event.clientX, startStartMs: timing.startMs, startEndMs: timing.endMs, draftStartMs: timing.startMs, draftEndMs: timing.endMs });
          }}
        >
          <button
            className="timeline-trim timeline-trim-start"
            onPointerDown={(event) => {
              if (widget.locked) return;
              event.stopPropagation();
              onDragStart({ mode: 'trim-start', widgetId: widget.id, originX: event.clientX, startStartMs: timing.startMs, startEndMs: timing.endMs, draftStartMs: timing.startMs, draftEndMs: timing.endMs });
            }}
          />
          <span>{widget.name} · {formatTime(timing.startMs)} → {formatTime(timing.endMs)}</span>
          <button
            className="timeline-trim timeline-trim-end"
            onPointerDown={(event) => {
              if (widget.locked) return;
              event.stopPropagation();
              onDragStart({ mode: 'trim-end', widgetId: widget.id, originX: event.clientX, startStartMs: timing.startMs, startEndMs: timing.endMs, draftStartMs: timing.startMs, draftEndMs: timing.endMs });
            }}
          />
        </div>
        {isGroup && isCollapsed && childCount > 0 ? <div className="timeline-group-collapsed-badge" style={{ left: barLeft + Math.min(barWidth + 10, 140) }}>+{childCount}</div> : null}
      </div>
    </div>
  );
}
