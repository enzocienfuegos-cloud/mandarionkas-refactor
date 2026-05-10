import type { WidgetNode } from '../../domain/document/types';
import { escapeHtml, getBaseWidgetStyle } from '../registry/export-helpers';
import type { ExportRendererManifestEntry } from '../modules/export-registry';

export function renderBadgeExport(node: WidgetNode): string {
  const base = `${getBaseWidgetStyle(node)};display:inline-flex;align-items:center;justify-content:center;gap:8px;padding:0 14px;border-radius:${Number(node.style.borderRadius ?? 999)}px;background:${escapeHtml(String(node.style.backgroundColor ?? '#7c3aed'))};border:1px solid ${escapeHtml(String(node.style.borderColor ?? 'rgba(255,255,255,0.18)'))};box-shadow:${escapeHtml(String(node.style.boxShadow ?? '0 12px 24px rgba(0,0,0,0.18)'))};`;
  const icon = String(node.props.icon ?? '').trim();
  const text = escapeHtml(String(node.props.text ?? 'Badge'));
  return `<div class="widget widget-badge" data-widget-id="${node.id}" style="${base}">${icon ? `<span aria-hidden="true">${escapeHtml(icon)}</span>` : ''}<span>${text}</span></div>`;
}

export const badgeExportRenderer: ExportRendererManifestEntry = {
  type: 'badge',
  render: ({ node }) => renderBadgeExport(node as unknown as WidgetNode),
};
