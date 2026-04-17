import { createModuleDefinition } from '../module-definition-factory';
import { renderQrCodeStage } from '../qr-code.renderer';
import { getBaseWidgetStyle, escapeHtml } from '../../registry/export-helpers';

function buildQrPattern(url: string): boolean[] {
  const seed = (url || 'dusk').split('').reduce((acc, value) => acc + value.charCodeAt(0), 0);
  return Array.from({ length: 81 }, (_, index) => ((seed + index * 17 + Math.floor(index / 9) * 13) % 5) < 2);
}

function renderQrCodeExport(node: import('../../../domain/document/types').WidgetNode): string {
  const url = String(node.props.url ?? 'https://example.com');
  const codeLabel = escapeHtml(String(node.props.codeLabel ?? 'Scan me'));
  const pattern = buildQrPattern(url);
  const cellSize = 10;
  const padding = 12;
  const size = padding * 2 + cellSize * 9;
  const accent = escapeHtml(String(node.style.accentColor ?? '#111827'));
  const base = `${getBaseWidgetStyle(node)};display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;padding:12px;`;
  const cells = pattern
    .map((filled, index) => {
      if (!filled) return '';
      const x = padding + (index % 9) * cellSize;
      const y = padding + Math.floor(index / 9) * cellSize;
      return `<rect x="${x}" y="${y}" width="${cellSize}" height="${cellSize}" rx="1.5" fill="${accent}" />`;
    })
    .join('');

  return `<div class="widget widget-qr-code" data-widget-id="${node.id}" style="${base}">
    <svg viewBox="0 0 ${size} ${size}" width="108" height="108" role="img" aria-label="${codeLabel}" style="display:block;border-radius:14px;background:#ffffff;padding:8px;">
      <rect width="${size}" height="${size}" rx="16" fill="#ffffff" />
      ${cells}
    </svg>
    <div style="font-size:12px;font-weight:700;">${codeLabel}</div>
    <div style="font-size:11px;opacity:.7;word-break:break-all;text-align:center;">${escapeHtml(url)}</div>
  </div>`;
}

export const QrCodeDefinition = createModuleDefinition({
  type: 'qr-code',
  label: 'QR Code',
  category: 'interactive',
  frame: { x: 80, y: 70, width: 220, height: 116, rotation: 0 },
  props: { title: 'QR Code', url: 'https://example.com', codeLabel: 'Scan me' },
  inspectorFields: [{ key: 'title' }, { key: 'url', label: 'URL' }, { key: 'codeLabel', label: 'Label' }],
  style: { backgroundColor: '#f5e6cf', accentColor: '#111827', color: '#111827' },
  renderStage: renderQrCodeStage,
  renderExport: (node) => renderQrCodeExport(node),
});
