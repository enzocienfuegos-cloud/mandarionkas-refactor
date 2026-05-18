import { useEffect, useRef, type PointerEvent as ReactPointerEvent, type RefObject } from 'react';
import type { CSSProperties } from 'react';
import { getLiveWidgetFrame, getLiveWidgetOpacity, isWidgetVisibleAt } from '../../../domain/document/timeline';
import type { WidgetFrame, WidgetNode } from '../../../domain/document/types';
import type { ResizeHandle } from '../use-stage-controller';
import { StageWidget } from './StageWidget';
import { StageDropPreviewOverlay } from './StageDropPreviewOverlay';
import { rectStyle, sceneTransitionOpacity, sceneTransitionTransform, toRect } from './stage-utils';
import { createStageInteractionProps, STAGE_INTERACTION } from '../stage-interaction-targets';
import { isVisibleWithinParentTimeline, resolveInheritedMotionFrame, resolveInheritedOpacity } from './stage-motion-inheritance';
import { createEventClock } from '../../../motion/animation-engine';
import { useAnimationEngine } from '../../../motion/animation-engine';
import { isScratchGroupActive } from '../../../widgets/group/group-scratch-activation';
import { resolveScratchRevealTargets } from '../../../widgets/group/group-reveal-target';

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
  playheadMs: number;
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
  isWidgetVisible: (widgetId: string) => boolean;
  onStagePointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onStageDragOver: (event: React.DragEvent<HTMLDivElement>) => void;
  onStageDragLeave: (event: React.DragEvent<HTMLDivElement>) => void;
  onStageDrop: (event: React.DragEvent<HTMLDivElement>) => void;
  onWidgetPointerDown: (event: ReactPointerEvent<HTMLDivElement>, widgetId: string, locked: boolean) => void;
  onResizePointerDown: (event: ReactPointerEvent<HTMLButtonElement>, widgetId: string, locked: boolean, handle: ResizeHandle) => void;
  onSetActiveWidget: (widgetId?: string) => void;
  onSetHoveredWidget: (widgetId?: string) => void;
  onExecuteAction: (actionId: string) => void;
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
  playheadMs,
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
  isWidgetVisible,
  onStagePointerDown,
  onStageDragOver,
  onStageDragLeave,
  onStageDrop,
  onWidgetPointerDown,
  onResizePointerDown,
  onSetActiveWidget,
  onSetHoveredWidget,
  onExecuteAction,
}: StageSurfaceProps): JSX.Element {
  const engine = useAnimationEngine();
  const stageDropActive = Boolean(dropPreview);
  const isReproducing = previewMode && isPlaying;
  const transitionDuration = Math.max(120, sceneTransitionDurationMs);
  const previousPlayheadRef = useRef(playheadMs);
  const previousSceneIdRef = useRef<string | undefined>(undefined);
  const widgetsRef = useRef(widgets);

  useEffect(() => {
    widgetsRef.current = widgets;
  }, [widgets]);

  useEffect(() => {
    if (!previewMode) {
      engine.resetEventClocks();
      previousPlayheadRef.current = playheadMs;
      return;
    }
    previousPlayheadRef.current = playheadMs;
  }, [engine, playheadMs, previewMode]);

  useEffect(() => {
    if (!isReproducing) return;
    engine.seekScene(playheadMs);
  }, [engine, isReproducing, playheadMs]);

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

  function isCoveredByScratchGroup(widget: WidgetNode): boolean {
    if (!previewMode) return false;
    let currentParentId = widget.parentId;
    while (currentParentId) {
      const parent = widgetsById[currentParentId];
      if (!parent) return false;
      if (parent.type === 'group' && parent.props.scratchEnabled) return true;
      currentParentId = parent.parentId;
    }
    return false;
  }

  function isWidgetVisibleAtBaseTime(widget: WidgetNode): boolean {
    if (widget.hidden) return false;
    return isWidgetVisibleAt(widget, playheadMs);
  }

  function resolveScratchGroupFrame(widget: WidgetNode, visited = new Set<string>()): WidgetFrame {
    if (visited.has(widget.id)) {
      return liveFrameById[widget.id] ?? getLiveWidgetFrame(widget, playheadMs);
    }
    visited.add(widget.id);
    const baseFrame = liveFrameById[widget.id] ?? getLiveWidgetFrame(widget, playheadMs);
    const childFrames = (widget.childIds ?? [])
      .map((childId) => widgetsById[childId])
      .filter((child): child is WidgetNode => Boolean(child) && isWidgetVisibleAtBaseTime(child))
      .map((child) => {
        if (child.childIds?.length) return resolveScratchGroupFrame(child, visited);
        return liveFrameById[child.id] ?? getLiveWidgetFrame(child, playheadMs);
      });

    if (!childFrames.length) return baseFrame;

    const minX = Math.min(baseFrame.x, ...childFrames.map((frame) => frame.x));
    const minY = Math.min(baseFrame.y, ...childFrames.map((frame) => frame.y));
    const maxX = Math.max(baseFrame.x + baseFrame.width, ...childFrames.map((frame) => frame.x + frame.width));
    const maxY = Math.max(baseFrame.y + baseFrame.height, ...childFrames.map((frame) => frame.y + frame.height));

    return {
      ...baseFrame,
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
    };
  }

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
    return { left: Math.round((playheadMs / sceneDurationMs) * canvas.width) };
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
        if (!isWidgetVisibleAtBaseTime(widget) || !isVisibleWithinParentTimeline({
          widget,
          widgetsById,
          isWidgetVisible: (widgetId) => {
            const target = widgetsById[widgetId];
            return target ? isWidgetVisibleAtBaseTime(target) : false;
          },
        })) return null;
        if (isCoveredByScratchGroup(widget)) return null;
        const scratchGroupActive = widget.type === 'group' && isScratchGroupActive({ group: widget, widgetsById, playheadMs });
        const isPassThroughGroup = widget.type === 'group'
          && Boolean(widget.childIds?.length)
          && (!Boolean(widget.props.scratchEnabled) || !scratchGroupActive);
        const groupSelectedInEditor = !previewMode && selectedIds.includes(widget.id);
        if (isPassThroughGroup && !groupSelectedInEditor) return null;

        const liveFrame = isReproducing ? widget.frame : (liveFrameById[widget.id] ?? getLiveWidgetFrame(widget, playheadMs));
        const baseFrame = previewMode && widget.type === 'group' && Boolean(widget.props.scratchEnabled)
          ? resolveScratchGroupFrame(widget)
          : liveFrame;
        const frame = isReproducing
          ? baseFrame
          : resolveInheritedMotionFrame({
              widget,
              widgetsById,
              liveFrameById,
              playheadMs,
              getLiveFrame: (target, targetPlayheadMs) => getLiveWidgetFrame(target, targetPlayheadMs),
              ownFrame: baseFrame,
            });
        const renderNode = frame === widget.frame ? widget : { ...widget, frame };
        const opacity = isReproducing
          ? Number(widget.style.opacity ?? 1)
          : resolveInheritedOpacity({
              widget,
              widgetsById,
              playheadMs,
              ownOpacity: getLiveWidgetOpacity(widget, playheadMs),
              getLiveOpacity: (target, targetPlayheadMs) => getLiveWidgetOpacity(target, targetPlayheadMs),
            });

        return (
          <StageWidget
            key={widget.id}
            node={renderNode}
            stateRef={stateRef}
            widgetsById={widgetsById}
            selected={selectedIds.includes(widget.id) && !previewMode}
            primary={selectedIds[0] === widget.id && !previewMode}
            frame={frame}
            opacity={opacity}
            showBadge={showWidgetBadges}
            previewMode={previewMode}
            isReproducing={isReproducing}
            editModeWireframe={editModeWireframe}
            playheadMs={playheadMs}
            sceneDurationMs={sceneDurationMs}
            hovered={hoveredWidgetId === renderNode.id}
            active={activeWidgetId === renderNode.id}
            onSetActiveWidget={onSetActiveWidget}
            onSetHoveredWidget={onSetHoveredWidget}
            onExecuteAction={onExecuteAction}
            onWidgetTrigger={(widgetId, trigger, metadata) => {
              const nowMs = performance.now();
              if (trigger === 'click' || trigger === 'hover-enter' || trigger === 'hover-exit') {
                engine.emit({
                  trigger,
                  sourceId: widgetId,
                  targetId: widgetId,
                  sceneTimeMs: playheadMs,
                  realTimeMs: nowMs,
                  clock: createEventClock(trigger, nowMs),
                  metadata,
                });
                return;
              }
              if (trigger !== 'scratch-complete') return;
              const scratchWidget = widgetsById[widgetId];
              if (!scratchWidget) return;
              const revealTargets = resolveScratchRevealTargets(scratchWidget, widgets, widgetsById);
              const clock = createEventClock('reveal', nowMs);
              revealTargets.forEach((targetWidget) => {
                engine.emit({
                  trigger: 'reveal',
                  sourceId: widgetId,
                  targetId: targetWidget.id,
                  sceneTimeMs: Number(metadata?.completedAtMs ?? playheadMs),
                  realTimeMs: nowMs,
                  clock,
                  metadata,
                });
              });
            }}
            onWidgetPointerDown={(event) => onWidgetPointerDown(event, renderNode.id, Boolean(renderNode.locked))}
            onResizePointerDown={(event, handle) => onResizePointerDown(event, renderNode.id, Boolean(renderNode.locked), handle)}
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
      <div className="playhead-overlay" {...createStageInteractionProps(STAGE_INTERACTION.systemOverlay)} style={buildPlayheadOverlayStyle()} />
    </div>
  );
}
