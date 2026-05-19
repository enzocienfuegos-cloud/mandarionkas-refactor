import { useCallback, useEffect, useRef, useState } from 'react';
import { getLiveWidgetFrame } from '../../../domain/document/timeline';
import type { StudioState, WidgetFrame } from '../../../domain/document/types';
import type { InteractionState, ResizeHandle } from '../stage-types';
import { applyEdgeAutoScroll } from './stage-viewport';
import { clamp, expandStageSelection, getCanvasPoint, getResizedFrame } from './stage-geometry';

const DRAG_ACTIVATION_DISTANCE_PX = 4;

function applyFrameToElement(element: HTMLElement, frame: WidgetFrame): void {
  const nextTransform = `translate3d(${frame.x}px, ${frame.y}px, 0) rotate(${frame.rotation}deg)`;
  if (element.dataset.frameTransform !== nextTransform) {
    element.style.transform = nextTransform;
    element.dataset.frameTransform = nextTransform;
  }

  const nextWidth = String(frame.width);
  if (element.dataset.frameWidth !== nextWidth) {
    element.style.width = `${frame.width}px`;
    element.dataset.frameWidth = nextWidth;
  }

  const nextHeight = String(frame.height);
  if (element.dataset.frameHeight !== nextHeight) {
    element.style.height = `${frame.height}px`;
    element.dataset.frameHeight = nextHeight;
  }
}

