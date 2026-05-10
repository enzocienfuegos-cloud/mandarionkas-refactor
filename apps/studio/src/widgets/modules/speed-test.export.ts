import type { WidgetNode } from '../../domain/document/types';
import { exportTokens as exportPalette } from '../../export/export-tokens';
import { escapeHtml } from '../registry/export-helpers';
import type { ExportRendererManifestEntry } from './export-registry';
import { SPEED_TEST_DEFAULT_CTA_LABEL } from './speed-test.shared';

export function renderSpeedTestExport(node: WidgetNode): string {
  const frame = node.frame;
  const style = node.style ?? {};
  const accent = String(style.accentColor ?? exportPalette.teal);
  const min = Number(node.props.min ?? 10);
  const max = Number(node.props.max ?? 100);
  const current = Math.max(min, Math.min(max, Number(node.props.current ?? 64)));
  const durationMs = Math.max(300, Number(node.props.durationMs ?? 1800));
  const units = String(node.props.units ?? 'Mbps');
  const skin = String(node.props.skin ?? 'ookla');
  const pingValue = Number(node.props.pingValue ?? 11);
  const uploadValue = Number(node.props.uploadValue ?? 42);
  const ctaLabel = String(node.props.ctaLabel ?? SPEED_TEST_DEFAULT_CTA_LABEL);
  const resultMode = String(node.props.resultMode ?? 'random');
  const fastThreshold = Number(node.props.fastThreshold ?? 70);
  const fastMessage = String(node.props.fastMessage ?? 'WOW, very fast network');
  const slowMessage = String(node.props.slowMessage ?? 'Slow connection');
  const initialTone = current >= fastThreshold ? exportPalette.green : exportPalette.red;
  const pct = Math.max(0, Math.min(100, (current / Math.max(1, max)) * 100));
  const ooklaSkin = skin === 'ookla';
  const fastSkin = skin === 'fast';
  const compact = frame.width < 240 || frame.height < 150;
  const statLabelFont = compact ? 9 : 11;
  const statValueFont = compact ? 13 : 15;
  const gaugeHeight = compact ? 132 : 156;
  const gaugeBorder = compact ? 12 : 16;
  const gaugeNeedleHeight = compact ? 72 : 88;
  const gaugeNumberFont = compact ? 28 : 34;
  const unitsFont = compact ? 11 : 13;
  const topInset = compact ? 14 : 18;
  const sideInset = compact ? 22 : 28;
  const base = [
    `position:absolute`,`left:${frame.x}px`,`top:${frame.y}px`,`width:${frame.width}px`,`height:${frame.height}px`,`transform:rotate(${frame.rotation}deg)`,
    `opacity:${Number(style.opacity ?? 1)}`,`overflow:hidden`,`box-sizing:border-box`,`border-radius:${Number(style.borderRadius ?? 14)}px`,
    `background:${String(style.backgroundColor ?? exportPalette.navy700)}`,`color:${String(style.color ?? exportPalette.white)}`,`display:flex`,`flex-direction:column`,
  ].join(';');
  return `<div class="widget widget-speed-test" data-widget-id="${node.id}" data-speed-min="${min}" data-speed-max="${max}" data-speed-current="${current}" data-speed-duration="${durationMs}" data-speed-result-mode="${escapeHtml(resultMode)}" data-speed-units="${escapeHtml(units)}" data-speed-fast-threshold="${fastThreshold}" data-speed-fast-message="${escapeHtml(fastMessage)}" data-speed-slow-message="${escapeHtml(slowMessage)}" data-speed-skin="${escapeHtml(skin)}" style="${base}">
    <div style="padding:10px 12px 0;font-size:12px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;color:${escapeHtml(accent)};">${escapeHtml(String(node.props.title ?? node.name))}</div>
    ${(ooklaSkin || fastSkin) ? `<div style="padding:${compact ? '6px 10px 10px' : '8px 12px 12px'};display:flex;flex:1;flex-direction:column;gap:${compact ? 10 : 14}px;"><div style="display:grid;gap:6px;"><div style="display:grid;grid-template-columns:repeat(3, minmax(0, 1fr));gap:${compact ? 8 : 10}px;font-size:${statLabelFont}px;letter-spacing:.08em;text-transform:uppercase;"><div style="display:grid;gap:2px;"><span style="opacity:.74;">Ping <span style="opacity:.5">ms</span></span><strong style="font-size:${statValueFont}px;letter-spacing:normal;">${pingValue}</strong></div><div style="display:grid;gap:2px;"><span style="opacity:.74;">Download <span style="opacity:.5">${escapeHtml(units)}</span></span><strong style="font-size:${statValueFont}px;letter-spacing:normal;">${current}</strong></div><div style="display:grid;gap:2px;"><span style="opacity:.74;">Upload <span style="opacity:.5">${escapeHtml(units)}</span></span><strong style="font-size:${statValueFont}px;letter-spacing:normal;">${uploadValue}</strong></div></div></div><div style="position:relative;height:${gaugeHeight}px;border-radius:999px;background:${fastSkin ? `radial-gradient(circle at 50% 100%, ${exportPalette.greenGaugeGlow}, ${exportPalette.transparentToBlack} 68%)` : `radial-gradient(circle at 50% 100%, ${exportPalette.tealGaugeGlow}, ${exportPalette.transparentToBlack} 68%)`};"><div style="position:absolute;inset:0;display:grid;place-items:center;"><div style="width:100%;height:100%;border-radius:999px 999px 36px 36px / 100% 100% 18px 18px;border:${gaugeBorder}px solid ${fastSkin ? exportPalette.greenGaugeBorder : exportPalette.whiteBorder08};border-bottom:none;transform:scaleX(.92);"></div><div style="position:absolute;top:${topInset}px;left:${sideInset}px;right:${sideInset}px;display:flex;justify-content:space-between;font-size:${compact ? 8 : 10}px;font-weight:900;opacity:.82;"><span>0</span><span>5</span><span>10</span><span>20</span><span>30</span><span>50</span><span>75</span><span>100</span></div><div data-speed-needle style="position:absolute;left:50%;bottom:${compact ? 16 : 18}px;width:${compact ? 5 : 6}px;height:${gaugeNeedleHeight}px;border-radius:999px;background:${initialTone};transform-origin:bottom center;transform:translateX(-50%) rotate(${(-92 + pct * 1.84).toFixed(1)}deg);box-shadow:0 0 16px ${initialTone};"></div><div style="position:absolute;bottom:${compact ? 10 : 10}px;width:${compact ? 14 : 16}px;height:${compact ? 14 : 16}px;border-radius:50%;background:${exportPalette.white};"></div><div style="position:absolute;bottom:${compact ? 8 : 8}px;display:grid;place-items:center;gap:2px;"><div data-speed-value style="font-size:${gaugeNumberFont}px;line-height:1;font-weight:300;">${current.toFixed(2)}</div><div style="font-size:${unitsFont}px;opacity:.82;">${escapeHtml(units)}</div></div></div></div><div style="display:flex;align-items:center;justify-content:space-between;gap:10px;"><div data-speed-status style="font-size:${compact ? 11 : 12}px;font-weight:800;color:${initialTone};">${escapeHtml(current >= fastThreshold ? fastMessage : slowMessage)}</div><button type="button" data-smx-action="speed-test-start" data-widget-id="${node.id}" style="padding:9px 14px;border-radius:999px;background:${exportPalette.white};color:${exportPalette.ink};font-weight:900;border:none;cursor:pointer;white-space:nowrap;">${escapeHtml(ctaLabel)}</button></div></div>` : `<div style="padding:8px 12px 12px;display:flex;flex:1;flex-direction:column;gap:10px;"><div data-speed-value style="font-size:26px;font-weight:900;">${current}<span style="font-size:13px;opacity:.8;"> ${escapeHtml(units)}</span></div><div data-speed-status style="font-size:12px;font-weight:800;color:${initialTone};">${escapeHtml(current >= fastThreshold ? fastMessage : slowMessage)}</div><div style="height:12px;border-radius:999px;background:${exportPalette.whiteBorder12};overflow:hidden;"><div data-speed-bar style="width:${pct}%;height:100%;background:${initialTone};"></div></div><button type="button" data-smx-action="speed-test-start" data-widget-id="${node.id}" style="margin-top:auto;padding:10px 12px;border-radius:12px;background:${escapeHtml(accent)};color:${exportPalette.ink};font-weight:800;border:none;cursor:pointer;">${escapeHtml(ctaLabel)}</button></div>`}
  </div>`;
}

export const speedTestExportRenderer: ExportRendererManifestEntry = {
  type: 'speed-test',
  render: ({ node }) => renderSpeedTestExport(node as unknown as WidgetNode),
};
