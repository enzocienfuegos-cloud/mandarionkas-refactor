import type { WidgetNode } from '../../domain/document/types';
import {
  composeWidgetAlignment,
  composeWidgetFrame,
  composeWidgetTypography,
} from '../../domain/widget-schema/compose-style';

export function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** @deprecated use composeWidgetAlignment */
export function resolveExportHorizontalAlign(node: WidgetNode): 'flex-start' | 'center' | 'flex-end' {
  return composeWidgetAlignment(node).horizontal;
}

/** @deprecated use composeWidgetAlignment */
export function resolveExportVerticalAlign(node: WidgetNode): 'flex-start' | 'center' | 'flex-end' {
  return composeWidgetAlignment(node).vertical;
}

/** @deprecated use composeWidgetAlignment */
export function resolveExportTextAlign(node: WidgetNode): 'left' | 'center' | 'right' {
  return composeWidgetAlignment(node).text;
}

export function getBaseWidgetStyle(node: WidgetNode): string {
  const layout = composeWidgetFrame(node);
  const alignment = composeWidgetAlignment(node);
  const typography = composeWidgetTypography(node, 'export-inline-string');
  const style = node.style ?? {};
  return [
    `position:absolute`,
    `left:${layout.left}px`,
    `top:${layout.top}px`,
    `width:${layout.width}px`,
    `height:${layout.height}px`,
    `transform:rotate(${layout.rotation}deg)`,
    `opacity:${layout.opacity}`,
    `display:flex`,
    `align-items:${alignment.vertical}`,
    `justify-content:${alignment.horizontal}`,
    `overflow:hidden`,
    `box-sizing:border-box`,
    `border-radius:${Number(style.borderRadius ?? 12)}px`,
    `background:${escapeHtml(style.backgroundColor ?? 'transparent')}`,
    `color:${escapeHtml(style.color ?? '#ffffff')}`,
    typography,
  ].join(';');
}

export function renderGenericExport(node: WidgetNode, label?: string, detail?: string): string {
  const base = getBaseWidgetStyle(node);
  const style = node.style ?? {};
  const genericExtras = [
    `border:1px solid ${escapeHtml(style.borderColor ?? 'rgba(255,255,255,0.14)')}`,
    `padding:8px`,
    `text-align:center`,
  ].join(';');
  return `<div class="widget widget-module" data-widget-id="${node.id}" style="${base};${genericExtras};flex-direction:column;gap:6px;"><strong>${escapeHtml(label ?? node.name)}</strong>${detail ? `<span style="font-size:12px;opacity:.8;">${escapeHtml(detail)}</span>` : ''}</div>`;
}
