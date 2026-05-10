import type { WidgetNode } from '../../domain/document/types';
import { exportTokens as exportPalette } from '../../export/export-tokens';
import { escapeHtml } from '../registry/export-helpers';
import type { ExportRendererManifestEntry } from './export-registry';

function renderRangeLikeExport(node: WidgetNode, label: string): string {
  const frame = node.frame;
  const style = node.style ?? {};
  const accent = String(style.accentColor ?? exportPalette.white);
  const min = Number(node.props.min ?? 0);
  const max = Number(node.props.max ?? 100);
  const value = Number(node.props.value ?? node.props.current ?? 50);
  const units = String(node.props.units ?? '');
  const base = [
    `position:absolute`,`left:${frame.x}px`,`top:${frame.y}px`,`width:${frame.width}px`,`height:${frame.height}px`,`transform:rotate(${frame.rotation}deg)`,
    `opacity:${Number(style.opacity ?? 1)}`,`overflow:hidden`,`box-sizing:border-box`,`border-radius:${Number(style.borderRadius ?? 14)}px`,
    `background:${String(style.backgroundColor ?? exportPalette.ink)}`,`color:${String(style.color ?? exportPalette.white)}`,`display:flex`,`flex-direction:column`,
  ].join(';');
  return `<div class="widget widget-${escapeHtml(node.type)}" data-widget-id="${node.id}" style="${base}">
    <div style="padding:10px 12px 0;font-size:12px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;color:${escapeHtml(accent)};">${escapeHtml(String(node.props.title ?? node.name))}</div>
    <div style="padding:8px 12px 12px;display:flex;flex:1;flex-direction:column;justify-content:center;gap:10px;">
      <input type="range" min="${min}" max="${max}" value="${value}" data-smx-action="range-update" data-widget-id="${node.id}" data-units="${escapeHtml(units)}" style="accent-color:${escapeHtml(accent)};" />
      <div data-range-value style="font-size:13px;font-weight:700;">${escapeHtml(label)}: ${value}${escapeHtml(units)}</div>
    </div>
  </div>`;
}

export function renderRangeSliderExport(node: WidgetNode): string {
  return renderRangeLikeExport(node, 'Range');
}

export function renderSliderExport(node: WidgetNode): string {
  return renderRangeLikeExport(node, 'Slider');
}

export const rangeSliderExportRenderer: ExportRendererManifestEntry = {
  type: 'range-slider',
  render: ({ node }) => renderRangeSliderExport(node as unknown as WidgetNode),
};

export const sliderExportRenderer: ExportRendererManifestEntry = {
  type: 'slider',
  render: ({ node }) => renderSliderExport(node as unknown as WidgetNode),
};
