import type { StudioState, WidgetFrame } from '../../../domain/document/types';
import type { ResizeHandle } from '../stage-types';

export type CanvasPoint = { x: number; y: number };
export type ClientPoint = { clientX: number; clientY: number };

export function getCanvasPoint(event: ClientPoint, stage: HTMLDivElement | null, zoom: number): CanvasPoint | null {
  return clientPointToCanvasPoint({ clientX: event.clientX, clientY: event.clientY }, stage, zoom);
}

export function clientPointToCanvasPoint(point: ClientPoint, stage: HTMLDivElement | null, zoom: number): CanvasPoint | null {
  if (!stage) return null;
  const rect = stage.getBoundingClientRect();
  const safeZoom = Math.max(zoom, 0.0001);
  return {
    x: (point.clientX - rect.left) / safeZoom,
    y: (point.clientY - rect.top) / safeZoom,
  };
}

export function clampCanvasPoint(point: CanvasPoint, canvas: { width: number; height: number }): CanvasPoint {
  return {
    x: clamp(point.x, 0, canvas.width),
    y: clamp(point.y, 0, canvas.height),
  };
}

export function isCanvasPointWithinBounds(point: CanvasPoint, canvas: { width: number; height: number }): boolean {
  return point.x >= 0 && point.y >= 0 && point.x <= canvas.width && point.y <= canvas.height;
}

export function getResizedFrame(frame: WidgetFrame, origin: CanvasPoint, point: CanvasPoint, handle: ResizeHandle, canvas: { width: number; height: number }): WidgetFrame {
  const dx = point.x - origin.x;
  const dy = point.y - origin.y;
  const next = { ...frame };
  if (handle.includes('e')) next.width = Math.max(40, frame.width + dx);
  if (handle.includes('s')) next.height = Math.max(30, frame.height + dy);
  if (handle.includes('w')) {
    next.x = clamp(frame.x + dx, 0, frame.x + frame.width - 40);
    next.width = Math.max(40, frame.width - dx);
  }
  if (handle.includes('n')) {
    next.y = clamp(frame.y + dy, 0, frame.y + frame.height - 30);
    next.height = Math.max(30, frame.height - dy);
  }
  next.width = Math.min(next.width, canvas.width - next.x);
  next.height = Math.min(next.height, canvas.height - next.y);
  return next;
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function toRect(a: CanvasPoint, b: CanvasPoint) {
  return { left: Math.min(a.x, b.x), top: Math.min(a.y, b.y), width: Math.abs(a.x - b.x), height: Math.abs(a.y - b.y) };
}

export function intersectsRect(rect: { left: number; top: number; width: number; height: number }, frame: WidgetFrame) {
  return rect.left < frame.x + frame.width
    && rect.left + rect.width > frame.x
    && rect.top < frame.y + frame.height
    && rect.top + rect.height > frame.y;
}

export function expandStageSelection(ids: string[], widgetsById: StudioState['document']['widgets']): string[] {
  const resolved = new Set<string>();
  ids.forEach((id) => {
    const widget = widgetsById[id];
    if (!widget) return;
    resolved.add(id);
    (widget.childIds ?? []).forEach((childId: string) => resolved.add(childId));
    if (widget.parentId) resolved.add(widget.parentId);
  });
  return Array.from(resolved);
}
