import type { CSSProperties } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { shallowEqual, useStudioStore } from '../core/store/use-studio-store';
import { useSceneActions, useTimelineActions, useUiActions, useWidgetActions } from '../hooks/use-studio-actions';
import { buildTimelineSnapTargets, getTimelineGridStepMs, snapTimelineMs } from '../shared/timeline-snapping';
import { selectResolvedWidgetsById } from '../core/store/selectors/resolved-widgets';
import { TimelineHeader } from './components/TimelineHeader';
import { TimelineOverview } from './components/TimelineOverview';
import { TimelineRuler } from './components/TimelineRuler';
import { TimelineTrackList } from './components/TimelineTrackList';
import { BASE_ROW_MS_TO_PX, MIN_WIDGET_DURATION_MS, ROW_GUTTER, buildRulerTicks, buildTimelineDisplayRows, clamp, getDynamicRulerStepMs } from './timeline-utils';
import type { TimelineDragState, TimelineWidget } from './types';
import { playbackEngine, usePlaybackMsThrottled } from '../hooks/use-playback-engine';
import { useTimelinePlayhead } from './use-timeline-playhead';
import { useTimelineZoom } from './use-timeline-zoom';
import { getCapability } from '../widgets/registry/widget-definition';
import { getWidgetDefinition } from '../widgets/registry/widget-registry';
import { KEYFRAME_PROPERTIES } from '../inspector/sections/widget-inspector-shared';

type StickySnapDrag = Exclude<Exclude<TimelineDragState, null>, { mode: 'playhead' }>;

function holdSnapTarget(
  rawValueMs: number,
  currentDrag: StickySnapDrag,
  minMs: number,
  maxMs: number,
  releaseThresholdMs: number,
) {
  if (currentDrag.snapTargetMs === undefined) return null;
  if (Math.abs(rawValueMs - currentDrag.snapTargetMs) > releaseThresholdMs) return null;
  return {
    valueMs: clamp(currentDrag.snapTargetMs, minMs, maxMs),
    snapped: true,
    target: {
      ms: currentDrag.snapTargetMs,
      kind: 'grid' as const,
      label: currentDrag.snapLabel ?? 'Snap point',
    },
  };
}

