/**
 * Shared canvas/paint utilities used by both editor (group.renderer.tsx) and
 * export (export/runtime/scratch.ts, widgets/group/group.export.ts).
 *
 * Keep this file free of React, WidgetNode, and any editor-specific imports.
 */

export function isTransparentPaint(value: unknown): boolean {
  const normalized = String(value ?? '').trim().toLowerCase();
  return (
    !normalized
    || normalized === 'transparent'
    || normalized === 'none'
    || normalized === 'rgba(0,0,0,0)'
    || normalized === 'rgba(0, 0, 0, 0)'
  );
}

export function isPlainWhite(value: unknown): boolean {
  const normalized = String(value ?? '').trim().toLowerCase();
  return (
    normalized === '#fff'
    || normalized === '#ffffff'
    || normalized === 'white'
    || normalized === 'rgb(255,255,255)'
    || normalized === 'rgb(255, 255, 255)'
    || normalized === 'rgba(255,255,255,1)'
    || normalized === 'rgba(255, 255, 255, 1)'
  );
}

export function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  radius: number,
): void {
  const safeRadius = Math.max(0, Math.min(radius, width / 2, height / 2));
  ctx.beginPath();
  if (typeof ctx.roundRect === 'function') {
    ctx.roundRect(0, 0, width, height, safeRadius);
    return;
  }
  ctx.moveTo(safeRadius, 0);
  ctx.lineTo(width - safeRadius, 0);
  ctx.quadraticCurveTo(width, 0, width, safeRadius);
  ctx.lineTo(width, height - safeRadius);
  ctx.quadraticCurveTo(width, height, width - safeRadius, height);
  ctx.lineTo(safeRadius, height);
  ctx.quadraticCurveTo(0, height, 0, height - safeRadius);
  ctx.lineTo(0, safeRadius);
  ctx.quadraticCurveTo(0, 0, safeRadius, 0);
  ctx.closePath();
}
