import { memo, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react';
import { getWidgetActions } from '../../../actions/runtime';
import { renderWidgetContents } from '../render-widget';
import type { ActionNode, WidgetFrame, WidgetNode, StudioState } from '../../../domain/document/types';
import type { ResizeHandle } from '../use-stage-controller';
import { createStageInteractionProps, STAGE_INTERACTION } from '../stage-interaction-targets';
import { isNativeStageDragWidgetType } from '../../../domain/document/widget-type-groups';

const HANDLE_SIZE = 10;
const showDebugWidgetTags = import.meta.env.DEV && import.meta.env.VITE_SHOW_WIDGET_TAGS === 'true';

type StageWidgetProps = {
  node: WidgetNode;
  stateRef: React.MutableRefObject<StudioState>;
  widgetsById: Record<string, WidgetNode>;
  frame: WidgetFrame;
  selected: boolean;
  primary: boolean;
  opacity: number;
  showBadge: boolean;
  onWidgetPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onResizePointerDown: (event: ReactPointerEvent<HTMLButtonElement>, handle: ResizeHandle) => void;
  previewMode: boolean;
  editModeWireframe: boolean;
  playheadMs: number;
  sceneDurationMs: number;
  hovered: boolean;
  active: boolean;
  onSetActiveWidget: (widgetId?: string) => void;
  onSetHoveredWidget: (widgetId?: string) => void;
  onExecuteAction: (actionId: string) => void;
};

export const StageWidget = memo(function StageWidget({
  node,
  stateRef,
  widgetsById,
  frame,
  selected,
  primary,
  opacity,
  showBadge,
  onWidgetPointerDown,
  onResizePointerDown,
  previewMode,
  editModeWireframe,
  playheadMs,
  sceneDurationMs,
  hovered,
  active,
  onSetActiveWidget,
  onSetHoveredWidget,
  onExecuteAction,
}: StageWidgetProps): JSX.Element {
  const managesNativeDrag = isNativeStageDragWidgetType(node.type);
  const useWireframe = !previewMode && editModeWireframe && !selected && !active && !hovered;
  const triggerWidgetAction = (trigger: ActionNode['trigger'], _metadata?: Record<string, unknown>) => {
    if (!previewMode) return;
    const actions = getWidgetActions(stateRef.current, node.id, trigger);
    actions.forEach((action) => onExecuteAction(action.id));
  };
  const widgetStyle = buildStageWidgetStyle(frame, opacity, node.zIndex, previewMode && !managesNativeDrag);
  const widgetContentStyle = buildStageWidgetContentStyle(previewMode);

  return (
    <div
      className={`stage-widget stage-widget--${node.type} ${selected ? 'is-selected' : ''} ${primary ? 'is-primary' : ''} ${hovered ? 'is-hovered' : ''} ${active ? 'is-active' : ''} ${previewMode ? 'is-preview-mode' : 'is-edit-mode'} ${useWireframe ? 'is-wireframe-mode' : ''}`}
      {...createStageInteractionProps(STAGE_INTERACTION.widget)}
      onPointerDown={(event) => {
        if (previewMode) {
          event.stopPropagation();
          onSetActiveWidget(node.id);
          if (managesNativeDrag) return;
          triggerWidgetAction('click');
          return;
        }
        onWidgetPointerDown(event);
      }}
      onPointerEnter={() => {
        onSetHoveredWidget(node.id);
        if (previewMode && !managesNativeDrag) {
          triggerWidgetAction('hover');
          triggerWidgetAction('hover-enter');
        }
      }}
      onPointerLeave={() => {
        onSetHoveredWidget(undefined);
        if (previewMode && !managesNativeDrag) triggerWidgetAction('hover-exit');
      }}
      style={widgetStyle}
    >
      <div className="stage-widget-content" style={widgetContentStyle}>
        {renderWidgetContents(
          node,
          {
            previewMode,
            playheadMs,
            sceneDurationMs,
            hovered,
            active,
            widgetsById,
            state: stateRef.current,
            triggerWidgetAction,
            executeAction: onExecuteAction,
          },
          { wireframe: useWireframe },
        )}
      </div>
      {!previewMode && showBadge && !useWireframe && showDebugWidgetTags ? <div className="edit-mode-label">{node.type} · {node.name}</div> : null}
      {selected ? <SelectionOverlay primary={primary} onResizePointerDown={onResizePointerDown} /> : null}
    </div>
  );
}, stageWidgetPropsEqual);

function buildStageWidgetStyle(
  frame: WidgetFrame,
  opacity: number,
  zIndex: number,
  interactiveInPreview: boolean,
): CSSProperties {
  return {
    left: frame.x,
    top: frame.y,
    width: frame.width,
    height: frame.height,
    opacity,
    zIndex,
    cursor: interactiveInPreview ? 'pointer' : 'default',
    transform: `rotate(${frame.rotation}deg)`,
  };
}

function buildStageWidgetContentStyle(previewMode: boolean): CSSProperties {
  return {
    pointerEvents: previewMode ? 'auto' : 'none',
  };
}

function stageWidgetPropsEqual(previous: StageWidgetProps, next: StageWidgetProps): boolean {
  return previous.node === next.node
    && previous.stateRef === next.stateRef
    && previous.widgetsById === next.widgetsById
    && previous.frame === next.frame
    && previous.selected === next.selected
    && previous.primary === next.primary
    && previous.opacity === next.opacity
    && previous.showBadge === next.showBadge
    && previous.previewMode === next.previewMode
    && previous.editModeWireframe === next.editModeWireframe
    && previous.playheadMs === next.playheadMs
    && previous.sceneDurationMs === next.sceneDurationMs
    && previous.hovered === next.hovered
    && previous.active === next.active;
}

function SelectionOverlay({ primary, onResizePointerDown }: { primary: boolean; onResizePointerDown: StageWidgetProps['onResizePointerDown'] }): JSX.Element {
  const handles: Array<{ key: ResizeHandle; style: CSSProperties }> = [
    { key: 'nw', style: { left: -HANDLE_SIZE / 2, top: -HANDLE_SIZE / 2, cursor: 'nwse-resize' } },
    { key: 'n', style: { left: `calc(50% - ${HANDLE_SIZE / 2}px)`, top: -HANDLE_SIZE / 2, cursor: 'ns-resize' } },
    { key: 'ne', style: { right: -HANDLE_SIZE / 2, top: -HANDLE_SIZE / 2, cursor: 'nesw-resize' } },
    { key: 'e', style: { right: -HANDLE_SIZE / 2, top: `calc(50% - ${HANDLE_SIZE / 2}px)`, cursor: 'ew-resize' } },
    { key: 'se', style: { right: -HANDLE_SIZE / 2, bottom: -HANDLE_SIZE / 2, cursor: 'nwse-resize' } },
    { key: 's', style: { left: `calc(50% - ${HANDLE_SIZE / 2}px)`, bottom: -HANDLE_SIZE / 2, cursor: 'ns-resize' } },
    { key: 'sw', style: { left: -HANDLE_SIZE / 2, bottom: -HANDLE_SIZE / 2, cursor: 'nesw-resize' } },
    { key: 'w', style: { left: -HANDLE_SIZE / 2, top: `calc(50% - ${HANDLE_SIZE / 2}px)`, cursor: 'ew-resize' } },
  ];

  return (
    <>
      <div className={`selection-outline ${primary ? 'is-primary' : ''}`} />
      {primary ? handles.map((handle) => (
        <button
          key={handle.key}
          type="button"
          className="selection-handle"
          style={handle.style}
          onPointerDown={(event) => onResizePointerDown(event, handle.key)}
        />
      )) : null}
    </>
  );
}
