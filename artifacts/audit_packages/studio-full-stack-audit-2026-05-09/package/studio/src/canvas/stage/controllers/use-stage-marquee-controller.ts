import { useCallback, useEffect, useState } from 'react';
import { getLiveWidgetFrame } from '../../../domain/document/timeline';
import type { WidgetNode } from '../../../domain/document/types';
import type { MarqueeState } from '../stage-types';
import { applyEdgeAutoScroll } from './stage-viewport';
import { getCanvasPoint, intersectsRect, toRect } from './stage-geometry';

export function useStageMarqueeController(args: {
  workspaceRef: React.RefObject<HTMLDivElement>;
  stageRef: React.RefObject<HTMLDivElement>;
  zoom: number;
  previewMode: boolean;
  widgets: WidgetNode[];
  playheadMs: number;
  selectWidget: (widgetId: string | null, additive?: boolean) => void;
  selectWidgets: (widgetIds: string[], activeWidgetId?: string) => void;
}) {
  const { workspaceRef, stageRef, zoom, previewMode, widgets, playheadMs, selectWidget, selectWidgets } = args;
  const [marquee, setMarquee] = useState<MarqueeState | null>(null);

  useEffect(() => {
    if (!marquee) return;
    const handlePointerMove = (event: PointerEvent) => {
      applyEdgeAutoScroll({ workspace: workspaceRef.current, clientPoint: { clientX: event.clientX, clientY: event.clientY } });
      const point = getCanvasPoint(event, stageRef.current, zoom);
      if (!point) return;
      setMarquee((current) => current ? { ...current, current: point } : current);
    };
    const handlePointerUp = () => {
      const rect = toRect(marquee.origin, marquee.current);
      const selected = widgets
        .filter((widget) => !widget.hidden && !widget.locked)
        .filter((widget) => intersectsRect(rect, getLiveWidgetFrame(widget, playheadMs)))
        .map((widget) => widget.id);
      selectWidgets(selected, selected[0]);
      setMarquee(null);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setMarquee(null);
    };
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp, { once: true });
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [marquee, playheadMs, selectWidgets, stageRef, widgets, workspaceRef, zoom]);

  const beginMarqueeSelection = useCallback((event: PointerEvent | MouseEvent) => {
    if (previewMode) return;
    const point = getCanvasPoint(event as PointerEvent, stageRef.current, zoom);
    if (!point) return;
    selectWidget(null);
    setMarquee({ origin: point, current: point });
  }, [previewMode, selectWidget, stageRef, zoom]);

  return { marquee, beginMarqueeSelection };
}
