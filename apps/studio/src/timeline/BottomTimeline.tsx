import type { CSSProperties } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useStudioStore } from '../core/store/use-studio-store';
import { useSceneActions, useTimelineActions, useUiActions, useWidgetActions } from '../hooks/use-studio-actions';
import { buildTimelineSnapTargets, getTimelineGridStepMs, snapTimelineMs } from '../shared/timeline-snapping';
import { selectResolvedWidgetsById } from '../core/store/selectors/resolved-widgets';
import { TimelineHeader } from './components/TimelineHeader';
import { TimelineOverview } from './components/TimelineOverview';
import { TimelineRuler } from './components/TimelineRuler';
import { TimelineTrackList } from './components/TimelineTrackList';
import { BASE_ROW_MS_TO_PX, MIN_WIDGET_DURATION_MS, ROW_GUTTER, buildRulerTicks, buildTimelineDisplayRows, clamp, getDisplayKeyframes, getDisplayTiming, getDynamicRulerStepMs } from './timeline-utils';
import type { TimelineDragState, TimelineWidget } from './types';
import { usePlaybackMsThrottled } from '../hooks/use-playback-engine';
import { useTimelinePlayhead } from './use-timeline-playhead';
import { useTimelineZoom } from './use-timeline-zoom';

export function BottomTimeline({ onResizeStart, onToggleCollapse }: { onResizeStart: (startY: number) => void; onToggleCollapse: () => void; }): JSX.Element {
  const [drag, setDrag] = useState<TimelineDragState>(null);
  const [selectedOnly, setSelectedOnly] = useState(false);
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [collapsedGroupIds, setCollapsedGroupIds] = useState<string[]>([]);
  const timelineScrollRef = useRef<HTMLDivElement>(null);
  const timelineGridRef = useRef<HTMLDivElement>(null);
  const timelineOverviewRef = useRef<HTMLDivElement>(null);
  const timelineActions = useTimelineActions();
  const widgetActions = useWidgetActions();
  const uiActions = useUiActions();
  const sceneActions = useSceneActions();
  const { timelineZoom, zoomIn, zoomOut, onWheel } = useTimelineZoom(1);
  const { scene, scenes, activeSceneId, widgets, selectedIds, playheadMs: storePlayheadMs, isPlaying } = useStudioStore((state) => {
    const widgetsById = selectResolvedWidgetsById(state);
    const scene = state.document.scenes.find((item) => item.id === state.document.selection.activeSceneId)
      ?? state.document.scenes[0];
    const resolvedWidgets = scene.widgetIds.map((id) => widgetsById[id]).filter(Boolean) as TimelineWidget[];
    return {
      scene,
      scenes: state.document.scenes,
      activeSceneId: state.document.selection.activeSceneId,
      widgets: resolvedWidgets,
      selectedIds: state.document.selection.widgetIds,
      playheadMs: state.ui.playheadMs,
      isPlaying: state.ui.isPlaying,
    };
  });
  const playheadMs = usePlaybackMsThrottled(storePlayheadMs);


  const rowMsToPx = BASE_ROW_MS_TO_PX * timelineZoom;
  const snapStepMs = snapEnabled ? getTimelineGridStepMs(timelineZoom) : 0;
  const snapThresholdMs = snapEnabled ? Math.min(150, Math.max(60, snapStepMs * 0.35)) : 0;
  useTimelinePlayhead(timelineGridRef, timelineOverviewRef, playheadMs, rowMsToPx, scene.durationMs, isPlaying);

  useEffect(() => {
    if (!drag) return;
    const previousUserSelect = document.body.style.userSelect;
    const previousCursor = document.body.style.cursor;
    document.body.style.userSelect = 'none';
    document.body.style.cursor = drag.mode === 'playhead' ? 'ew-resize' : 'grabbing';

    const snapTargets = snapEnabled
      ? buildTimelineSnapTargets(widgets, {
          excludeWidgetId: drag.mode === 'playhead' ? undefined : drag.widgetId,
          playheadMs,
        })
      : [];

    const onMove = (event: PointerEvent) => {
      if (event.buttons === 0) return;
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
    window.addEventListener('pointercancel', onUp, { once: true });
    return () => {
      document.body.style.userSelect = previousUserSelect;
      document.body.style.cursor = previousCursor;
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
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
  const snapGuideMs = drag && drag.mode !== 'playhead' ? drag.snapTargetMs : undefined;
  const snapLabel = drag && drag.mode !== 'playhead' ? drag.snapLabel : undefined;
  const rulerStepMs = getDynamicRulerStepMs(rowMsToPx);
  const majorTickMs = Math.max(1000, rulerStepMs * 4);
  const rulerTicks = buildRulerTicks(scene.durationMs, rulerStepMs, majorTickMs);
  const gridShellStyle = { '--timeline-grid-shell-width': `${ROW_GUTTER + trackWidth + 32}px` } as CSSProperties;

  return (
    <section className={`bottom-timeline ${isPlaying ? 'is-playing' : ''}`}>
      <TimelineHeader
        displayedCount={displayedWidgets.length}
        selectedCount={selectedIds.length}
        activeSceneId={activeSceneId}
        scenes={scenes.map((item) => ({ id: item.id, name: item.name }))}
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
        onPreviousScene={() => sceneActions.previousScene()}
        onNextScene={() => sceneActions.nextScene()}
        onSelectScene={(sceneId) => sceneActions.selectScene(sceneId)}
        onToggleSnap={() => setSnapEnabled((value) => !value)}
        onToggleSelectedOnly={() => setSelectedOnly((value) => !value)}
        onZoomOut={zoomOut}
        onZoomIn={zoomIn}
        onChangeDuration={(ms) => sceneActions.updateScene(scene.id, { durationMs: ms })}
      />

      <TimelineOverview
        overviewRef={timelineOverviewRef}
        displayedWidgets={displayedWidgets}
        selectedIds={selectedIds}
        sceneDurationMs={scene.durationMs}
        onSeek={(ms) => timelineActions.setPlayhead(ms)}
      />

      <div ref={timelineScrollRef} className="timeline-scroll" onWheel={onWheel}>
        <div ref={timelineGridRef} className="timeline-grid-shell" style={gridShellStyle}>
          <TimelineRuler
            rulerTicks={rulerTicks}
            rowMsToPx={rowMsToPx}
            trackWidth={trackWidth}
            snapGuideMs={snapGuideMs}
            onPointerDown={(clientX, startMs) => {
              timelineActions.setPlayhead(startMs);
              setDrag({ mode: 'playhead', originX: clientX, startMs });
            }}
          />
          <TimelineTrackList
            scrollContainerRef={timelineScrollRef}
            displayedWidgets={displayedWidgets}
            selectedIds={selectedIds}
            playheadMs={playheadMs}
            rowMsToPx={rowMsToPx}
            trackWidth={trackWidth}
            snapGuideMs={snapGuideMs}
            collapsedGroupIds={collapsedGroupIds}
            selectedOnly={selectedOnly}
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
