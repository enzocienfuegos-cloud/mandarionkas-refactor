import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type RefObject } from 'react';
import type { CSSProperties } from 'react';
import { getLiveWidgetFrame, getLiveWidgetOpacity } from '../../../domain/document/timeline';
import type { WidgetFrame, WidgetNode } from '../../../domain/document/types';
import type { ResizeHandle } from '../use-stage-controller';
import { StageWidget } from './StageWidget';
import { StageDropPreviewOverlay } from './StageDropPreviewOverlay';
import { rectStyle, sceneTransitionOpacity, sceneTransitionTransform, toRect } from './stage-utils';
import { createStageInteractionProps, STAGE_INTERACTION } from '../stage-interaction-targets';
import { isVisibleWithinParentTimeline, resolveInheritedMotionFrame, resolveInheritedOpacity } from './stage-motion-inheritance';
import { isScratchGroupActive } from '../../../widgets/group/group-scratch-activation';

export type StageSurfaceProps = {
  stageRef: RefObject<HTMLDivElement>;
  canvas: { width: number; height: number; backgroundColor: string };
  widgets: WidgetNode[];
  widgetsById: Record<string, WidgetNode>;
  selectedIds: string[];
  previewMode: boolean;
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
  canvas,
  widgets,
  widgetsById,
  selectedIds,
  previewMode,
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
  const stageDropActive = Boolean(dropPreview);
  const transitionDuration = Math.max(120, sceneTransitionDurationMs);
  const [scratchCompletionMsByWidgetId, setScratchCompletionMsByWidgetId] = useState<Record<string, number>>({});
  const previousPlayheadRef = useRef(playheadMs);

  useEffect(() => {
    if (!previewMode) {
      setScratchCompletionMsByWidgetId({});
      previousPlayheadRef.current = playheadMs;
      return;
    }
    if (playheadMs === 0 || playheadMs < previousPlayheadRef.current) {
      setScratchCompletionMsByWidgetId({});
    }
    previousPlayheadRef.current = playheadMs;
  }, [playheadMs, previewMode]);

  function rectsOverlap(left: WidgetFrame, right: WidgetFrame): boolean {
    return left.x < right.x + right.width
      && left.x + left.width > right.x
      && left.y < right.y + right.height
      && left.y + left.height > right.y;
  }

  function isCoveredByScratchGroup(widget: WidgetNode): boolean {
    if (!previewMode) return false;
    let currentParentId = widget.parentId;
    while (currentParentId) {
      const parent = widgetsById[currentParentId];
      if (!parent) return false;
      if (parent.type === 'group' && isScratchGroupActive({ group: parent, widgetsById, playheadMs })) return true;
      currentParentId = parent.parentId;
    }
    return false;
  }

  function resolveScratchGroupFrame(widget: WidgetNode, visited = new Set<string>()): WidgetFrame {
    if (visited.has(widget.id)) {
      return liveFrameById[widget.id] ?? getLiveWidgetFrame(widget, playheadMs);
    }
    visited.add(widget.id);
    const baseFrame = liveFrameById[widget.id] ?? getLiveWidgetFrame(widget, playheadMs);
    const childFrames = (widget.childIds ?? [])
      .map((childId) => widgetsById[childId])
      .filter((child): child is WidgetNode => Boolean(child) && isWidgetVisible(child.id))
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

  function findScratchRevealCompletionMs(widget: WidgetNode): number | undefined {
    if (!previewMode) return undefined;
    const widgetFrame = liveFrameById[widget.id] ?? getLiveWidgetFrame(widget, playheadMs);
    let topCoverId: string | null = null;
    let topCoverZIndex = Number.NEGATIVE_INFINITY;

    widgets.forEach((candidate) => {
      if (candidate.id === widget.id) return;
      if (candidate.type !== 'group' || !candidate.props.scratchEnabled) return;
      if (candidate.zIndex <= widget.zIndex) return;
      const candidateFrame = resolveScratchGroupFrame(candidate);
      if (!rectsOverlap(candidateFrame, widgetFrame)) return;
      if (candidate.zIndex > topCoverZIndex) {
        topCoverId = candidate.id;
        topCoverZIndex = candidate.zIndex;
      }
    });

    if (!topCoverId) return undefined;
    return scratchCompletionMsByWidgetId[topCoverId];
  }

  function getEffectiveWidgetPlayheadMs(widget: WidgetNode): number {
    const completedAtMs = findScratchRevealCompletionMs(widget);
    if (completedAtMs === undefined) return playheadMs;
    return widget.timeline.startMs + Math.max(0, playheadMs - completedAtMs);
  }

  function getEffectiveLiveFrame(widget: WidgetNode): WidgetFrame {
    return getLiveWidgetFrame(widget, getEffectiveWidgetPlayheadMs(widget));
  }

  function getEffectiveLiveOpacity(widget: WidgetNode): number {
    return getLiveWidgetOpacity(widget, getEffectiveWidgetPlayheadMs(widget));
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
        if (!isWidgetVisible(widget.id) || !isVisibleWithinParentTimeline({ widget, widgetsById, isWidgetVisible })) return null;
        if (isCoveredByScratchGroup(widget)) return null;
        const scratchGroupActive = widget.type === 'group' && isScratchGroupActive({ group: widget, widgetsById, playheadMs });
        const isPassThroughGroup = widget.type === 'group'
          && Boolean(widget.childIds?.length)
          && (!Boolean(widget.props.scratchEnabled) || !scratchGroupActive);
        const groupSelectedInEditor = !previewMode && selectedIds.includes(widget.id);
        if (isPassThroughGroup && !groupSelectedInEditor) return null;
        const liveFrame = liveFrameById[widget.id] ?? getEffectiveLiveFrame(widget);
        const baseFrame = previewMode && widget.type === 'group' && Boolean(widget.props.scratchEnabled)
          ? resolveScratchGroupFrame(widget)
          : liveFrame;
        const frame = resolveInheritedMotionFrame({
          widget,
          widgetsById,
          liveFrameById,
          playheadMs,
          getLiveFrame: (target, _playheadMs) => getEffectiveLiveFrame(target),
          ownFrame: baseFrame,
        });
        const renderNode = frame === widget.frame ? widget : { ...widget, frame };
        const opacity = resolveInheritedOpacity({
          widget,
          widgetsById,
          playheadMs,
          ownOpacity: getEffectiveLiveOpacity(widget),
          getLiveOpacity: (target, _playheadMs) => getEffectiveLiveOpacity(target),
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
            editModeWireframe={editModeWireframe}
            playheadMs={playheadMs}
            sceneDurationMs={sceneDurationMs}
            hovered={hoveredWidgetId === renderNode.id}
            active={activeWidgetId === renderNode.id}
            onSetActiveWidget={onSetActiveWidget}
            onSetHoveredWidget={onSetHoveredWidget}
            onExecuteAction={onExecuteAction}
            onWidgetTrigger={(widgetId, trigger, metadata) => {
              if (trigger !== 'scratch-complete') return;
              const completedAtMs = Number(metadata?.completedAtMs ?? playheadMs);
              setScratchCompletionMsByWidgetId((current) => (
                current[widgetId] === completedAtMs
                  ? current
                  : { ...current, [widgetId]: completedAtMs }
              ));
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
