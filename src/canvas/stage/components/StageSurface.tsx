import type { PointerEvent as ReactPointerEvent, RefObject } from 'react';
import { getLiveWidgetFrame, getLiveWidgetOpacity } from '../../../domain/document/timeline';
import type { WidgetNode } from '../../../domain/document/types';
import type { ResizeHandle } from '../use-stage-controller';
import { StageWidget } from './StageWidget';
import { StageDropPreviewOverlay } from './StageDropPreviewOverlay';
import { rectStyle, sceneTransitionOpacity, sceneTransitionTransform, toRect } from './stage-utils';

type StageSurfaceProps = {
  stageRef: RefObject<HTMLDivElement>;
  canvas: { width: number; height: number; backgroundColor: string };
  widgets: WidgetNode[];
  selectedIds: string[];
  previewMode: boolean;
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
  onQuickAddTargetAction: (widgetId: string, targetKey: string, label: string) => void;
};

export function StageSurface({
  stageRef,
  canvas,
  widgets,
  selectedIds,
  previewMode,
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
  onQuickAddTargetAction,
}: StageSurfaceProps): JSX.Element {
  const stageDropActive = Boolean(dropPreview);
  const transitionDuration = Math.max(120, sceneTransitionDurationMs);

  return (
    <div
      className={`stage-surface ${previewMode ? 'is-preview-mode' : 'is-edit-mode'} ${stageDropActive ? 'is-drop-target' : ''} ${dropPreview && !dropPreview.inBounds ? 'is-drop-invalid' : ''}`}
      ref={stageRef}
      onPointerDown={onStagePointerDown}
      onDragOver={onStageDragOver}
      onDragLeave={onStageDragLeave}
      onDrop={onStageDrop}
      style={{
        width: canvas.width,
        height: canvas.height,
        background: canvas.backgroundColor,
        transform: `scale(${zoom}) ${sceneTransitionTransform(sceneTransitionType, sceneTransitionActive)}`,
        transformOrigin: 'top left',
        opacity: sceneTransitionOpacity(sceneTransitionType, sceneTransitionActive),
        transition: `transform ${transitionDuration}ms ease, opacity ${transitionDuration}ms ease`,
      }}
    >
      {widgets.map((widget) => {
        const frame = liveFrameById[widget.id] ?? getLiveWidgetFrame(widget, playheadMs);
        if (!isWidgetVisible(widget.id)) return null;
        const actionTargetSignature = Object.values(stateRef.current.document.actions)
          .filter((action) => action.widgetId === widget.id)
          .map((action) => `${action.id}:${action.type}:${action.targetKey ?? ''}:${action.url ?? ''}`)
          .sort()
          .join('|');

        return (
          <StageWidget
            key={widget.id}
            node={widget}
            stateRef={stateRef}
            actionTargetSignature={actionTargetSignature}
            selected={selectedIds.includes(widget.id) && !previewMode}
            primary={selectedIds[0] === widget.id && !previewMode}
            frame={frame}
            opacity={getLiveWidgetOpacity(widget, playheadMs)}
            previewMode={previewMode}
            playheadMs={playheadMs}
            hovered={hoveredWidgetId === widget.id}
            active={activeWidgetId === widget.id}
            onSetActiveWidget={onSetActiveWidget}
            onSetHoveredWidget={onSetHoveredWidget}
            onExecuteAction={onExecuteAction}
            onQuickAddTargetAction={onQuickAddTargetAction}
            onWidgetPointerDown={(event) => onWidgetPointerDown(event, widget.id, Boolean(widget.locked))}
            onResizePointerDown={(event, handle) => onResizePointerDown(event, widget.id, Boolean(widget.locked), handle)}
          />
        );
      })}
      {marquee ? <div className="marquee-rect" style={rectStyle(toRect(marquee.origin, marquee.current))} /> : null}
      {dropPreview ? <StageDropPreviewOverlay preview={dropPreview} /> : null}
      {!previewMode && showStageRulers ? (
        <>
          <div className="stage-guide stage-guide-horizontal" style={{ top: Math.round(canvas.height / 2) }} />
          <div className="stage-guide stage-guide-vertical" style={{ left: Math.round(canvas.width / 2) }} />
        </>
      ) : null}
      <div className="playhead-overlay" style={{ left: Math.round((playheadMs / sceneDurationMs) * canvas.width) }} />
    </div>
  );
}
