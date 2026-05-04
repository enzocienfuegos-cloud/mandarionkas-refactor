import { createModuleDefinition } from '../module-definition-factory';
import { renderQrCodeExport } from '../export-renderers';
import { renderQrCodeStage } from '../qr-code.renderer';

export const QrCodeDefinition = createModuleDefinition({
  type: 'qr-code',
  label: 'QR Code',
  category: 'interactive',
  frame: { x: 80, y: 70, width: 220, height: 116, rotation: 0 },
  props: { title: 'QR Code', url: 'https://example.com', codeLabel: 'Scan me', qrScale: 0.72, qrPadding: 8 },
  inspectorFields: [
    { key: 'title' },
    { key: 'url', label: 'URL' },
    { key: 'codeLabel', label: 'Label' },
    { key: 'qrScale', label: 'QR scale', type: 'number' },
    { key: 'qrPadding', label: 'QR padding', type: 'number' },
  ],
  style: { backgroundColor: '#ffffff', accentColor: '#111827', color: '#111827' },
  renderStage: renderQrCodeStage,
  renderExport: (node) => renderQrCodeExport(node),
});
