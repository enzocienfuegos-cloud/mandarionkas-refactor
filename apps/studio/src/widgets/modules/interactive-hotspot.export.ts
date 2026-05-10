import type { WidgetNode } from '../../domain/document/types';
import { exportTokens as exportPalette } from '../../export/export-tokens';
import { escapeHtml } from '../registry/export-helpers';
import type { ExportRendererManifestEntry } from './export-registry';

function renderHotspotExportIcon(icon: string, counterRotate = false): string {
  const common = 'xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"';
  const transform = counterRotate ? ' style="display:inline-flex;transform:rotate(-45deg);"' : ' style="display:inline-flex;"';
  switch (icon) {
    case 'arrow-up':
      return `<span${transform}><svg ${common}><path d="M8 13V3"/><path d="M4.5 6.5L8 3l3.5 3.5"/></svg></span>`;
    case 'arrow-down':
      return `<span${transform}><svg ${common}><path d="M8 3v10"/><path d="M4.5 9.5L8 13l3.5-3.5"/></svg></span>`;
    case 'arrow-left':
      return `<span${transform}><svg ${common}><path d="M13 8H3"/><path d="M6.5 4.5L3 8l3.5 3.5"/></svg></span>`;
    case 'arrow-right':
      return `<span${transform}><svg ${common}><path d="M3 8h10"/><path d="M9.5 4.5L13 8l-3.5 3.5"/></svg></span>`;
    case 'info':
      return `<span${transform}><svg ${common}><circle cx="8" cy="8" r="5.25"/><path d="M8 7v3"/><path d="M8 4.75h.01"/></svg></span>`;
    default:
      return `<span${transform}><svg ${common}><path d="M8 3v10"/><path d="M3 8h10"/></svg></span>`;
  }
}

export function renderInteractiveHotspotExport(node: WidgetNode): string {
  const frame = node.frame;
  const style = node.style ?? {};
  const accent = String(style.accentColor ?? exportPalette.amber);
  const hotspotX = Number(node.props.hotspotX ?? 55);
  const hotspotY = Number(node.props.hotspotY ?? 45);
  const hotspotShape = String(node.props.hotspotShape ?? 'circle');
  const hotspotIcon = String(node.props.hotspotIcon ?? 'plus');
  const base = [
    `position:absolute`,`left:${frame.x}px`,`top:${frame.y}px`,`width:${frame.width}px`,`height:${frame.height}px`,`transform:rotate(${frame.rotation}deg)`,
    `opacity:${Number(style.opacity ?? 1)}`,`overflow:hidden`,`box-sizing:border-box`,`border-radius:${Number(style.borderRadius ?? 14)}px`,
    `background:transparent`,`color:${String(style.color ?? exportPalette.white)}`,
  ].join(';');

  return `<div class="widget widget-interactive-hotspot" data-widget-id="${node.id}" data-hotspot-auto-close-ms="${Math.max(0, Number(node.props.autoCloseMs ?? 2000))}" style="${base}">
    <button type="button" data-smx-action="hotspot-toggle" data-widget-id="${node.id}" style="position:absolute;left:${hotspotX}%;top:${hotspotY}%;transform:translate(-50%,-50%)${hotspotShape === 'diamond' ? ' rotate(45deg)' : ''};width:${hotspotShape === 'pill' ? '44px' : '30px'};min-width:${hotspotShape === 'pill' ? '44px' : '30px'};max-width:${hotspotShape === 'pill' ? '44px' : '30px'};height:30px;min-height:30px;max-height:30px;inline-size:${hotspotShape === 'pill' ? '44px' : '30px'};min-inline-size:${hotspotShape === 'pill' ? '44px' : '30px'};max-inline-size:${hotspotShape === 'pill' ? '44px' : '30px'};block-size:30px;min-block-size:30px;max-block-size:30px;border-radius:${hotspotShape === 'square' ? '12px' : hotspotShape === 'pill' ? '999px' : hotspotShape === 'diamond' ? '10px' : '999px'};${hotspotShape === 'circle' ? 'clip-path:circle(50% at 50% 50%);' : ''}border:none;background:${escapeHtml(accent)};box-shadow:${String(node.props.hotspotEffect ?? 'pulse') === 'none' ? 'none' : `0 0 0 6px ${escapeHtml(accent)}33,0 0 0 18px ${escapeHtml(accent)}11`};cursor:pointer;font-weight:900;font-size:15px;line-height:1;padding:0;color:${exportPalette.ink};appearance:none;-webkit-appearance:none;display:grid;place-items:center;aspect-ratio:1 / 1;flex-shrink:0;box-sizing:border-box;overflow:hidden;">${renderHotspotExportIcon(hotspotIcon, hotspotShape === 'diamond')}</button>
    <button type="button" data-hotspot-panel data-smx-action="hotspot-toggle" data-widget-id="${node.id}" style="position:absolute;left:12px;right:12px;bottom:12px;border-radius:14px;background:${exportPalette.inkPanel};padding:10px 12px;display:none;gap:6px;border:none;text-align:left;color:inherit;cursor:pointer;">
      <div style="font-size:12px;font-weight:900;text-transform:uppercase;letter-spacing:.06em;color:${escapeHtml(accent)};">${escapeHtml(String(node.props.header ?? 'Interactive hotspot'))}</div>
      <div style="font-size:12px;line-height:1.45;">${escapeHtml(String(node.props.body ?? 'Add more context for this interactive point.'))}</div>
    </button>
    <div data-hotspot-label style="position:absolute;left:12px;bottom:12px;font-size:12px;">${escapeHtml(String(node.props.label ?? 'Tap point'))}</div>
  </div>`;
}

export const interactiveHotspotExportRenderer: ExportRendererManifestEntry = {
  type: 'interactive-hotspot',
  render: ({ node }) => renderInteractiveHotspotExport(node as unknown as WidgetNode),
};
