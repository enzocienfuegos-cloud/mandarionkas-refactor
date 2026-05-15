import type { PointerEvent as ReactPointerEvent, RefObject } from 'react';
import type { CSSProperties } from 'react';
import { getLiveWidgetFrame, getLiveWidgetOpacity } from '../../../domain/document/timeline';
import type { WidgetNode } from '../../../domain/document/types';
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

  function isCoveredByScratchGroup(widget: WidgetNode): boolean {
    let currentParentId = widget.parentId;
    while (currentParentId) {
      const parent = widgetsById[currentParentId];
      if (!parent) return false;
      if (parent.type === 'group' && Boolean(parent.props.scratchEnabled)) return true;
      currentParentId = parent.parentId;
    }
    return false;
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
        const frame = liveFrameById[widget.id] ?? getLiveWidgetFrame(widget, playheadMs);
        if (!isWidgetVisible(widget.id)) return null;
        if (isCoveredByScratchGroup(widget)) return null;

        return (
          <StageWidget
            key={widget.id}
            node={widget}
            stateRef={stateRef}
            widgetsById={widgetsById}
            selected={selectedIds.includes(widget.id) && !previewMode}
            primary={selectedIds[0] === widget.id && !previewMode}
            frame={frame}
            opacity={getLiveWidgetOpacity(widget, playheadMs)}
            showBadge={showWidgetBadges}
            previewMode={previewMode}
            editModeWireframe={editModeWireframe}
            playheadMs={playheadMs}
            sceneDurationMs={sceneDurationMs}
            hovered={hoveredWidgetId === widget.id}
            active={activeWidgetId === widget.id}
            onSetActiveWidget={onSetActiveWidget}
            onSetHoveredWidget={onSetHoveredWidget}
            onExecuteAction={onExecuteAction}
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
      <div className="playhead-overlay" {...createStageInteractionProps(STAGE_INTERACTION.systemOverlay)} style={buildPlayheadOverlayStyle()} />
    </div>
  );
}
