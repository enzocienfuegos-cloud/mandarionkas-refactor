import type { WidgetNode } from '../../domain/document/types';
import { exportTokens as exportPalette } from '../../export/export-tokens';
import { escapeHtml, getBaseWidgetStyle } from '../registry/export-helpers';

export function renderGroupExport(node: WidgetNode): string {
  if (!node.props.scratchEnabled) {
    return `<div class="widget widget-module" data-widget-id="${node.id}" style="${getBaseWidgetStyle(node)};flex-direction:column;gap:6px;"><strong>${escapeHtml(node.name)}</strong><span style="font-size:12px;opacity:.8;">Group</span></div>`;
  }

  const style = node.style ?? {};
  const accent = String(style.accentColor ?? exportPalette.orange);
  const title = String(node.props.title ?? node.name);
  const coverLabel = String(node.props.coverLabel ?? 'Scratch to reveal');
  const beforeImage = String(node.props.beforeImage ?? '');
  const coverBlur = Math.max(0, Number(node.props.coverBlur ?? 0));
  const scratchRadius = Math.max(8, Number(node.props.scratchRadius ?? 22));
  const autoRevealThresholdPercent = Math.max(0, Math.min(100, Number(node.props.autoRevealThresholdPercent ?? 10)));
  const base = [
    `position:absolute`,
    `left:${node.frame.x}px`,
    `top:${node.frame.y}px`,
    `width:${node.frame.width}px`,
    `height:${node.frame.height}px`,
    `transform:rotate(${node.frame.rotation}deg)`,
    `opacity:${Number(style.opacity ?? 1)}`,
    `overflow:hidden`,
    `box-sizing:border-box`,
    `border-radius:${Number(style.borderRadius ?? 12)}px`,
    `background:transparent`,
    `pointer-events:auto`,
  ].join(';');

  return `<div class="widget widget-group widget-group-scratch" data-widget-id="${node.id}" style="${base}">
    <div class="scratch-reveal-shell" data-scratch-widget-id="${node.id}" data-scratch-cover-image="${escapeHtml(beforeImage)}" data-scratch-cover-blur="${coverBlur}" data-scratch-radius="${scratchRadius}" data-scratch-auto-reveal-threshold="${autoRevealThresholdPercent}" data-scratch-accent="${escapeHtml(accent)}" data-scratch-reveal-animation="none" data-scratch-reveal-animation-duration="700" data-scratch-reveal-animation-delay="0" style="position:absolute;inset:0;border-radius:inherit;overflow:hidden;background:${escapeHtml(beforeImage ? 'transparent' : `linear-gradient(135deg, ${accent}22, ${exportPalette.whiteBorder12})`)};">
      <div style="position:absolute;top:12px;left:12px;right:12px;z-index:2;font-size:12px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;color:${escapeHtml(accent)};text-shadow:0 2px 14px rgba(15,23,42,0.65);pointer-events:none;">${escapeHtml(title)}</div>
      <canvas data-scratch-canvas style="position:absolute;inset:0;z-index:1;width:100%;height:100%;cursor:crosshair;touch-action:none;outline:none;background:transparent;-webkit-tap-highlight-color:transparent;user-select:none;"></canvas>
      <div style="position:absolute;left:12px;right:12px;bottom:12px;z-index:2;display:flex;flex-direction:column;gap:6px;pointer-events:none;text-shadow:0 2px 14px rgba(15,23,42,0.65);">
        <div style="font-size:12px;color:${escapeHtml(String(style.color ?? exportPalette.white))};">${escapeHtml(coverLabel)}</div>
      </div>
    </div>
  </div>`;
}
