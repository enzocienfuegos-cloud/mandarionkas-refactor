import { useCallback, useEffect, useState } from 'react';
import { getLiveWidgetFrame } from '../../../domain/document/timeline';
import type { StudioState } from '../../../domain/document/types';
import type { InteractionState, ResizeHandle } from '../stage-types';
import { applyEdgeAutoScroll } from './stage-viewport';
import { clamp, expandStageSelection, getCanvasPoint, getResizedFrame } from './stage-geometry';

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

  useEffect(() => {
    if (!interaction) return;
    const handlePointerMove = (event: PointerEvent) => {
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
        const liveFrames: Record<string, import('../../../domain/document/types').WidgetFrame> = {};
        interaction.widgetIds.forEach((widgetId) => {
          const startFrame = interaction.startFrames[widgetId];
          liveFrames[widgetId] = {
            ...startFrame,
            x: clamp(startFrame.x + dx, 0, canvas.width - startFrame.width),
            y: clamp(startFrame.y + dy, 0, canvas.height - startFrame.height),
          };
        });
        setInteraction((current) => current ? { ...current, liveFrames } : current);
        return;
      }
      const resized = getResizedFrame(primaryFrame, interaction.origin, point, interaction.handle ?? 'se', canvas);
      setInteraction((current) => current ? { ...current, liveFrames: { ...current.liveFrames, [primaryId]: resized } } : current);
    };
    const handlePointerUp = () => {
      updateWidgetFrames(interaction.widgetIds.map((widgetId) => ({ widgetId, patch: interaction.liveFrames[widgetId] })));
      setInteraction(null);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setInteraction(null);
    };
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp, { once: true });
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('keydown', handleKeyDown);
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
    setInteraction({ widgetIds: interactionIds, mode: 'drag', origin: point, startFrames, liveFrames: startFrames, guides: [] });
  }, [fullStateRef, playheadMs, previewMode, selectWidget, stageRef, widgetsById, zoom]);

  const beginWidgetResize = useCallback((event: PointerEvent | MouseEvent, widgetId: string, locked: boolean, handle: ResizeHandle) => {
    if (previewMode || locked) return;
    selectWidget(widgetId);
    const point = getCanvasPoint(event as PointerEvent, stageRef.current, zoom);
    if (!point) return;
    const widget = widgetsById[widgetId];
    if (!widget) return;
    const startFrames = { [widget.id]: getLiveWidgetFrame(widget, playheadMs) };
    setInteraction({ widgetIds: [widget.id], mode: 'resize', handle, origin: point, startFrames, liveFrames: startFrames, guides: [] });
  }, [playheadMs, previewMode, selectWidget, stageRef, widgetsById, zoom]);

  return { interaction, setInteraction, beginWidgetDrag, beginWidgetResize };
}
