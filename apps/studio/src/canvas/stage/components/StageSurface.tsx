import type { PointerEvent as ReactPointerEvent, RefObject } from 'react';
import type { CSSProperties } from 'react';
import { getLiveWidgetFrame, getLiveWidgetOpacity } from '../../../domain/document/timeline';
import type { WidgetFrame, WidgetNode } from '../../../domain/document/types';
import { getAnimationPresetConfig } from '../../../inspector/sections/animation-presets';
import type { ResizeHandle } from '../use-stage-controller';
import { StageWidget } from './StageWidget';
import { StageDropPreviewOverlay } from './StageDropPreviewOverlay';
import { rectStyle, sceneTransitionOpacity, sceneTransitionTransform, toRect } from './stage-utils';
import { createStageInteractionProps, STAGE_INTERACTION } from '../stage-interaction-targets';

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

  function resolveTemplateConfig(widget: WidgetNode) {
    const config = getAnimationPresetConfig(widget);
    return config.preset ? config : null;
  }

  function isCoveredByScratchGroup(widget: WidgetNode): boolean {
    if (!previewMode) return false;
    let currentParentId = widget.parentId;
    while (currentParentId) {
      const parent = widgetsById[currentParentId];
      if (!parent) return false;
      if (parent.type === 'group' && Boolean(parent.props.scratchEnabled)) return true;
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
        const selectedInEditor = !previewMode && selectedIds.includes(widget.id);
        const animationTemplateConfig = resolveTemplateConfig(widget);
        const animationTemplateActive = selectedInEditor && Boolean(animationTemplateConfig);
        const liveFrame = liveFrameById[widget.id] ?? getLiveWidgetFrame(widget, playheadMs);
        const frame = previewMode && widget.type === 'group' && Boolean(widget.props.scratchEnabled)
          ? resolveScratchGroupFrame(widget)
          : animationTemplateActive
            ? {
                ...liveFrame,
                y: animationTemplateConfig?.preset === 'fade-up' ? widget.frame.y : liveFrame.y,
              }
            : liveFrame;
        if (!isWidgetVisible(widget.id)) return null;
        if (isCoveredByScratchGroup(widget)) return null;
        const renderNode = frame === widget.frame ? widget : { ...widget, frame };
        const opacity = animationTemplateActive
          ? Number(widget.style.opacity ?? 1)
          : previewMode && animationTemplateConfig
            ? Number(widget.style.opacity ?? 1)
          : getLiveWidgetOpacity(renderNode, playheadMs);

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
