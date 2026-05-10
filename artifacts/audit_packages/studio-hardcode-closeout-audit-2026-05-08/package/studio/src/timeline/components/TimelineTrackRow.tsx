import type { CSSProperties } from 'react';
import { getWidgetDefinition } from '../../widgets/registry/widget-registry';
import { StudioIcon, StudioIcons } from '../../shared/ui/icons';
import { Tooltip } from '../../shared/ui/Tooltip';
import { TimelineRowNameEditor } from './TimelineRowNameEditor';
import { formatTime } from '../timeline-utils';
import type { TimelineDragState, TimelineDisplayRow } from '../types';

function buildTimelineKeyframeStyle(left: number): CSSProperties {
  return { '--timeline-keyframe-left': `${left}px` } as CSSProperties;
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
  const rowStyle = {
    '--timeline-meta-indent': `${metaIndent}px`,
    '--timeline-track-width': `${trackWidth}px`,
    '--timeline-playhead-left': `${playheadLeft}px`,
    '--timeline-snap-guide-left': snapGuideMs !== undefined ? `${snapGuideMs * rowMsToPx}px` : undefined,
    '--timeline-bar-left': `${barLeft}px`,
    '--timeline-bar-width': `${barWidth}px`,
    '--timeline-group-badge-left': `${barLeft + Math.min(barWidth + 10, 140)}px`,
  } as CSSProperties;

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
      style={rowStyle}
      onClick={(event) => onSelect(event.shiftKey || event.metaKey || event.ctrlKey)}
    >
      <div className="timeline-row-meta">
        <div className="timeline-row-meta-top">
          {isGroup ? (
            <Tooltip content={isCollapsed ? 'Expand group' : 'Collapse group'}>
              <button
                type="button"
                className="timeline-disclosure-button"
                aria-label={isCollapsed ? 'Expand group' : 'Collapse group'}
                onClick={(event) => {
                  event.stopPropagation();
                  onToggleCollapse?.();
                }}
              >
                <StudioIcon icon={isCollapsed ? StudioIcons.chevronRight : StudioIcons.chevronDown} size={14} />
              </button>
            </Tooltip>
          ) : (
            <span className="timeline-disclosure-spacer" />
          )}

          <Tooltip content={widget.hidden ? 'Show layer' : 'Hide layer'}>
            <button
              type="button"
              className={`timeline-layer-toggle${widget.hidden ? ' is-off' : ''}`}
              aria-label={widget.hidden ? 'Show layer' : 'Hide layer'}
              aria-pressed={!widget.hidden}
              onClick={(event) => {
                event.stopPropagation();
                onToggleHidden();
              }}
            >
              <StudioIcon icon={widget.hidden ? StudioIcons.eyeOff : StudioIcons.eye} size={13} strokeWidth={1.75} />
            </button>
          </Tooltip>

          <Tooltip content={widget.locked ? 'Unlock layer' : 'Lock layer'}>
            <button
              type="button"
              className={`timeline-layer-toggle${widget.locked ? ' is-off' : ''}`}
              aria-label={widget.locked ? 'Unlock layer' : 'Lock layer'}
              aria-pressed={widget.locked}
              onClick={(event) => {
                event.stopPropagation();
                onToggleLocked();
              }}
            >
              <StudioIcon icon={widget.locked ? StudioIcons.lock : StudioIcons.lockOpen} size={13} strokeWidth={1.75} />
            </button>
          </Tooltip>

          <div className="timeline-row-name-editor-shell">
            <TimelineRowNameEditor widgetId={widget.id} value={widget.name} onCommit={onRename} />
          </div>
        </div>

        <div className="timeline-row-meta-bottom">
          <small className="muted timeline-row-type-label">
            {definition.label}
            {widget.sharedLayerId ? (
              <>
                {' · '}
                <span className="timeline-shared-layer-label">
                  <StudioIcon icon={StudioIcons.layers} size={11} />
                  Shared
                </span>
              </>
            ) : null}
            {isGroup && childCount > 0 ? ` · ${childCount}` : null}
            {depth ? ` · L${depth + 1}` : null}
          </small>

          <div className="timeline-row-order-actions" onClick={(event) => event.stopPropagation()}>
            <Tooltip content="Bring forward">
              <button
                type="button"
                className="timeline-order-button"
                aria-label="Bring forward"
                onClick={(event) => {
                  event.stopPropagation();
                  onReorder('forward');
                }}
              >
                <StudioIcon icon={StudioIcons.arrowUp} size={12} />
              </button>
            </Tooltip>
            <Tooltip content="Send backward">
              <button
                type="button"
                className="timeline-order-button"
                aria-label="Send backward"
                onClick={(event) => {
                  event.stopPropagation();
                  onReorder('backward');
                }}
              >
                <StudioIcon icon={StudioIcons.arrowDown} size={12} />
              </button>
            </Tooltip>
          </div>
        </div>
      </div>

      <div className="timeline-track">
        <div className="timeline-row-playhead" />
        {snapGuideMs !== undefined ? <div className="timeline-snap-guide" /> : null}
        {keyframes.map((keyframe) => (
          <button
            key={keyframe.id}
            type="button"
            className="timeline-keyframe-dot"
            aria-label={`${keyframe.property} at ${keyframe.atMs} milliseconds with ${keyframe.easing ?? 'linear'} easing`}
            style={buildTimelineKeyframeStyle(keyframe.atMs * rowMsToPx)}
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
          <span>{widget.name} · {formatTime(timing.startMs)} to {formatTime(timing.endMs)}</span>
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
          <div className="timeline-group-collapsed-badge">
            +{childCount}
          </div>
        ) : null}
      </div>
    </div>
  );
}