export function BottomTimeline({ onResizeStart, onToggleCollapse }: { onResizeStart: (startY: number) => void; onToggleCollapse: () => void; }): JSX.Element {
  const [drag, setDrag] = useState<TimelineDragState>(null);
  const [selectedOnly, setSelectedOnly] = useState(false);
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [collapsedGroupIds, setCollapsedGroupIds] = useState<string[]>([]);
  const dragRef = useRef<TimelineDragState>(null);
  const dragRafRef = useRef<number | null>(null);
  const timelineScrollRef = useRef<HTMLDivElement>(null);
  const timelineGridRef = useRef<HTMLDivElement>(null);
  const timelineOverviewRef = useRef<HTMLDivElement>(null);
  const timelineActions = useTimelineActions();
  const widgetActions = useWidgetActions();
  const uiActions = useUiActions();
  const sceneActions = useSceneActions();
  const { timelineZoom, zoomIn, zoomOut, onWheel } = useTimelineZoom(1);
  const { scene, scenes, activeSceneId, widgets, selectedIds } = useStudioStore((state) => {
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
    };
  }, shallowEqual);
  const isPlaying = useStudioStore((state) => state.ui.isPlaying);
  const storePlayheadMs = useStudioStore((state) => state.ui.playheadMs);
  const playheadMs = usePlaybackMsThrottled(storePlayheadMs);
  const playheadRef = useRef(playheadMs);
  const selectedWidgets = useMemo(() => selectedIds.map((widgetId) => widgets.find((widget) => widget.id === widgetId)).filter(Boolean) as TimelineWidget[], [selectedIds, widgets]);
  const groupableCount = useMemo(() => selectedWidgets.filter((widget) => !widget.parentId).length, [selectedWidgets]);
  const ungroupableCount = useMemo(() => selectedWidgets.filter((widget) => Boolean(widget.parentId) || Boolean(getCapability(getWidgetDefinition(widget.type), 'isContainer'))).length, [selectedWidgets]);


  const rowMsToPx = BASE_ROW_MS_TO_PX * timelineZoom;
  const snapStepMs = snapEnabled ? getTimelineGridStepMs(timelineZoom) : 0;
  const snapThresholdMs = snapEnabled ? Math.min(150, Math.max(60, snapStepMs * 0.35)) : 0;
  const trimSnapThresholdMs = snapEnabled ? Math.min(90, Math.max(28, snapStepMs * 0.18)) : 0;
  const snapReleaseThresholdMs = snapEnabled ? Math.max(snapThresholdMs + 36, snapThresholdMs * 1.75) : 0;
  const trimSnapReleaseThresholdMs = snapEnabled ? Math.max(trimSnapThresholdMs + 28, trimSnapThresholdMs * 2.1) : 0;
  useTimelinePlayhead(timelineGridRef, timelineOverviewRef, playheadMs, rowMsToPx, scene.durationMs, isPlaying);

  useEffect(() => {
    playheadRef.current = playheadMs;
  }, [playheadMs]);

  function flushDragVisual(next: TimelineDragState): void {
    dragRef.current = next;
    setDrag(next);
  }

  function scheduleDragVisual(next: TimelineDragState): void {
    dragRef.current = next;
    if (typeof window === 'undefined') {
      setDrag(next);
      return;
    }
    if (dragRafRef.current !== null) return;
    dragRafRef.current = window.requestAnimationFrame(() => {
      dragRafRef.current = null;
      setDrag(dragRef.current);
    });
  }

  function setDragState(next: TimelineDragState): void {
    if (!next && dragRafRef.current !== null && typeof window !== 'undefined') {
      window.cancelAnimationFrame(dragRafRef.current);
      dragRafRef.current = null;
    }
    flushDragVisual(next);
  }

  function updateDragState(updater: (current: Exclude<TimelineDragState, null>) => Exclude<TimelineDragState, null>): void {
    const current = dragRef.current;
    if (!current) return;
    const next = updater(current);
    scheduleDragVisual(next);
  }

  useEffect(() => () => {
    if (dragRafRef.current !== null && typeof window !== 'undefined') {
      window.cancelAnimationFrame(dragRafRef.current);
    }
  }, []);

  function getTimelineRowElement(widgetId: string): HTMLElement | null {
    return timelineGridRef.current?.querySelector(`[data-timeline-widget-id="${widgetId}"]`) ?? null;
  }

  function getTimelineKeyframeElement(keyframeId: string): HTMLElement | null {
    return timelineGridRef.current?.querySelector(`[data-timeline-keyframe-id="${keyframeId}"]`) ?? null;
  }

  function applyBarPreview(widgetId: string, startMs: number, endMs: number): void {
    const rowElement = getTimelineRowElement(widgetId);
    if (!rowElement) return;
    const barLeft = startMs * rowMsToPx;
    const barWidth = Math.max(16, (endMs - startMs) * rowMsToPx);
    rowElement.style.setProperty('--timeline-bar-left', `${barLeft}px`);
    rowElement.style.setProperty('--timeline-bar-width', `${barWidth}px`);
    rowElement.style.setProperty('--timeline-group-badge-left', `${barLeft + Math.min(barWidth + 10, 140)}px`);
  }

  function applyKeyframePreview(keyframeId: string, atMs: number): void {
    const keyframeElement = getTimelineKeyframeElement(keyframeId);
    if (!keyframeElement) return;
    keyframeElement.style.setProperty('--timeline-keyframe-left', `${atMs * rowMsToPx}px`);
  }

  useEffect(() => {
    if (!drag) {
      dragRef.current = null;
      return;
    }
    const previousUserSelect = document.body.style.userSelect;
    const previousCursor = document.body.style.cursor;
    document.body.style.userSelect = 'none';
    document.body.style.cursor = drag.mode === 'playhead' || drag.mode === 'trim-start' || drag.mode === 'trim-end'
      ? 'ew-resize'
      : 'grabbing';

    const snapTargets = snapEnabled
      ? buildTimelineSnapTargets(widgets, {
          excludeWidgetId: drag.mode === 'playhead' ? undefined : drag.widgetId,
          playheadMs,
        })
      : [];

    const onMove = (event: PointerEvent) => {
      const currentDrag = dragRef.current;
      if (!currentDrag) return;
      const deltaMs = Math.round((event.clientX - currentDrag.originX) / rowMsToPx);

      if (currentDrag.mode === 'playhead') {
        const nextMs = clamp(currentDrag.startMs + deltaMs, 0, scene.durationMs);
        playbackEngine.setCurrentMs(nextMs);
        playbackEngine.flushReact();
        timelineActions.setPlayhead(nextMs);
        return;
      }

      if (currentDrag.mode === 'move-keyframe') {
        const rawAtMs = clamp(currentDrag.startAtMs + deltaMs, 0, scene.durationMs);
        const snapped = holdSnapTarget(rawAtMs, currentDrag, 0, scene.durationMs, snapReleaseThresholdMs)
          ?? snapTimelineMs(rawAtMs, {
            minMs: 0,
            maxMs: scene.durationMs,
            stepMs: snapStepMs,
            thresholdMs: snapThresholdMs,
            targets: snapTargets.filter((target) => !(target.kind === 'keyframe' && target.keyframeId === currentDrag.keyframeId)),
          });
        applyKeyframePreview(currentDrag.keyframeId, snapped.valueMs);
        updateDragState((current) => current.mode === 'move-keyframe'
          ? {
              ...current,
              draftAtMs: snapped.valueMs,
              snapTargetMs: snapped.target?.ms,
              snapLabel: snapped.target?.label,
            }
          : current);
        return;
      }

      const duration = currentDrag.startEndMs - currentDrag.startStartMs;
      if (currentDrag.mode === 'move-bar') {
        const rawStartMs = clamp(currentDrag.startStartMs + deltaMs, 0, scene.durationMs - duration);
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
        applyBarPreview(currentDrag.widgetId, nextStartMs, nextStartMs + duration);
        updateDragState((current) => current.mode === 'move-bar'
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

      if (currentDrag.mode === 'trim-start') {
        const rawStartMs = clamp(currentDrag.startStartMs + deltaMs, 0, currentDrag.startEndMs - MIN_WIDGET_DURATION_MS);
        const snapped = holdSnapTarget(
          rawStartMs,
          currentDrag,
          0,
          currentDrag.startEndMs - MIN_WIDGET_DURATION_MS,
          trimSnapReleaseThresholdMs,
        ) ?? snapTimelineMs(rawStartMs, {
          minMs: 0,
          maxMs: currentDrag.startEndMs - MIN_WIDGET_DURATION_MS,
          stepMs: snapStepMs,
          thresholdMs: trimSnapThresholdMs,
          targets: snapTargets,
        });
        applyBarPreview(currentDrag.widgetId, snapped.valueMs, currentDrag.startEndMs);
        updateDragState((current) => current.mode === 'trim-start'
          ? {
              ...current,
              draftStartMs: snapped.valueMs,
              draftEndMs: currentDrag.startEndMs,
              snapTargetMs: snapped.target?.ms,
              snapLabel: snapped.target?.label,
            }
          : current);
        return;
      }

      if (currentDrag.mode === 'trim-end') {
        const rawEndMs = clamp(currentDrag.startEndMs + deltaMs, currentDrag.startStartMs + MIN_WIDGET_DURATION_MS, scene.durationMs);
        const snapped = holdSnapTarget(
          rawEndMs,
          currentDrag,
          currentDrag.startStartMs + MIN_WIDGET_DURATION_MS,
          scene.durationMs,
          trimSnapReleaseThresholdMs,
        ) ?? snapTimelineMs(rawEndMs, {
          minMs: currentDrag.startStartMs + MIN_WIDGET_DURATION_MS,
          maxMs: scene.durationMs,
          stepMs: snapStepMs,
          thresholdMs: trimSnapThresholdMs,
          targets: snapTargets,
        });
        applyBarPreview(currentDrag.widgetId, currentDrag.startStartMs, snapped.valueMs);
        updateDragState((current) => current.mode === 'trim-end'
          ? {
              ...current,
              draftStartMs: currentDrag.startStartMs,
              draftEndMs: snapped.valueMs,
              snapTargetMs: snapped.target?.ms,
              snapLabel: snapped.target?.label,
            }
          : current);
      }
    };

    const onUp = () => {
      const currentDrag = dragRef.current;
      if (!currentDrag) return;
      if (currentDrag.mode === 'move-bar' || currentDrag.mode === 'trim-start' || currentDrag.mode === 'trim-end') {
        widgetActions.updateWidgetTiming(currentDrag.widgetId, { startMs: currentDrag.draftStartMs, endMs: currentDrag.draftEndMs });
      }
      if (currentDrag.mode === 'move-keyframe') {
        timelineActions.updateKeyframe(currentDrag.widgetId, currentDrag.keyframeId, { atMs: currentDrag.draftAtMs });
        timelineActions.setPlayhead(currentDrag.draftAtMs);
      }
      setDragState(null);
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
  }, [Boolean(drag), playheadMs, rowMsToPx, scene.durationMs, snapEnabled, snapStepMs, snapThresholdMs, trimSnapThresholdMs, timelineActions, widgetActions, widgets]);

  const baseRows = useMemo(() => {
    const collapsedSet = new Set(collapsedGroupIds);
    return buildTimelineDisplayRows(widgets, selectedIds, collapsedSet, selectedOnly);
  }, [collapsedGroupIds, selectedIds, selectedOnly, widgets]);

  const displayedWidgets = baseRows;

  const trackWidth = Math.max(scene.durationMs * rowMsToPx, 420);
  const snapGuideMs = drag && drag.mode !== 'playhead' ? drag.snapTargetMs : undefined;
  const rulerStepMs = getDynamicRulerStepMs(rowMsToPx);
  const majorTickMs = Math.max(1000, rulerStepMs * 4);
  const rulerTicks = buildRulerTicks(scene.durationMs, rulerStepMs, majorTickMs);
  const gridShellStyle = { '--timeline-grid-shell-width': `${ROW_GUTTER + trackWidth + 32}px` } as CSSProperties;

  function seekPlayheadImmediate(nextMs: number): void {
    uiActions.setPreviewMode(true);
    timelineActions.setPlaying(false);
    playbackEngine.setCurrentMs(nextMs);
    playbackEngine.flushReact();
    timelineActions.setPlayhead(nextMs);
  }

  function beginPlayheadDrag(clientX: number, startMs = playheadRef.current): void {
    seekPlayheadImmediate(startMs);
    setDragState({ mode: 'playhead', originX: clientX, startMs });
  }

  function toggleTimelinePlayback(): void {
    uiActions.setPreviewMode(true);
    if (isPlaying) {
      timelineActions.setPlaying(false);
      return;
    }
    if (playheadRef.current >= scene.durationMs) {
      seekPlayheadImmediate(0);
    }
    timelineActions.setPlaying(true);
  }

  return (
    <section className={`bottom-timeline ${isPlaying ? 'is-playing' : ''} ${drag ? 'is-pointer-dragging' : ''} ${drag?.mode === 'trim-start' || drag?.mode === 'trim-end' ? 'is-trimming' : ''}`.trim()}>
      <TimelineHeader
        displayedCount={displayedWidgets.length}
        selectedCount={selectedIds.length}
        canGroupSelection={groupableCount >= 2}
        canUngroupSelection={ungroupableCount > 0}
        activeSceneId={activeSceneId}
        scenes={scenes.map((item) => ({ id: item.id, name: item.name }))}
        isPlaying={isPlaying}
        playheadMs={playheadMs}
        sceneDurationMs={scene.durationMs}
        snapEnabled={snapEnabled}
        snapStepMs={snapStepMs}
        selectedOnly={selectedOnly}
        timelineZoom={timelineZoom}
        onResizeStart={onResizeStart}
        onToggleCollapse={onToggleCollapse}
        onTogglePlay={toggleTimelinePlayback}
        onResetPlayhead={() => seekPlayheadImmediate(0)}
        onPreviousScene={() => sceneActions.previousScene()}
        onNextScene={() => sceneActions.nextScene()}
        onSelectScene={(sceneId) => sceneActions.selectScene(sceneId)}
        onGroupSelection={() => widgetActions.groupSelected()}
        onUngroupSelection={() => widgetActions.ungroupSelected()}
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
        onSeek={seekPlayheadImmediate}
      />

      <div ref={timelineScrollRef} className="timeline-scroll" onWheel={onWheel}>
        <div ref={timelineGridRef} className="timeline-grid-shell" style={gridShellStyle}>
          <TimelineRuler
            rulerTicks={rulerTicks}
            rowMsToPx={rowMsToPx}
            trackWidth={trackWidth}
            snapGuideMs={snapGuideMs}
            onPointerDown={beginPlayheadDrag}
          />
          {snapGuideMs !== undefined ? (
            <div
              className="timeline-snap-guide-global"
              style={{ '--timeline-snap-guide-left': `${ROW_GUTTER + snapGuideMs * rowMsToPx}px` } as CSSProperties}
            />
          ) : null}
          <TimelineTrackList
            displayedWidgets={displayedWidgets}
            selectedIds={selectedIds}
            playheadMs={playheadMs}
            rowMsToPx={rowMsToPx}
            trackWidth={trackWidth}
            sceneDurationMs={scene.durationMs}
            collapsedGroupIds={collapsedGroupIds}
            selectedOnly={selectedOnly}
            onSelectWidget={(widgetId, additive) => widgetActions.selectWidget(widgetId, additive)}
            onToggleWidgetHidden={(widgetId) => widgetActions.toggleWidgetHidden(widgetId)}
            onToggleWidgetLocked={(widgetId) => widgetActions.toggleWidgetLocked(widgetId)}
            onUpdateWidgetName={widgetActions.updateWidgetName}
            onReorderWidget={(widgetId, direction) => widgetActions.reorderWidget(widgetId, direction)}
            onToggleGroupCollapse={(widgetId) => setCollapsedGroupIds((current) => current.includes(widgetId) ? current.filter((id) => id !== widgetId) : [...current, widgetId])}
            onDragStart={(nextDrag) => setDragState(nextDrag)}
            onScrubStart={beginPlayheadDrag}
            onAddKeyframe={(widgetId, property) => timelineActions.addKeyframe(widgetId, property, playheadRef.current)}
            onJumpToMs={seekPlayheadImmediate}
            onFocusKeyframe={(widgetId, keyframeId, atMs) => {
              widgetActions.selectWidget(widgetId);
              seekPlayheadImmediate(atMs);
              uiActions.setInspectorFocus({ widgetId, tab: 'behavior', keyframeId });
            }}
            availableKeyframeProperties={KEYFRAME_PROPERTIES}
          />
        </div>
      </div>
    </section>
  );
}
