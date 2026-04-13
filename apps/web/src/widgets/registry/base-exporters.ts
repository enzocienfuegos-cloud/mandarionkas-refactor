import type { WidgetNode } from '../../domain/document/types';
import { escapeHtml, getBaseWidgetStyle, renderGenericExport } from './export-helpers';

export function renderTextExport(node: WidgetNode): string {
  const base = `${getBaseWidgetStyle(node)};background:transparent;border:none;justify-content:flex-start;align-items:flex-start;padding:0;`;
  return `<div class="widget widget-text" data-widget-id="${node.id}" style="${base}">${escapeHtml(node.props.text ?? '')}</div>`;
}

export function renderCtaExport(node: WidgetNode): string {
  const base = `${getBaseWidgetStyle(node)};cursor:pointer;`;
  return `<button class="widget widget-cta" data-widget-id="${node.id}" style="${base}">${escapeHtml(node.props.text ?? node.name)}</button>`;
}

export function renderImageExport(node: WidgetNode, kind: 'image' | 'hero-image' = 'image'): string {
  const detail = escapeHtml(String(node.props.alt ?? (kind === 'hero-image' ? 'Hero image' : 'Image placeholder')));
  return renderGenericExport(node, node.name, detail);
}

export function renderVideoExport(node: WidgetNode): string {
  return renderGenericExport(node, node.name, 'Video hero');
}

export function renderShapeExport(node: WidgetNode): string {
  const base = getBaseWidgetStyle(node);
  return `<div class="widget widget-shape" data-widget-id="${node.id}" style="${base};"></div>`;
}
