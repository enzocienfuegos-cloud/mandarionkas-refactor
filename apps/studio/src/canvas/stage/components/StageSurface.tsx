import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, type PointerEvent as ReactPointerEvent, type RefObject } from 'react';
import type { CSSProperties } from 'react';
import { getLiveWidgetFrame, getLiveWidgetOpacity, isWidgetVisibleAt } from '../../../domain/document/timeline';
import type { ActionNode, WidgetNode } from '../../../domain/document/types';
import type { ResizeHandle } from '../use-stage-controller';
import { StageWidget } from './StageWidget';
import { StageDropPreviewOverlay } from './StageDropPreviewOverlay';
import { rectStyle, sceneTransitionOpacity, sceneTransitionTransform, toRect } from './stage-utils';
import { createStageInteractionProps, STAGE_INTERACTION } from '../stage-interaction-targets';
import { createEventClock } from '../../../motion/animation-engine';
import { useAnimationEngine } from '../../../motion/animation-engine';
import { buildScratchRevealMetadata } from '../../../motion/animation-engine/reveal-replay';
import { isScratchGroupActive } from '../../../widgets/group/group-scratch-activation';
import { resolveScratchRevealTargets } from '../../../widgets/group/group-reveal-target';
import { playbackEngine } from '../../../hooks/use-playback-engine';
import { useLatestRef } from '../../../shared/hooks';
import { usePlayheadRef } from '../playhead-ref-context';
import { getParentChainByWidgetId } from './stage-parent-chain-cache';

function hasTimelineDynamics(widget: WidgetNode, sceneDurationMs: number): boolean {
  return Boolean(widget.timeline.keyframes?.length)
    || widget.timeline.startMs !== 0
    || widget.timeline.endMs !== sceneDurationMs;
}

export type StageSurfaceProps = {
  stageRef: RefObject<HTMLDivElement>;
  sceneId: string;
  canvas: { width: number; height: number; backgroundColor: string };
  widgets: WidgetNode[];
  widgetsById: Record<string, WidgetNode>;
  selectedIds: string[];
  previewMode: boolean;
  isPlaying: boolean;
  editModeWireframe: boolean;
  zoom: number;
  sceneDurationMs: number;
  sceneTransitionType: 'cut' | 'fade' | 'slide-left' | 'slide-right';
  sceneTransitionDurationMs: number;
  sceneTransitionActive: boolean;
  marquee: { origin: { x: number; y: number }; current: { x: number; y: number } } | null;
  dropPreview: ReturnType<typeof import('../use-stage-controller').useStageController>['dropPreview'];
  liveFrameById: Record<string, import('../../../domain/document/types').WidgetFrame>;
  hoveredWidgetId?: string;
  activeWidgetId?: string;
  showStageRulers: boolean;
  showWidgetBadges: boolean;
  stateRef: React.MutableRefObject<import('../../../domain/document/types').StudioState>;
  onStagePointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onStageDragOver: (event: React.DragEvent<HTMLDivElement>) => void;
  onStageDragLeave: (event: React.DragEvent<HTMLDivElement>) => void;
  onStageDrop: (event: React.DragEvent<HTMLDivElement>) => void;
  onWidgetPointerDown: (event: ReactPointerEvent<HTMLDivElement>, widgetId: string, locked: boolean) => void;
  onResizePointerDown: (event: ReactPointerEvent<HTMLButtonElement>, widgetId: string, locked: boolean, handle: ResizeHandle) => void;
  onSetActiveWidget: (widgetId?: string) => void;
  onSetHoveredWidget: (widgetId?: string) => void;
  onExecuteAction: (actionId: string) => void;
  onGoToScene: (sceneId: string) => void;
};

