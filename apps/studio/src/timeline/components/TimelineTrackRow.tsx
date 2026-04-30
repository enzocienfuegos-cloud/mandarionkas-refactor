import { getWidgetDefinition } from '../../widgets/registry/widget-registry';
import { TimelineRowNameEditor } from './TimelineRowNameEditor';
import { formatTime } from '../timeline-utils';
import type { TimelineDragState, TimelineDisplayRow } from '../types';

function IconEye(): JSX.Element {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true">
      <path
        d="M1 6.5C1 6.5 2.9 3 6.5 3C10.1 3 12 6.5 12 6.5C12 6.5 10.1 10 6.5 10C2.9 10 1 6.5 1 6.5Z"
        stroke="currentColor"
        strokeWidth="1.15"
        strokeLinejoin="round"
      />
      <circle cx="6.5" cy="6.5" r="1.6" fill="currentColor" />
    </svg>
  );
}

function IconEyeOff(): JSX.Element {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true">
      <path
        d="M1 6.5C1 6.5 2.9 3 6.5 3C10.1 3 12 6.5 12 6.5"
        stroke="currentColor"
        strokeWidth="1.15"
        strokeLinecap="round"
      />
      <path d="M2 11L11 2" stroke="currentColor" strokeWidth="1.15" strokeLinecap="round" />
    </svg>
  );
}

function IconLock(): JSX.Element {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true">
      <rect x="2.5" y="5.5" width="8" height="5.5" rx="1.2" stroke="currentColor" strokeWidth="1.15" />
      <path
        d="M4.2 5.5V4.2C4.2 2.7 8.8 2.7 8.8 4.2V5.5"
        stroke="currentColor"
        strokeWidth="1.15"
        strokeLinecap="round"
      />
      <circle cx="6.5" cy="8.2" r="0.9" fill="currentColor" />
    </svg>
  );
}

function IconUnlock(): JSX.Element {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true">
      <rect x="2.5" y="5.5" width="8" height="5.5" rx="1.2" stroke="currentColor" strokeWidth="1.15" />
      <path
        d="M4.2 5.5V4.2C4.2 2.7 8.8 2.7 8.8 4.2"
        stroke="currentColor"
        strokeWidth="1.15"
        strokeLinecap="round"
        opacity="0.38"
      />
      <circle cx="6.5" cy="8.2" r="0.9" fill="currentColor" />
    </svg>
  );
}

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
  const metaIndent = 8 + depth * 16;

  return (
    <div
      className={[
        'timeline-row',
        selected ? 'is-selected' : '',
        isActive ? 'is-active' : '',
        keyframes.length ? 'has-keyframes' : '',
        widget.hidden ? 'is-hidden' : '',
        widget.locked ? 'is-locked' : '',
        depth ? 'is-nested' : '',
        isGroup ? 'is-group-row' : '',
      ].filter(Boolean).join(' ')}
      onClick={(event) => onSelect(event.shiftKey || event.metaKey || event.ctrlKey)}
    >
      <div className="timeline-row-meta" style={{ paddingLeft: metaIndent }}>
        <div className="timeline-row-meta-top">
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
          ) : (
            <span className="timeline-disclosure-spacer" />
          )}

          <button
            type="button"
            className={`timeline-layer-toggle${widget.hidden ? ' is-off' : ''}`}
            title={widget.hidden ? 'Show layer' : 'Hide layer'}
            aria-label={widget.hidden ? 'Show layer' : 'Hide layer'}
            aria-pressed={!widget.hidden}
            onClick={(event) => {
              event.stopPropagation();
              onToggleHidden();
            }}
          >
            {widget.hidden ? <IconEyeOff /> : <IconEye />}
          </button>

          <button
            type="button"
            className={`timeline-layer-toggle${widget.locked ? ' is-off' : ''}`}
            title={widget.locked ? 'Unlock layer' : 'Lock layer'}
            aria-label={widget.locked ? 'Unlock layer' : 'Lock layer'}
            aria-pressed={widget.locked}
            onClick={(event) => {
              event.stopPropagation();
              onToggleLocked();
            }}
          >
            {widget.locked ? <IconLock /> : <IconUnlock />}
          </button>

          <div className="timeline-row-name-editor-shell">
            <TimelineRowNameEditor widgetId={widget.id} value={widget.name} onCommit={onRename} />
          </div>
        </div>

        <div className="timeline-row-meta-bottom">
          <small className="muted timeline-row-type-label">
            {definition.label}
            {isGroup && childCount > 0 ? ` · ${childCount}` : null}
            {depth ? ` · L${depth + 1}` : null}
          </small>

          <div className="timeline-row-order-actions" onClick={(event) => event.stopPropagation()}>
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
              onDragStart({
                mode: 'move-keyframe',
                widgetId: widget.id,
                keyframeId: keyframe.id,
                originX: event.clientX,
                startAtMs: keyframe.atMs,
                draftAtMs: keyframe.atMs,
              });
            }}
          />
        ))}
        <div
          className={[
            'timeline-bar',
            isActive ? 'is-active' : '',
            widget.hidden ? 'is-muted' : '',
            widget.locked ? 'is-locked' : '',
            isGroup ? 'is-group-bar' : '',
          ].filter(Boolean).join(' ')}
          style={{ left: barLeft, width: barWidth }}
          onPointerDown={(event) => {
            if (widget.locked) return;
            event.stopPropagation();
            onDragStart({
              mode: 'move-bar',
              widgetId: widget.id,
              originX: event.clientX,
              startStartMs: timing.startMs,
              startEndMs: timing.endMs,
              draftStartMs: timing.startMs,
              draftEndMs: timing.endMs,
            });
          }}
        >
          <button
            className="timeline-trim timeline-trim-start"
            onPointerDown={(event) => {
              if (widget.locked) return;
              event.stopPropagation();
              onDragStart({
                mode: 'trim-start',
                widgetId: widget.id,
                originX: event.clientX,
                startStartMs: timing.startMs,
                startEndMs: timing.endMs,
                draftStartMs: timing.startMs,
                draftEndMs: timing.endMs,
              });
            }}
          />
          <span>{widget.name} · {formatTime(timing.startMs)} → {formatTime(timing.endMs)}</span>
          <button
            className="timeline-trim timeline-trim-end"
            onPointerDown={(event) => {
              if (widget.locked) return;
              event.stopPropagation();
              onDragStart({
                mode: 'trim-end',
                widgetId: widget.id,
                originX: event.clientX,
                startStartMs: timing.startMs,
                startEndMs: timing.endMs,
                draftStartMs: timing.startMs,
                draftEndMs: timing.endMs,
              });
            }}
          />
        </div>
        {isGroup && isCollapsed && childCount > 0 ? (
          <div className="timeline-group-collapsed-badge" style={{ left: barLeft + Math.min(barWidth + 10, 140) }}>
            +{childCount}
          </div>
        ) : null}
      </div>
    </div>
  );
}
