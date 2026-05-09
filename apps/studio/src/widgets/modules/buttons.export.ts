import type { WidgetNode } from '../../domain/document/types';
import { exportTokens as exportPalette } from '../../export/export-tokens';
import { escapeHtml } from '../registry/export-helpers';
import type { ExportRendererManifestEntry } from './export-registry';
import { BUTTONS_EXPORT_DEFAULT_PRIMARY_LABEL, BUTTONS_EXPORT_DEFAULT_SECONDARY_LABEL } from './buttons.shared';

export function renderButtonsExport(node: WidgetNode): string {
  const frame = node.frame;
  const style = node.style ?? {};
  const accent = String(style.accentColor ?? exportPalette.cyan);
  const vertical = String(node.props.orientation ?? 'horizontal') === 'vertical';
  const primaryLabel = String(node.props.primaryLabel ?? BUTTONS_EXPORT_DEFAULT_PRIMARY_LABEL);
  const secondaryLabel = String(node.props.secondaryLabel ?? BUTTONS_EXPORT_DEFAULT_SECONDARY_LABEL);
  const base = [
    `position:absolute`,`left:${frame.x}px`,`top:${frame.y}px`,`width:${frame.width}px`,`height:${frame.height}px`,`transform:rotate(${frame.rotation}deg)`,
    `opacity:${Number(style.opacity ?? 1)}`,`overflow:hidden`,`box-sizing:border-box`,`border-radius:${Number(style.borderRadius ?? 14)}px`,
    `background:${String(style.backgroundColor ?? exportPalette.teal700)}`,`color:${String(style.color ?? exportPalette.white)}`,`display:flex`,`flex-direction:column`,
  ].join(';');
  return `<div class="widget widget-buttons" data-widget-id="${node.id}" style="${base}"><div style="padding:10px 12px 0;font-size:12px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;color:${escapeHtml(accent)};">${escapeHtml(String(node.props.title ?? node.name))}</div><div style="padding:8px 12px 12px;display:flex;flex:1;align-items:center;justify-content:center;"><div style="display:flex;gap:8px;flex-direction:${vertical ? 'column' : 'row'};width:100%;"><button type="button" class="widget-buttons-action" data-smx-action="button-select" data-widget-id="${node.id}" data-button-kind="primary" style="flex:1;padding:10px 12px;border-radius:12px;text-align:center;font-weight:800;cursor:pointer;border:none;background:${escapeHtml(accent)};color:${exportPalette.ink};">${escapeHtml(primaryLabel)}</button><button type="button" class="widget-buttons-action" data-smx-action="button-select" data-widget-id="${node.id}" data-button-kind="secondary" style="flex:1;padding:10px 12px;border-radius:12px;text-align:center;font-weight:800;cursor:pointer;border:1px solid ${escapeHtml(accent)};background:transparent;color:inherit;">${escapeHtml(secondaryLabel)}</button></div></div></div>`;
}

export const buttonsExportRenderer: ExportRendererManifestEntry = {
  type: 'buttons',
  render: ({ node }) => renderButtonsExport(node as unknown as WidgetNode),
};
