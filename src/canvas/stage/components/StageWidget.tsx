import { memo, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react';
import { getWidgetActions } from '../../../actions/runtime';
import { getWidgetActionTargetOptions, getWidgetActionTargetRect } from '../../../domain/document/action-targets';
import { renderWidgetContents } from '../render-widget';
import type { WidgetFrame, WidgetNode, StudioState } from '../../../domain/document/types';
import type { ResizeHandle } from '../use-stage-controller';

const HANDLE_SIZE = 10;

type StageWidgetProps = {
  node: WidgetNode;
  stateRef: React.MutableRefObject<StudioState>;
  actionTargetSignature: string;
  frame: WidgetFrame;
  selected: boolean;
  primary: boolean;
  opacity: number;
  onWidgetPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onResizePointerDown: (event: ReactPointerEvent<HTMLButtonElement>, handle: ResizeHandle) => void;
  previewMode: boolean;
  playheadMs: number;
  hovered: boolean;
  active: boolean;
  onSetActiveWidget: (widgetId?: string) => void;
  onSetHoveredWidget: (widgetId?: string) => void;
  onExecuteAction: (actionId: string) => void;
  onQuickAddTargetAction: (widgetId: string, targetKey: string, label: string) => void;
};

export const StageWidget = memo(function StageWidget({
  node,
  stateRef,
  actionTargetSignature,
  frame,
  selected,
  primary,
  opacity,
  onWidgetPointerDown,
  onResizePointerDown,
  previewMode,
  playheadMs,
  hovered,
  active,
  onSetActiveWidget,
  onSetHoveredWidget,
  onExecuteAction,
  onQuickAddTargetAction,
}: StageWidgetProps): JSX.Element {
  const triggerWidgetAction = (trigger: 'click' | 'hover') => {
    if (!previewMode) return;
    const actions = getWidgetActions(stateRef.current, node.id, trigger);
    actions.forEach((action) => onExecuteAction(action.id));
  };
  const targetOptions = getWidgetActionTargetOptions(node);
  const assignedTargetKeys = Array.from(new Set(
    Object.values(stateRef.current.document.actions)
      .filter((action) => action.widgetId === node.id && action.type === 'open-url' && action.url && action.targetKey)
      .map((action) => action.targetKey as string),
  ));
  const showTargetCoverage = !previewMode && selected && targetOptions.length > 0;

  return (
    <div
      className={`stage-widget ${selected ? 'is-selected' : ''} ${primary ? 'is-primary' : ''} ${hovered ? 'is-hovered' : ''} ${active ? 'is-active' : ''} ${previewMode ? 'is-preview-mode' : 'is-edit-mode'}`}
      onPointerDown={(event) => {
        if (previewMode) {
          event.stopPropagation();
          onSetActiveWidget(node.id);
          triggerWidgetAction('click');
          return;
        }
        onWidgetPointerDown(event);
      }}
      onPointerEnter={() => {
        onSetHoveredWidget(node.id);
        if (previewMode) triggerWidgetAction('hover');
      }}
      onPointerLeave={() => {
        onSetHoveredWidget(undefined);
      }}
      style={{
        left: frame.x,
        top: frame.y,
        width: frame.width,
        height: frame.height,
        opacity,
        zIndex: node.zIndex,
        cursor: previewMode ? 'pointer' : 'default',
        transform: `rotate(${frame.rotation}deg)`,
      }}
    >
      <div className="stage-widget-content">{renderWidgetContents(node, { previewMode, playheadMs, hovered, active, triggerWidgetAction })}</div>
      {!previewMode ? <div className="edit-mode-label">{node.type} · {node.name}</div> : null}
      {showTargetCoverage ? <TargetCoverageOverlay node={node} frame={frame} assignedTargetKeys={assignedTargetKeys} onQuickAddTargetAction={onQuickAddTargetAction} /> : null}
      {selected ? <SelectionOverlay primary={primary} onResizePointerDown={onResizePointerDown} /> : null}
    </div>
  );
}, stageWidgetPropsEqual);

function stageWidgetPropsEqual(previous: StageWidgetProps, next: StageWidgetProps): boolean {
  return previous.node === next.node
    && previous.stateRef === next.stateRef
    && previous.actionTargetSignature === next.actionTargetSignature
    && previous.frame === next.frame
    && previous.selected === next.selected
    && previous.primary === next.primary
    && previous.opacity === next.opacity
    && previous.previewMode === next.previewMode
    && previous.playheadMs === next.playheadMs
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

function TargetCoverageOverlay({
  node,
  frame,
  assignedTargetKeys,
  onQuickAddTargetAction,
}: {
  node: WidgetNode;
  frame: WidgetFrame;
  assignedTargetKeys: string[];
  onQuickAddTargetAction: StageWidgetProps['onQuickAddTargetAction'];
}): JSX.Element {
  const targetOptions = getWidgetActionTargetOptions(node);

  return (
    <div className="target-coverage-overlay" aria-hidden="true">
      {targetOptions.map((option) => {
        const rect = getWidgetActionTargetRect(node, option.value, frame);
        const assigned = assignedTargetKeys.includes(option.value);
        return (
          <button
            key={option.value}
            type="button"
            className={`target-coverage-zone ${assigned ? 'is-assigned' : 'is-open'} ${assigned ? 'is-readonly' : 'is-actionable'}`}
            style={{
              left: rect.x - frame.x,
              top: rect.y - frame.y,
              width: rect.width,
              height: rect.height,
            }}
            onPointerDown={(event) => {
              event.stopPropagation();
            }}
            onClick={(event) => {
              event.stopPropagation();
              if (assigned) return;
              onQuickAddTargetAction(node.id, option.value, option.label);
            }}
          >
            <span className="target-coverage-badge">{assigned ? 'assigned' : 'open'} · {option.label}</span>
          </button>
        );
      })}
    </div>
  );
}
