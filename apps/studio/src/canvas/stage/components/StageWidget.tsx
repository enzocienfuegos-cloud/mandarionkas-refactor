import { memo, useCallback, useMemo, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react';
import { getWidgetActions } from '../../../actions/runtime';
import { renderWidgetContents } from '../render-widget';
import type { ActionNode, WidgetFrame, WidgetNode, StudioState } from '../../../domain/document/types';
import type { ResizeHandle } from '../use-stage-controller';
import { createStageInteractionProps, STAGE_INTERACTION } from '../stage-interaction-targets';
import { isNativeStageDragWidgetType } from '../../../domain/document/widget-type-groups';
import { MotionLayer } from '../../../motion/react/MotionLayer';
import { useLatestRef } from '../../../shared/hooks';
import { usePlayheadRef } from '../playhead-ref-context';

const HANDLE_SIZE = 10;
const showDebugWidgetTags = import.meta.env.DEV && import.meta.env.VITE_SHOW_WIDGET_TAGS === 'true';

type StageWidgetProps = {
  node: WidgetNode;
  stateRef: React.MutableRefObject<StudioState>;
  widgetsById: Record<string, WidgetNode>;
  frame: WidgetFrame;
  selected: boolean;
  primary: boolean;
  showBadge: boolean;
  onWidgetPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onResizePointerDown: (event: ReactPointerEvent<HTMLButtonElement>, handle: ResizeHandle) => void;
  previewMode: boolean;
  isReproducing: boolean;
  editModeWireframe: boolean;
  sceneDurationMs: number;
  hovered: boolean;
  active: boolean;
  onSetActiveWidget: (widgetId?: string) => void;
  onSetHoveredWidget: (widgetId?: string) => void;
  onExecuteAction: (actionId: string) => void;
  onGoToScene?: (sceneId: string) => void;
  onWidgetTrigger?: (widgetId: string, trigger: ActionNode['trigger'], metadata?: Record<string, unknown>) => void;
};

export const StageWidget = memo(function StageWidget({
  node,
  stateRef,
  widgetsById,
  frame,
  selected,
  primary,
  showBadge,
  onWidgetPointerDown,
  onResizePointerDown,
  previewMode,
  isReproducing,
  editModeWireframe,
  sceneDurationMs,
  hovered,
  active,
  onSetActiveWidget,
  onSetHoveredWidget,
  onExecuteAction,
  onGoToScene,
  onWidgetTrigger,
}: StageWidgetProps): JSX.Element {
  const playheadRef = usePlayheadRef();
  const managesNativeDrag = isNativeStageDragWidgetType(node.type);
  const useWireframe = !previewMode && editModeWireframe && !selected && !active && !hovered;
  const triggerDepsRef = useLatestRef({
    previewMode,
    onWidgetTrigger,
    onExecuteAction,
    stateRef,
    nodeId: node.id,
  });
  const triggerWidgetAction = useCallback((trigger: ActionNode['trigger'], metadata?: Record<string, unknown>) => {
    const deps = triggerDepsRef.current;
    if (!deps.previewMode) return;
    deps.onWidgetTrigger?.(deps.nodeId, trigger, metadata);
    const actions = getWidgetActions(deps.stateRef.current, deps.nodeId, trigger);
    actions.forEach((action) => deps.onExecuteAction(action.id));
  }, [triggerDepsRef]);
  const widgetStyle = buildStageWidgetStyle(node, frame, node.zIndex, {
    interactiveInPreview: previewMode && !managesNativeDrag,
    previewMode,
    hovered,
    active,
  });
  const widgetContentStyle = buildStageWidgetContentStyle(previewMode);
  const widgetRenderCtx = useMemo(() => ({
    previewMode,
    isReproducing,
    get playheadMs() {
      return playheadRef.current;
    },
    sceneDurationMs,
    hovered,
    active,
    widgetsById,
    state: stateRef.current,
    triggerWidgetAction,
    executeAction: onExecuteAction,
    goToScene: onGoToScene,
  }), [
    previewMode,
    isReproducing,
    sceneDurationMs,
    hovered,
    active,
    widgetsById,
    stateRef,
    playheadRef,
    triggerWidgetAction,
    onExecuteAction,
    onGoToScene,
  ]);

  return (
    <MotionLayer
      widget={node}
      widgetsById={widgetsById}
      previewMode={previewMode}
      isReproducing={isReproducing}
      data-stage-widget-id={node.id}
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
          widgetRenderCtx,
          { wireframe: useWireframe },
        )}
      </div>
      {!previewMode && showBadge && !useWireframe && showDebugWidgetTags ? <div className="edit-mode-label">{node.type} · {node.name}</div> : null}
      {selected ? <SelectionOverlay primary={primary} onResizePointerDown={onResizePointerDown} /> : null}
    </MotionLayer>
  );
}, stageWidgetPropsEqual);

function buildStageWidgetStyle(
  node: WidgetNode,
  frame: WidgetFrame,
  zIndex: number,
  {
    interactiveInPreview,
    previewMode,
    hovered,
    active,
  }: {
    interactiveInPreview: boolean;
    previewMode: boolean;
    hovered: boolean;
    active: boolean;
  },
): CSSProperties {
  const style: CSSProperties & Record<string, string | number | undefined> = {
    left: 0,
    top: 0,
    width: frame.width,
    height: frame.height,
    zIndex,
    cursor: interactiveInPreview ? 'pointer' : 'default',
    transform: `translate3d(${frame.x}px, ${frame.y}px, 0) rotate(${frame.rotation}deg)`,
    transformOrigin: '0 0',
    contain: 'layout paint',
    backfaceVisibility: 'hidden',
  };
  return style;
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
    && previous.showBadge === next.showBadge
    && previous.previewMode === next.previewMode
    && previous.isReproducing === next.isReproducing
    && previous.editModeWireframe === next.editModeWireframe
    && previous.sceneDurationMs === next.sceneDurationMs
    && previous.hovered === next.hovered
    && previous.active === next.active
    && previous.onSetActiveWidget === next.onSetActiveWidget
    && previous.onSetHoveredWidget === next.onSetHoveredWidget
    && previous.onExecuteAction === next.onExecuteAction
    && previous.onGoToScene === next.onGoToScene
    && previous.onWidgetTrigger === next.onWidgetTrigger;
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
