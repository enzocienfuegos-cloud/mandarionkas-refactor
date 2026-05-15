import type { WidgetNode } from '../../domain/document/types';
import { exportTokens as exportPalette } from '../../export/export-tokens';
import { escapeHtml } from '../registry/export-helpers';
import type { ExportRendererManifestEntry } from './export-registry';

export function renderScratchRevealExport(node: WidgetNode): string {
  const frame = node.frame;
  const style = node.style ?? {};
  const accent = String(style.accentColor ?? exportPalette.orange);
  const title = String(node.props.title ?? node.name);
  const coverLabel = String(node.props.coverLabel ?? 'Scratch to reveal');
  const revealLabel = String(node.props.revealLabel ?? '20% off today');
  const beforeImage = String(node.props.beforeImage ?? '');
  const afterImage = String(node.props.afterImage ?? '');
  const coverBlur = Math.max(0, Number(node.props.coverBlur ?? 0));
  const scratchRadius = Math.max(8, Number(node.props.scratchRadius ?? 22));
  const autoRevealThresholdPercent = Math.max(0, Math.min(100, Number(node.props.autoRevealThresholdPercent ?? 10)));
  const revealBackground = afterImage ? exportPalette.ink : `linear-gradient(135deg, ${accent}22, ${exportPalette.whiteBorder12})`;
  const base = [
    `position:absolute`,`left:${frame.x}px`,`top:${frame.y}px`,`width:${frame.width}px`,`height:${frame.height}px`,`transform:rotate(${frame.rotation}deg)`,
    `opacity:${Number(style.opacity ?? 1)}`,`overflow:hidden`,`box-sizing:border-box`,`border-radius:${Number(style.borderRadius ?? 14)}px`,
    `background:${escapeHtml(revealBackground)}`,`color:${String(style.color ?? exportPalette.white)}`,`display:flex`,`flex-direction:column`,
  ].join(';');
  return `<div class="widget widget-scratch-reveal" data-widget-id="${node.id}" style="${base}">
    <div class="scratch-reveal-shell" data-scratch-widget-id="${node.id}" data-scratch-cover-image="${escapeHtml(beforeImage)}" data-scratch-cover-blur="${coverBlur}" data-scratch-radius="${scratchRadius}" data-scratch-auto-reveal-threshold="${autoRevealThresholdPercent}" data-scratch-accent="${escapeHtml(accent)}" style="position:absolute;inset:0;border-radius:inherit;overflow:hidden;background:${escapeHtml(revealBackground)};">
      ${afterImage ? `<img src="${escapeHtml(afterImage)}" alt="${escapeHtml(revealLabel)}" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;" />` : ''}
      <div style="position:absolute;top:12px;left:12px;right:12px;z-index:2;font-size:12px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;color:${escapeHtml(accent)};text-shadow:0 2px 14px rgba(15,23,42,0.65);pointer-events:none;">${escapeHtml(title)}</div>
      <div style="position:absolute;inset:0;display:grid;place-items:center;font-weight:800;font-size:22px;text-align:center;padding:16px;text-shadow:0 2px 14px rgba(15,23,42,0.5);pointer-events:none;">${escapeHtml(revealLabel)}</div>
      <canvas data-scratch-canvas style="position:absolute;inset:0;z-index:1;width:100%;height:100%;cursor:crosshair;touch-action:none;outline:none;background:transparent;-webkit-tap-highlight-color:transparent;user-select:none;"></canvas>
      <div style="position:absolute;left:12px;right:12px;bottom:12px;z-index:2;display:flex;flex-direction:column;gap:6px;pointer-events:none;text-shadow:0 2px 14px rgba(15,23,42,0.65);">
        <div style="font-size:12px;">${escapeHtml(coverLabel)}</div>
      </div>
    </div>
  </div>`;
}

export const scratchRevealExportRenderer: ExportRendererManifestEntry = {
  type: 'scratch-reveal',
  render: ({ node }) => renderScratchRevealExport(node as unknown as WidgetNode),
};
