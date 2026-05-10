import type { WidgetNode } from '../../domain/document/types';
import { exportTokens as exportPalette } from '../../export/export-tokens';
import { escapeHtml } from '../registry/export-helpers';
import type { ExportRendererManifestEntry } from './export-registry';

export function renderCountdownExport(node: WidgetNode): string {
  const frame = node.frame;
  const style = node.style ?? {};
  const accent = String(style.accentColor ?? exportPalette.amber);
  const totalSeconds = Number(node.props.totalSeconds ?? (Number(node.props.days ?? 0) * 86400) + (Number(node.props.hours ?? 0) * 3600) + (Number(node.props.minutes ?? 0) * 60) + Number(node.props.seconds ?? 0));
  const base = [
    `position:absolute`,`left:${frame.x}px`,`top:${frame.y}px`,`width:${frame.width}px`,`height:${frame.height}px`,`transform:rotate(${frame.rotation}deg)`,
    `opacity:${Number(style.opacity ?? 1)}`,`overflow:hidden`,`box-sizing:border-box`,`border-radius:${Number(style.borderRadius ?? 14)}px`,
    `background:${String(style.backgroundColor ?? exportPalette.darkSurface)}`,`color:${String(style.color ?? exportPalette.white)}`,`display:flex`,`flex-direction:column`,
  ].join(';');
  return `<div class="widget widget-countdown" data-widget-id="${node.id}" data-countdown-seconds="${totalSeconds}" style="${base}">
    <div style="padding:10px 12px 0;font-size:12px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;color:${escapeHtml(accent)};">${escapeHtml(String(node.props.title ?? node.name))}</div>
    <div style="padding:8px 12px 12px;display:grid;grid-template-columns:repeat(4,1fr);gap:8px;flex:1;align-content:center;">
      ${['DD', 'HH', 'MM', 'SS'].map((label) => `<div data-countdown-segment="${label}" style="border-radius:12px;padding:12px 8px;background:${exportPalette.whiteBorder08};display:grid;gap:4px;"><div data-countdown-value="${label}" style="font-size:20px;font-weight:800;text-align:center;">00</div><div style="font-size:10px;text-align:center;opacity:.75;">${label}</div></div>`).join('')}
    </div>
  </div>`;
}

export const countdownExportRenderer: ExportRendererManifestEntry = {
  type: 'countdown',
  render: ({ node }) => renderCountdownExport(node as unknown as WidgetNode),
};
