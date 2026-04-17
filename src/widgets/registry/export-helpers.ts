import type { WidgetNode } from '../../domain/document/types';

export function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function getBaseWidgetStyle(node: WidgetNode): string {
  const frame = node.frame;
  const style = node.style ?? {};
  return [
    `position:absolute`,
    `left:${frame.x}px`,
    `top:${frame.y}px`,
    `width:${frame.width}px`,
    `height:${frame.height}px`,
    `transform:rotate(${frame.rotation}deg)`,
    `opacity:${Number(style.opacity ?? 1)}`,
    `display:flex`,
    `align-items:center`,
    `justify-content:center`,
    `overflow:hidden`,
    `box-sizing:border-box`,
    `border-radius:${Number(style.borderRadius ?? 12)}px`,
    `background:${escapeHtml(style.backgroundColor ?? 'transparent')}`,
    `color:${escapeHtml(style.color ?? '#ffffff')}`,
    `font-size:${Number(style.fontSize ?? 18)}px`,
    `font-weight:${Number(style.fontWeight ?? 700)}`,
    `border:1px solid ${escapeHtml(style.borderColor ?? 'rgba(255,255,255,0.14)')}`,
    `padding:8px`,
    `text-align:center`,
  ].join(';');
}

export function renderGenericExport(node: WidgetNode, label?: string, detail?: string): string {
  const base = getBaseWidgetStyle(node);
  return `<div class="widget widget-module" data-widget-id="${node.id}" style="${base};flex-direction:column;gap:6px;"><strong>${escapeHtml(label ?? node.name)}</strong>${detail ? `<span style="font-size:12px;opacity:.8;">${escapeHtml(detail)}</span>` : ''}</div>`;
}
