export const ZOOM_MIN = 0.25;
export const ZOOM_MAX = 4;
export const EDGE_AUTOSCROLL_MARGIN = 56;
export const EDGE_AUTOSCROLL_MAX_STEP = 28;

export type RectLike = { left: number; top: number; width?: number; height?: number; right?: number; bottom?: number };
export type ClientPoint = { clientX: number; clientY: number };

export function clampZoom(value: number): number {
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, value));
}

export function normalizeWheelDelta(deltaY: number, deltaMode = 0): number {
  switch (deltaMode) {
    case 1:
      return deltaY * 16;
    case 2:
      return deltaY * 120;
    default:
      return deltaY;
  }
}

export function getNextZoomFromWheel(currentZoom: number, deltaY: number, deltaMode = 0): number {
  const normalized = normalizeWheelDelta(deltaY, deltaMode);
  if (!Number.isFinite(normalized) || normalized === 0) return clampZoom(currentZoom);
  const scaled = currentZoom * Math.exp((-normalized / 240) * 0.18);
  const next = clampZoom(scaled);
  return Math.abs(next - currentZoom) < 0.001 ? currentZoom : Number(next.toFixed(4));
}

export function getCursorAnchoredScrollDelta(args: {
  clientPoint: ClientPoint;
  beforeRect: RectLike;
  afterRect: RectLike;
  beforeZoom: number;
  afterZoom: number;
}): { x: number; y: number } {
  const { clientPoint, beforeRect, afterRect, beforeZoom, afterZoom } = args;
  const safeBeforeZoom = Math.max(beforeZoom, 0.0001);
  const safeAfterZoom = Math.max(afterZoom, 0.0001);
  const canvasX = (clientPoint.clientX - beforeRect.left) / safeBeforeZoom;
  const canvasY = (clientPoint.clientY - beforeRect.top) / safeBeforeZoom;
  const desiredLeft = clientPoint.clientX - canvasX * safeAfterZoom;
  const desiredTop = clientPoint.clientY - canvasY * safeAfterZoom;
  return {
    x: afterRect.left - desiredLeft,
    y: afterRect.top - desiredTop,
  };
}

export function getEdgeAutoScrollDelta(args: {
  clientPoint: ClientPoint;
  bounds: RectLike;
  margin?: number;
  maxStep?: number;
}): { x: number; y: number } {
  const { clientPoint, bounds, margin = EDGE_AUTOSCROLL_MARGIN, maxStep = EDGE_AUTOSCROLL_MAX_STEP } = args;
  const width = bounds.width ?? Math.max(0, (bounds.right ?? bounds.left) - bounds.left);
  const height = bounds.height ?? Math.max(0, (bounds.bottom ?? bounds.top) - bounds.top);
  if (width <= 0 || height <= 0) return { x: 0, y: 0 };

  const leftDistance = clientPoint.clientX - bounds.left;
  const rightDistance = bounds.left + width - clientPoint.clientX;
  const topDistance = clientPoint.clientY - bounds.top;
  const bottomDistance = bounds.top + height - clientPoint.clientY;

  return {
    x: getEdgeAxisAutoScroll(leftDistance, rightDistance, margin, maxStep),
    y: getEdgeAxisAutoScroll(topDistance, bottomDistance, margin, maxStep),
  };
}

export function applyEdgeAutoScroll(args: {
  workspace: HTMLDivElement | null;
  clientPoint: ClientPoint;
  margin?: number;
  maxStep?: number;
}): { x: number; y: number } {
  const { workspace, clientPoint, margin, maxStep } = args;
  if (!workspace) return { x: 0, y: 0 };
  const delta = getEdgeAutoScrollDelta({
    clientPoint,
    bounds: workspace.getBoundingClientRect(),
    margin,
    maxStep,
  });
  if (delta.x || delta.y) {
    workspace.scrollLeft += delta.x;
    workspace.scrollTop += delta.y;
  }
  return delta;
}

function getEdgeAxisAutoScroll(startDistance: number, endDistance: number, margin: number, maxStep: number): number {
  if (startDistance < margin) return -getAutoScrollStep(startDistance, margin, maxStep);
  if (endDistance < margin) return getAutoScrollStep(endDistance, margin, maxStep);
  return 0;
}

function getAutoScrollStep(distance: number, margin: number, maxStep: number): number {
  const clampedDistance = Math.max(0, Math.min(distance, margin));
  const intensity = (margin - clampedDistance) / Math.max(margin, 1);
  if (intensity <= 0) return 0;
  return Math.max(4, Math.round(maxStep * intensity));
}