export function StageSurface({
  stageRef,
  sceneId,
  canvas,
  widgets,
  widgetsById,
  selectedIds,
  previewMode,
  isPlaying,
  editModeWireframe,
  zoom,
  sceneDurationMs,
  sceneTransitionType,
  sceneTransitionDurationMs,
  sceneTransitionActive,
  marquee,
  dropPreview,
  liveFrameById,
  hoveredWidgetId,
  activeWidgetId,
  showStageRulers,
  showWidgetBadges,
  stateRef,
  onStagePointerDown,
  onStageDragOver,
  onStageDragLeave,
  onStageDrop,
  onWidgetPointerDown,
  onResizePointerDown,
  onSetActiveWidget,
  onSetHoveredWidget,
  onExecuteAction,
  onGoToScene,
}: StageSurfaceProps): JSX.Element {
  const playheadRef = usePlayheadRef();
  const engine = useAnimationEngine();
  const stageDropActive = Boolean(dropPreview);
  const isReproducing = previewMode && isPlaying;
  const transitionDuration = Math.max(120, sceneTransitionDurationMs);
  const previousSceneIdRef = useRef<string | undefined>(undefined);
  const widgetsRef = useRef(widgets);
  const widgetElementsRef = useRef(new Map<string, HTMLDivElement>());
  const widgetRefHandlersRef = useRef(new Map<string, (node: HTMLDivElement | null) => void>());
  const playheadOverlayRef = useRef<HTMLDivElement | null>(null);
  const sceneWidgets = useMemo(
    () => Object.values(widgetsById).filter((widget) => widget.sceneId === sceneId),
    [sceneId, widgetsById],
  );
  const widgetTriggerDepsRef = useLatestRef({
    engine,
    widgetsById,
    sceneWidgets,
    playheadRef,
  });
  const parentChainByWidgetId = useMemo(
    () => getParentChainByWidgetId(widgets, widgetsById),
    [widgets, widgetsById],
  );
  const widgetAnimationState = useMemo(() => {
    const ownDynamicsByWidgetId = new Map<string, boolean>();
    widgets.forEach((widget) => {
      ownDynamicsByWidgetId.set(widget.id, hasTimelineDynamics(widget, sceneDurationMs));
    });

    const result = new Map<string, { animated: boolean; parentChainHasDynamics: boolean }>();
    widgets.forEach((widget) => {
      const parentChainHasDynamics = (parentChainByWidgetId.get(widget.id) ?? [])
        .some((parent) => ownDynamicsByWidgetId.get(parent.id) ?? false);
      result.set(widget.id, {
        animated: (ownDynamicsByWidgetId.get(widget.id) ?? false) || parentChainHasDynamics,
        parentChainHasDynamics,
      });
    });
    return result;
  }, [parentChainByWidgetId, sceneDurationMs, widgets]);
  const playbackReactiveWidgets = useMemo(
    () => widgets.filter((widget) => widgetAnimationState.get(widget.id)?.animated ?? true),
    [widgetAnimationState, widgets],
  );

  const stableWidgetTrigger = useCallback((widgetId: string, trigger: ActionNode['trigger'], metadata?: Record<string, unknown>) => {
    const deps = widgetTriggerDepsRef.current;
    const nowMs = performance.now();
    const sceneTimeMs = deps.playheadRef.current;

    if (trigger === 'click' || trigger === 'hover-enter' || trigger === 'hover-exit') {
      deps.engine.emit({
        trigger,
        sourceId: widgetId,
        targetId: widgetId,
        sceneTimeMs,
        realTimeMs: nowMs,
        clock: createEventClock(trigger, nowMs),
        metadata,
      });
      return;
    }
    if (trigger !== 'scratch-complete') return;

    const scratchWidget = deps.widgetsById[widgetId];
    if (!scratchWidget) return;
    const revealTargets = resolveScratchRevealTargets(scratchWidget, deps.sceneWidgets, deps.widgetsById);
    const clock = createEventClock('reveal', nowMs);
    const metadataWithReplay = {
      ...(metadata ?? {}),
      ...(buildScratchRevealMetadata(scratchWidget.props.replayTargetMotionOnReveal !== false) ?? {}),
    };
    revealTargets.forEach((targetWidget) => {
      deps.engine.emit({
        trigger: 'reveal',
        sourceId: widgetId,
        targetId: targetWidget.id,
        sceneTimeMs: Number(metadata?.completedAtMs ?? sceneTimeMs),
        realTimeMs: nowMs,
        clock,
        metadata: metadataWithReplay,
      });
    });
  }, [widgetTriggerDepsRef]);

  useEffect(() => {
    widgetsRef.current = widgets;
  }, [widgets]);

  useEffect(() => {
    const activeIds = new Set(widgets.map((widget) => widget.id));
    widgetElementsRef.current.forEach((_, widgetId) => {
      if (!activeIds.has(widgetId)) widgetElementsRef.current.delete(widgetId);
    });
    widgetRefHandlersRef.current.forEach((_, widgetId) => {
      if (!activeIds.has(widgetId)) widgetRefHandlersRef.current.delete(widgetId);
    });
    widgetElementsRef.current.forEach((element) => {
      delete element.dataset.frameApplied;
    });
  }, [widgets]);

  const getWidgetRefHandler = useCallback((widgetId: string) => {
    const existing = widgetRefHandlersRef.current.get(widgetId);
    if (existing) return existing;
    const handler = (node: HTMLDivElement | null) => {
      if (node) {
        widgetElementsRef.current.set(widgetId, node);
        return;
      }
      widgetElementsRef.current.delete(widgetId);
    };
    widgetRefHandlersRef.current.set(widgetId, handler);
    return handler;
  }, []);

  useEffect(() => {
    if (!previewMode) {
      engine.resetEventClocks();
    }
  }, [engine, previewMode]);

  useEffect(() => {
    const syncScenePlayback = (nextMs: number, source: 'tick' | 'scrub' | 'seek') => {
      if (isReproducing && source === 'tick') {
        engine.syncScenePlayhead(nextMs);
        return;
      }
      engine.seekScene(nextMs);
    };

    engine.seekScene(playbackEngine.getCurrentMs());
    return playbackEngine.subscribeDom(syncScenePlayback);
  }, [engine, isReproducing]);

  useEffect(() => {
    if (!isReproducing) {
      previousSceneIdRef.current = undefined;
      return;
    }
    if (previousSceneIdRef.current === sceneId) return;

    const nowMs = typeof performance !== 'undefined' && typeof performance.now === 'function'
      ? performance.now()
      : Date.now();
    previousSceneIdRef.current = sceneId;
    const enterClock = createEventClock('scene-enter', nowMs);
    widgetsRef.current.forEach((widget) => {
      engine.emit({
        trigger: 'scene-enter',
        sourceId: widget.id,
        targetId: widget.id,
        sceneTimeMs: 0,
        realTimeMs: nowMs,
        clock: enterClock,
      });
    });
  }, [engine, isReproducing, sceneId]);

  useLayoutEffect(() => {
    if (typeof document === 'undefined') return undefined;
    const apply = (ms: number, targets: WidgetNode[]) => {
      const frameCache = new Map<string, WidgetNode['frame']>();
      const opacityCache = new Map<string, number>();
      const getWidgetFrameAt = (widget: WidgetNode): WidgetNode['frame'] => {
        if (isReproducing) return widget.frame;
        const override = liveFrameById[widget.id];
        if (override) return override;
        const cached = frameCache.get(widget.id);
        if (cached) return cached;
        const nextFrame = getLiveWidgetFrame(widget, ms);
        frameCache.set(widget.id, nextFrame);
        return nextFrame;
      };
      const getWidgetOpacityAt = (widget: WidgetNode): number => {
        if (isReproducing) return Number(widget.style.opacity ?? 1);
        const cached = opacityCache.get(widget.id);
        if (cached !== undefined) return cached;
        const nextOpacity = getLiveWidgetOpacity(widget, ms);
        opacityCache.set(widget.id, nextOpacity);
        return nextOpacity;
      };

      targets.forEach((widget) => {
        const element = widgetElementsRef.current.get(widget.id);
        if (!element) return;

        const animationState = widgetAnimationState.get(widget.id) ?? {
          animated: true,
          parentChainHasDynamics: true,
        };
        const animated = animationState.animated;
        const parentChainHasDynamics = animationState.parentChainHasDynamics;

        if (!animated && !liveFrameById[widget.id] && element.dataset.frameApplied === '1') {
          return;
        }

        const parentChain = parentChainByWidgetId.get(widget.id) ?? [];
        if (
          !animated
          && !parentChainHasDynamics
          && !liveFrameById[widget.id]
          && !parentChain.some((parent) => Boolean(liveFrameById[parent.id]))
          && element.dataset.frameApplied === '1'
        ) {
          return;
        }

        const visible = !widget.hidden
          && isWidgetVisibleAt(widget, ms)
          && parentChain.every((parent) => !parent.hidden && isWidgetVisibleAt(parent, ms));

        const nextDisplay = visible ? '' : 'none';
        if (element.dataset.displayState !== nextDisplay) {
          element.style.display = nextDisplay;
          element.dataset.displayState = nextDisplay;
        }
        if (!visible) return;

        const liveFrame = getWidgetFrameAt(widget);
        const frame = isReproducing
          ? liveFrame
          : (() => {
              let nextX = liveFrame.x;
              let nextY = liveFrame.y;
              parentChain.forEach((parent) => {
                const parentLiveFrame = getWidgetFrameAt(parent);
                nextX += parentLiveFrame.x - parent.frame.x;
                nextY += parentLiveFrame.y - parent.frame.y;
              });
              return {
                ...liveFrame,
                x: nextX,
                y: nextY,
              };
            })();

        const nextTransform = `translate3d(${frame.x}px, ${frame.y}px, 0) rotate(${frame.rotation}deg)`;
        if (element.dataset.frameTransform !== nextTransform) {
          element.style.transform = nextTransform;
          element.dataset.frameTransform = nextTransform;
        }

        const nextWidth = String(frame.width);
        const nextHeight = String(frame.height);
        if (element.dataset.frameWidth !== nextWidth) {
          element.style.width = `${frame.width}px`;
          element.dataset.frameWidth = nextWidth;
        }
        if (element.dataset.frameHeight !== nextHeight) {
          element.style.height = `${frame.height}px`;
          element.dataset.frameHeight = nextHeight;
        }

        const opacity = isReproducing
          ? getWidgetOpacityAt(widget)
          : (() => {
              let nextOpacity = getWidgetOpacityAt(widget);
              parentChain.forEach((parent) => {
                nextOpacity *= getWidgetOpacityAt(parent);
              });
              return Math.max(0, Math.min(1, nextOpacity));
            })();
        const nextOpacity = String(opacity);
        if (element.dataset.frameOpacity !== nextOpacity) {
          element.style.opacity = nextOpacity;
          element.dataset.frameOpacity = nextOpacity;
        }
        element.dataset.frameApplied = '1';
      });

      if (playheadOverlayRef.current) {
        const x = Math.round((ms / sceneDurationMs) * canvas.width);
        playheadOverlayRef.current.style.transform = `translate3d(${x}px, 0, 0)`;
      }
    };

    apply(playbackEngine.getCurrentMs(), widgets);
    return playbackEngine.subscribeDom((nextMs) => apply(nextMs, playbackReactiveWidgets));
  }, [canvas.width, isReproducing, liveFrameById, parentChainByWidgetId, playbackReactiveWidgets, sceneDurationMs, widgetAnimationState, widgets]);

  function buildStageSurfaceStyle(): CSSProperties {
    return {
      width: canvas.width,
      height: canvas.height,
      background: canvas.backgroundColor,
      transform: `scale(${zoom}) ${sceneTransitionTransform(sceneTransitionType, sceneTransitionActive)}`,
      transformOrigin: 'top left',
      opacity: sceneTransitionOpacity(sceneTransitionType, sceneTransitionActive),
      transition: `transform ${transitionDuration}ms ease, opacity ${transitionDuration}ms ease`,
    };
  }

  function buildHorizontalGuideStyle(): CSSProperties {
    return { top: Math.round(canvas.height / 2) };
  }

  function buildVerticalGuideStyle(): CSSProperties {
    return { left: Math.round(canvas.width / 2) };
  }

  function buildPlayheadOverlayStyle(): CSSProperties {
    return { transform: 'translate3d(0, 0, 0)' };
  }

  return (
    <div
      className={`stage-surface ${previewMode ? 'is-preview-mode' : 'is-edit-mode'} ${stageDropActive ? 'is-drop-target' : ''} ${dropPreview && !dropPreview.inBounds ? 'is-drop-invalid' : ''}`}
      ref={stageRef}
      {...createStageInteractionProps(STAGE_INTERACTION.surface)}
      onPointerDown={onStagePointerDown}
      onDragOver={onStageDragOver}
      onDragLeave={onStageDragLeave}
      onDrop={onStageDrop}
      style={buildStageSurfaceStyle()}
    >
      {widgets.map((widget) => {
        const scratchGroupActive = widget.type === 'group' && isScratchGroupActive({ group: widget, widgetsById, playheadMs: playheadRef.current });
        const isPassThroughGroup = widget.type === 'group'
          && Boolean(widget.childIds?.length)
          && (!Boolean(widget.props.scratchEnabled) || !scratchGroupActive);
        const groupSelectedInEditor = !previewMode && selectedIds.includes(widget.id);
        if (isPassThroughGroup && !groupSelectedInEditor) return null;

        const baseFrame = liveFrameById[widget.id] ?? widget.frame;

        return (
          <StageWidget
            key={widget.id}
            node={widget}
            stateRef={stateRef}
            widgetsById={widgetsById}
            widgetRef={getWidgetRefHandler(widget.id)}
            selected={selectedIds.includes(widget.id) && !previewMode}
            primary={selectedIds[0] === widget.id && !previewMode}
            frame={baseFrame}
            showBadge={showWidgetBadges}
            previewMode={previewMode}
            isReproducing={isReproducing}
            editModeWireframe={editModeWireframe}
            sceneDurationMs={sceneDurationMs}
            hovered={hoveredWidgetId === widget.id}
            active={activeWidgetId === widget.id}
            onSetActiveWidget={onSetActiveWidget}
            onSetHoveredWidget={onSetHoveredWidget}
            onExecuteAction={onExecuteAction}
            onGoToScene={onGoToScene}
            onWidgetTrigger={stableWidgetTrigger}
            onWidgetPointerDown={(event) => onWidgetPointerDown(event, widget.id, Boolean(widget.locked))}
            onResizePointerDown={(event, handle) => onResizePointerDown(event, widget.id, Boolean(widget.locked), handle)}
          />
        );
      })}
      {marquee ? <div className="marquee-rect" {...createStageInteractionProps(STAGE_INTERACTION.systemOverlay)} style={rectStyle(toRect(marquee.origin, marquee.current))} /> : null}
      {dropPreview ? <StageDropPreviewOverlay preview={dropPreview} /> : null}
      {!previewMode && showStageRulers ? (
        <>
          <div className="stage-guide stage-guide-horizontal" {...createStageInteractionProps(STAGE_INTERACTION.systemOverlay)} style={buildHorizontalGuideStyle()} />
          <div className="stage-guide stage-guide-vertical" {...createStageInteractionProps(STAGE_INTERACTION.systemOverlay)} style={buildVerticalGuideStyle()} />
        </>
      ) : null}
      <div ref={playheadOverlayRef} className="playhead-overlay" {...createStageInteractionProps(STAGE_INTERACTION.systemOverlay)} style={buildPlayheadOverlayStyle()} />
    </div>
  );
}