export function useStageTransformController(args: {
  workspaceRef: React.RefObject<HTMLDivElement>;
  stageRef: React.RefObject<HTMLDivElement>;
  zoom: number;
  previewMode: boolean;
  canvas: { width: number; height: number };
  playheadMs: number;
  fullStateRef: React.MutableRefObject<StudioState>;
  widgetsById: StudioState['document']['widgets'];
  selectWidget: (widgetId: string | null, additive?: boolean) => void;
  updateWidgetFrames: (updates: Array<{ widgetId: string; patch: import('../../../domain/document/types').WidgetFrame }>) => void;
}) {
  const { workspaceRef, stageRef, zoom, previewMode, canvas, playheadMs, fullStateRef, widgetsById, selectWidget, updateWidgetFrames } = args;
  const [interaction, setInteraction] = useState<InteractionState | null>(null);
  const liveFramesRef = useRef<Record<string, WidgetFrame>>({});
  const dragActivatedRef = useRef(false);
  const activePointerIdRef = useRef<number | null>(null);
  const rafIdRef = useRef<number | null>(null);
  const draggedElementsRef = useRef(new Map<string, HTMLElement>());

  useEffect(() => {
    if (!interaction) return;

    liveFramesRef.current = { ...interaction.liveFrames };
    dragActivatedRef.current = Boolean(interaction.dragActivated);
    draggedElementsRef.current = new Map(
      interaction.widgetIds
        .map((widgetId) => {
          const element = stageRef.current?.querySelector<HTMLElement>(`[data-stage-widget-id="${widgetId}"]`);
          return element ? [widgetId, element] as const : null;
        })
        .filter(Boolean) as Array<readonly [string, HTMLElement]>,
    );

    const flushFrame = () => {
      rafIdRef.current = null;
      const frames = liveFramesRef.current;
      draggedElementsRef.current.forEach((element, widgetId) => {
        const frame = frames[widgetId];
        if (!frame) return;
        applyFrameToElement(element, frame);
      });
    };

    const scheduleFrame = () => {
      if (rafIdRef.current !== null) return;
      rafIdRef.current = window.requestAnimationFrame(flushFrame);
    };

    const restoreStartFrames = () => {
      draggedElementsRef.current.forEach((element, widgetId) => {
        const frame = interaction.startFrames[widgetId];
        if (!frame) return;
        applyFrameToElement(element, frame);
      });
    };

    const clearInteraction = () => {
      if (rafIdRef.current !== null) {
        window.cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
      activePointerIdRef.current = null;
      draggedElementsRef.current.clear();
      setInteraction(null);
    };

    const handlePointerMove = (event: PointerEvent) => {
      if (activePointerIdRef.current !== null && event.pointerId !== activePointerIdRef.current) return;
      event.preventDefault();
      applyEdgeAutoScroll({ workspace: workspaceRef.current, clientPoint: { clientX: event.clientX, clientY: event.clientY } });
      const point = getCanvasPoint(event, stageRef.current, zoom);
      if (!point) return;
      const primaryId = interaction.widgetIds[0];
      const primaryFrame = interaction.startFrames[primaryId];
      if (!primaryFrame) return;
      if (interaction.mode === 'drag') {
        const dx = point.x - interaction.origin.x;
        const dy = point.y - interaction.origin.y;
        if (!dragActivatedRef.current && Math.hypot(dx, dy) < DRAG_ACTIVATION_DISTANCE_PX) return;
        dragActivatedRef.current = true;
        const liveFrames: Record<string, WidgetFrame> = {};
        interaction.widgetIds.forEach((widgetId) => {
          const startFrame = interaction.startFrames[widgetId];
          liveFrames[widgetId] = {
            ...startFrame,
            x: clamp(startFrame.x + dx, 0, canvas.width - startFrame.width),
            y: clamp(startFrame.y + dy, 0, canvas.height - startFrame.height),
          };
        });
        liveFramesRef.current = liveFrames;
        scheduleFrame();
        return;
      }
      const resized = getResizedFrame(primaryFrame, interaction.origin, point, interaction.handle ?? 'se', canvas, interaction.keepAspectRatio);
      liveFramesRef.current = {
        ...liveFramesRef.current,
        [primaryId]: resized,
      };
      scheduleFrame();
    };

    const handlePointerUp = (event: PointerEvent) => {
      if (activePointerIdRef.current !== null && event.pointerId !== activePointerIdRef.current) return;
      if (interaction.mode === 'drag' && !dragActivatedRef.current) {
        clearInteraction();
        return;
      }
      const nextFrames = liveFramesRef.current;
      clearInteraction();
      updateWidgetFrames(interaction.widgetIds.map((widgetId) => ({ widgetId, patch: nextFrames[widgetId] ?? interaction.startFrames[widgetId] })));
    };

    const handlePointerCancel = (event: PointerEvent) => {
      if (activePointerIdRef.current !== null && event.pointerId !== activePointerIdRef.current) return;
      restoreStartFrames();
      clearInteraction();
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      restoreStartFrames();
      clearInteraction();
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerCancel);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerCancel);
      window.removeEventListener('keydown', handleKeyDown);
      if (rafIdRef.current !== null) {
        window.cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
      activePointerIdRef.current = null;
      draggedElementsRef.current.clear();
    };
  }, [canvas, interaction, stageRef, updateWidgetFrames, workspaceRef, zoom]);

  const beginWidgetDrag = useCallback((event: PointerEvent | MouseEvent, widgetId: string, locked: boolean, additive: boolean) => {
    if (previewMode || locked) return;
    selectWidget(widgetId, additive);
    const point = getCanvasPoint(event as PointerEvent, stageRef.current, zoom);
    if (!point) return;
    const selectedState = fullStateRef.current.document.selection.widgetIds;
    const baseIds = additive ? selectedState : (selectedState.includes(widgetId) ? selectedState : [widgetId]);
    const interactionIds = expandStageSelection(baseIds.length ? baseIds : [widgetId], widgetsById);
    const fallbackWidget = widgetsById[widgetId];
    const startFrames = Object.fromEntries(
      interactionIds.map((id) => [id, getLiveWidgetFrame(widgetsById[id] ?? fallbackWidget, playheadMs)]),
    );
    activePointerIdRef.current = 'pointerId' in event && typeof event.pointerId === 'number' ? event.pointerId : null;
    setInteraction({
      widgetIds: interactionIds,
      mode: 'drag',
      dragActivated: false,
      origin: point,
      startFrames,
      liveFrames: startFrames,
      guides: [],
    });
  }, [fullStateRef, playheadMs, previewMode, selectWidget, stageRef, widgetsById, zoom]);

  const beginWidgetResize = useCallback((event: PointerEvent | MouseEvent, widgetId: string, locked: boolean, handle: ResizeHandle) => {
    if (previewMode || locked) return;
    selectWidget(widgetId);
    const point = getCanvasPoint(event as PointerEvent, stageRef.current, zoom);
    if (!point) return;
    const widget = widgetsById[widgetId];
    if (!widget) return;
    const startFrames = { [widget.id]: getLiveWidgetFrame(widget, playheadMs) };
    activePointerIdRef.current = 'pointerId' in event && typeof event.pointerId === 'number' ? event.pointerId : null;
    setInteraction({
      widgetIds: [widget.id],
      mode: 'resize',
      handle,
      keepAspectRatio: Boolean(widget.props.lockAspectRatio),
      origin: point,
      startFrames,
      liveFrames: startFrames,
      guides: [],
    });
  }, [playheadMs, previewMode, selectWidget, stageRef, widgetsById, zoom]);

  return { interaction, setInteraction, beginWidgetDrag, beginWidgetResize };
}
