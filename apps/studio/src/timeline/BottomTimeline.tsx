import { useEffect, useMemo, useState } from 'react';
import { useStudioStore } from '../core/store/use-studio-store';
import { useSceneActions, useTimelineActions, useUiActions, useWidgetActions } from '../hooks/use-studio-actions';
import { buildTimelineSnapTargets, getTimelineGridStepMs, snapTimelineMs } from '../shared/timeline-snapping';
import { TimelineHeader } from './components/TimelineHeader';
import { TimelineOverview } from './components/TimelineOverview';
import { TimelineRuler } from './components/TimelineRuler';
import { TimelineTrackList } from './components/TimelineTrackList';
import { BASE_ROW_MS_TO_PX, MIN_WIDGET_DURATION_MS, ROW_GUTTER, buildRulerTicks, buildTimelineDisplayRows, clamp, getDisplayKeyframes, getDisplayTiming } from './timeline-utils';
import type { TimelineDragState, TimelineWidget } from './types';

export function BottomTimeline({ onResizeStart, onToggleCollapse }: { onResizeStart: (startY: number) => void; onToggleCollapse: () => void; }): JSX.Element {
  const [drag, setDrag] = useState<TimelineDragState>(null);
  const [timelineZoom, setTimelineZoom] = useState(1);
  const [selectedOnly, setSelectedOnly] = useState(false);
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [collapsedGroupIds, setCollapsedGroupIds] = useState<string[]>([]);
  const timelineActions = useTimelineActions();
  const widgetActions = useWidgetActions();
  const uiActions = useUiActions();
  const { updateScene } = useSceneActions();
  const { scene, widgets, selectedIds, playheadMs, isPlaying } = useStudioStore((state) => {
    const scene = state.document.scenes.find((item) => item.id === state.document.selection.activeSceneId)
      ?? state.document.scenes[0];
    const resolvedWidgets = scene.widgetIds.map((id) => state.document.widgets[id]).filter(Boolean) as TimelineWidget[];
    return {
      scene,
      widgets: resolvedWidgets,
      selectedIds: state.document.selection.widgetIds,
      playheadMs: state.ui.playheadMs,
      isPlaying: state.ui.isPlaying,
    };
  });


  const rowMsToPx = BASE_ROW_MS_TO_PX * timelineZoom;
  const snapStepMs = snapEnabled ? getTimelineGridStepMs(timelineZoom) : 0;
  const snapThresholdMs = snapEnabled ? Math.min(150, Math.max(60, snapStepMs * 0.35)) : 0;

  useEffect(() => {
    if (!drag) return;

    const snapTargets = snapEnabled
      ? buildTimelineSnapTargets(widgets, {
          excludeWidgetId: drag.mode === 'playhead' ? undefined : drag.widgetId,
          playheadMs,
        })
      : [];

    const onMove = (event: PointerEvent) => {
      const deltaMs = Math.round((event.clientX - drag.originX) / rowMsToPx);

      if (drag.mode === 'playhead') {
        timelineActions.setPlayhead(drag.startMs + deltaMs);
        return;
      }

      if (drag.mode === 'move-keyframe') {
        const rawAtMs = clamp(drag.startAtMs + deltaMs, 0, scene.durationMs);
        const snapped = snapTimelineMs(rawAtMs, {
          minMs: 0,
          maxMs: scene.durationMs,
          stepMs: snapStepMs,
          thresholdMs: snapThresholdMs,
          targets: snapTargets.filter((target) => !(target.kind === 'keyframe' && target.keyframeId === drag.keyframeId)),
        });
        setDrag((current) => current && current.mode === 'move-keyframe'
          ? {
              ...current,
              draftAtMs: snapped.valueMs,
              snapTargetMs: snapped.target?.ms,
              snapLabel: snapped.target?.label,
            }
          : current);
        return;
      }

      const duration = drag.startEndMs - drag.startStartMs;
      if (drag.mode === 'move-bar') {
        const rawStartMs = clamp(drag.startStartMs + deltaMs, 0, scene.durationMs - duration);
        const rawEndMs = rawStartMs + duration;
        const startSnap = snapTimelineMs(rawStartMs, {
          minMs: 0,
          maxMs: scene.durationMs - duration,
          stepMs: snapStepMs,
          thresholdMs: snapThresholdMs,
          targets: snapTargets,
        });
        const endSnap = snapTimelineMs(rawEndMs, {
          minMs: duration,
          maxMs: scene.durationMs,
          stepMs: snapStepMs,
          thresholdMs: snapThresholdMs,
          targets: snapTargets,
        });
        const useEndSnap = !!endSnap.target && (!startSnap.target || Math.abs(endSnap.valueMs - rawEndMs) < Math.abs(startSnap.valueMs - rawStartMs));
        const nextStartMs = useEndSnap ? clamp(endSnap.valueMs - duration, 0, scene.durationMs - duration) : startSnap.valueMs;
        const snapTarget = useEndSnap ? endSnap.target : startSnap.target;
        setDrag((current) => current && current.mode === 'move-bar'
          ? {
              ...current,
              draftStartMs: nextStartMs,
              draftEndMs: nextStartMs + duration,
              snapTargetMs: snapTarget?.ms,
              snapLabel: snapTarget?.label,
            }
          : current);
        return;
      }

      if (drag.mode === 'trim-start') {
        const rawStartMs = clamp(drag.startStartMs + deltaMs, 0, drag.startEndMs - MIN_WIDGET_DURATION_MS);
        const snapped = snapTimelineMs(rawStartMs, {
          minMs: 0,
          maxMs: drag.startEndMs - MIN_WIDGET_DURATION_MS,
          stepMs: snapStepMs,
          thresholdMs: snapThresholdMs,
          targets: snapTargets,
        });
        setDrag((current) => current && current.mode === 'trim-start'
          ? {
              ...current,
              draftStartMs: snapped.valueMs,
              draftEndMs: drag.startEndMs,
              snapTargetMs: snapped.target?.ms,
              snapLabel: snapped.target?.label,
            }
          : current);
        return;
      }

      if (drag.mode === 'trim-end') {
        const rawEndMs = clamp(drag.startEndMs + deltaMs, drag.startStartMs + MIN_WIDGET_DURATION_MS, scene.durationMs);
        const snapped = snapTimelineMs(rawEndMs, {
          minMs: drag.startStartMs + MIN_WIDGET_DURATION_MS,
          maxMs: scene.durationMs,
          stepMs: snapStepMs,
          thresholdMs: snapThresholdMs,
          targets: snapTargets,
        });
        setDrag((current) => current && current.mode === 'trim-end'
          ? {
              ...current,
              draftStartMs: drag.startStartMs,
              draftEndMs: snapped.valueMs,
              snapTargetMs: snapped.target?.ms,
              snapLabel: snapped.target?.label,
            }
          : current);
      }
    };

    const onUp = () => {
      setDrag((current) => {
        if (!current) return null;
        if (current.mode === 'move-bar' || current.mode === 'trim-start' || current.mode === 'trim-end') {
          widgetActions.updateWidgetTiming(current.widgetId, { startMs: current.draftStartMs, endMs: current.draftEndMs });
        }
        if (current.mode === 'move-keyframe') {
          timelineActions.updateKeyframe(current.widgetId, current.keyframeId, { atMs: current.draftAtMs });
          timelineActions.setPlayhead(current.draftAtMs);
        }
        return null;
      });
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp, { once: true });
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [drag, playheadMs, rowMsToPx, scene.durationMs, snapEnabled, snapStepMs, snapThresholdMs, timelineActions, widgetActions, widgets]);

  const displayedWidgets = useMemo(() => {
    const collapsedSet = new Set(collapsedGroupIds);
    return buildTimelineDisplayRows(widgets, selectedIds, collapsedSet, selectedOnly).map((row) => ({
      ...row,
      timing: getDisplayTiming(row.widget, drag),
      keyframes: getDisplayKeyframes(row.widget, drag),
    }));
  }, [collapsedGroupIds, drag, selectedIds, selectedOnly, widgets]);

  const trackWidth = Math.max(scene.durationMs * rowMsToPx, 420);
  const playheadLeft = playheadMs * rowMsToPx;
  const snapGuideMs = drag && drag.mode !== 'playhead' ? drag.snapTargetMs : undefined;
  const snapLabel = drag && drag.mode !== 'playhead' ? drag.snapLabel : undefined;
  const rulerStepMs = getTimelineGridStepMs(Math.max(0.5, timelineZoom));
  const majorTickMs = Math.max(1000, rulerStepMs * 4);
  const rulerTicks = buildRulerTicks(scene.durationMs, rulerStepMs, majorTickMs);

  return (
    <section className={`bottom-timeline ${isPlaying ? 'is-playing' : ''}`}>
      <TimelineHeader
        displayedCount={displayedWidgets.length}
        selectedCount={selectedIds.length}
        isPlaying={isPlaying}
        playheadMs={playheadMs}
        sceneDurationMs={scene.durationMs}
        snapEnabled={snapEnabled}
        snapStepMs={snapStepMs}
        selectedOnly={selectedOnly}
        timelineZoom={timelineZoom}
        snapLabel={snapLabel}
        onResizeStart={onResizeStart}
        onToggleCollapse={onToggleCollapse}
        onTogglePlay={() => {
          uiActions.setPreviewMode(true);
          timelineActions.setPlaying(!isPlaying);
        }}
        onResetPlayhead={() => timelineActions.setPlayhead(0)}
        onToggleSnap={() => setSnapEnabled((value) => !value)}
        onToggleSelectedOnly={() => setSelectedOnly((value) => !value)}
        onZoomOut={() => setTimelineZoom((value) => Math.max(0.5, Number((value - 0.25).toFixed(2))))}
        onZoomIn={() => setTimelineZoom((value) => Math.min(3, Number((value + 0.25).toFixed(2))))}
        onChangeDuration={(ms) => updateScene(scene.id, { durationMs: ms })}
      />

      <TimelineOverview
        displayedWidgets={displayedWidgets}
        selectedIds={selectedIds}
        playheadMs={playheadMs}
        sceneDurationMs={scene.durationMs}
        onSeek={(ms) => timelineActions.setPlayhead(ms)}
      />

      <div className="timeline-scroll">
        <div className="timeline-grid-shell" style={{ width: ROW_GUTTER + trackWidth + 32 }}>
          <TimelineRuler
            rulerTicks={rulerTicks}
            rowMsToPx={rowMsToPx}
            trackWidth={trackWidth}
            playheadLeft={playheadLeft}
            playheadMs={playheadMs}
            snapGuideMs={snapGuideMs}
            onPointerDown={(clientX, startMs) => setDrag({ mode: 'playhead', originX: clientX, startMs })}
          />
          <TimelineTrackList
            displayedWidgets={displayedWidgets}
            selectedIds={selectedIds}
            playheadMs={playheadMs}
            playheadLeft={playheadLeft}
            rowMsToPx={rowMsToPx}
            trackWidth={trackWidth}
            snapGuideMs={snapGuideMs}
            collapsedGroupIds={collapsedGroupIds}
            onSelectWidget={(widgetId, additive) => widgetActions.selectWidget(widgetId, additive)}
            onToggleWidgetHidden={(widgetId) => widgetActions.toggleWidgetHidden(widgetId)}
            onToggleWidgetLocked={(widgetId) => widgetActions.toggleWidgetLocked(widgetId)}
            onUpdateWidgetName={widgetActions.updateWidgetName}
            onReorderWidget={(widgetId, direction) => widgetActions.reorderWidget(widgetId, direction)}
            onToggleGroupCollapse={(widgetId) => setCollapsedGroupIds((current) => current.includes(widgetId) ? current.filter((id) => id !== widgetId) : [...current, widgetId])}
            onDragStart={(nextDrag) => setDrag(nextDrag)}
          />
        </div>
      </div>
    </section>
  );
}
