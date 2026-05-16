import { memo, useEffect, useRef, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react';
import { getWidgetActions } from '../../../actions/runtime';
import { renderWidgetContents } from '../render-widget';
import type { ActionNode, WidgetFrame, WidgetNode, StudioState } from '../../../domain/document/types';
import type { ResizeHandle } from '../use-stage-controller';
import { createStageInteractionProps, STAGE_INTERACTION } from '../stage-interaction-targets';
import { isNativeStageDragWidgetType } from '../../../domain/document/widget-type-groups';
import { getAnimationPresetConfig } from '../../../inspector/sections/animation-presets';

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
  const rootRef = useRef<HTMLDivElement | null>(null);
  const triggerWidgetAction = (trigger: ActionNode['trigger'], _metadata?: Record<string, unknown>) => {
    if (!previewMode) return;
    const actions = getWidgetActions(stateRef.current, node.id, trigger);
    actions.forEach((action) => onExecuteAction(action.id));
  };
  const widgetStyle = buildStageWidgetStyle(node, frame, opacity, node.zIndex, {
    interactiveInPreview: previewMode && !managesNativeDrag,
    previewMode,
    hovered,
    active,
  });
  const widgetContentStyle = buildStageWidgetContentStyle(previewMode);

  useEffect(() => {
    const root = rootRef.current;
    if (!root || useWireframe || typeof root.animate !== 'function') return;
    const config = getAnimationPresetConfig(node);
    if (!config.preset) return;

    root.getAnimations?.().forEach((animation) => animation.cancel());
    const baseTransform = `rotate(${frame.rotation}deg)`;
    const baseOpacity = opacity;
    const distancePx = Math.max(0, config.distancePx);
    const pulseOpacity = Math.max(0.15, baseOpacity - config.intensity * 0.45);
    const holdOffset = config.preset === 'fade-out' ? 0.45 : 0.58;
    const keyframes =
      config.preset === 'appear'
        ? [
            { opacity: 0, transform: baseTransform, offset: 0 },
            { opacity: baseOpacity, transform: baseTransform, offset: holdOffset },
            { opacity: baseOpacity, transform: baseTransform, offset: 1 },
          ]
        : config.preset === 'fade-up'
          ? [
              { opacity: 0, transform: `${baseTransform} translateY(${distancePx}px)`, offset: 0 },
              { opacity: baseOpacity, transform: baseTransform, offset: holdOffset },
              { opacity: baseOpacity, transform: baseTransform, offset: 1 },
            ]
          : config.preset === 'fade-out'
            ? [
                { opacity: baseOpacity, transform: baseTransform, offset: 0 },
                { opacity: baseOpacity, transform: baseTransform, offset: holdOffset },
                { opacity: 0, transform: baseTransform, offset: 1 },
              ]
            : [
                { opacity: baseOpacity, transform: baseTransform, offset: 0 },
                { opacity: pulseOpacity, transform: baseTransform, offset: 0.4 },
              { opacity: baseOpacity, transform: baseTransform, offset: 1 },
            ];

    const duration = Math.max(300, Number(config.durationMs || 700));
    const idlePaddingMs = config.preset === 'pulse' ? 220 : 420;
    if (previewMode) {
      const animation = root.animate(keyframes, {
        duration,
        delay: Math.max(0, Number(config.delayMs || 0)),
        easing: config.preset === 'pulse' ? 'ease-in-out' : 'ease-out',
        iterations: config.repeatMode === 'repeat' ? Number.POSITIVE_INFINITY : 1,
        fill: 'both',
      });
      animation.pause();

      const startMs = Math.max(0, Number(node.timeline.startMs ?? 0));
      const endMs = Math.max(startMs + 100, Number(node.timeline.endMs ?? startMs + duration));
      const anchorMs = config.preset === 'fade-out'
        ? Math.max(startMs, endMs - duration)
        : startMs;
      const totalCycleMs = duration + Math.max(0, Number(config.delayMs || 0));
      const elapsedMs = playheadMs - anchorMs;
      const currentTime = config.repeatMode === 'repeat'
        ? (((elapsedMs % totalCycleMs) + totalCycleMs) % totalCycleMs)
        : Math.max(0, Math.min(totalCycleMs, elapsedMs));
      animation.currentTime = currentTime;

      return () => {
        animation.cancel();
      };
    }

    if (!selected) return;

    const animation = root.animate(keyframes, {
      duration: duration + idlePaddingMs,
      delay: Math.max(0, Number(config.delayMs || 0)),
      easing: config.preset === 'pulse' ? 'ease-in-out' : 'ease-out',
      iterations: config.repeatMode === 'repeat' ? Number.POSITIVE_INFINITY : 1,
      fill: config.repeatMode === 'repeat' ? 'none' : 'both',
    });

    return () => {
      animation.cancel();
    };
  }, [frame.rotation, node, opacity, playheadMs, previewMode, selected, useWireframe]);

  return (
    <div
      ref={rootRef}
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
  node: WidgetNode,
  frame: WidgetFrame,
  opacity: number,
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
  const rotationTransform = `rotate(${frame.rotation}deg)`;
  const hoverMotionPreset = String(node.style.hoverMotionPreset ?? 'none');
  const hoverMotionDurationMs = Math.max(120, Number(node.style.hoverMotionDurationMs ?? 240));
  const hoverMotionDistancePx = Math.max(0, Number(node.style.hoverMotionDistancePx ?? 12));
  const hoverMotionScale = Math.max(1, Number(node.style.hoverMotionScale ?? 1.04));
  const isHoverMotionActive = previewMode && (hovered || active) && hoverMotionPreset !== 'none';
  const hoverTransform = hoverMotionPreset === 'zoom'
    ? `${rotationTransform} scale(${hoverMotionScale})`
    : `${rotationTransform} translateY(-${hoverMotionDistancePx}px) scale(${hoverMotionScale})`;

  const style: CSSProperties & Record<string, string | number | undefined> = {
    left: frame.x,
    top: frame.y,
    width: frame.width,
    height: frame.height,
    opacity,
    zIndex,
    cursor: interactiveInPreview ? 'pointer' : 'default',
    transform: hoverMotionPreset === 'pulse'
      ? rotationTransform
      : isHoverMotionActive
        ? hoverTransform
        : rotationTransform,
    transition: previewMode && hoverMotionPreset !== 'none'
      ? `transform ${hoverMotionDurationMs}ms ease, box-shadow ${hoverMotionDurationMs}ms ease, filter ${hoverMotionDurationMs}ms ease, opacity ${hoverMotionDurationMs}ms ease`
      : undefined,
    animation: previewMode && hoverMotionPreset === 'pulse' && isHoverMotionActive
      ? `smx-stage-hover-pulse ${hoverMotionDurationMs}ms ease-in-out infinite`
      : undefined,
    '--smx-motion-base-transform': rotationTransform,
    '--smx-motion-hover-transform': hoverTransform,
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
