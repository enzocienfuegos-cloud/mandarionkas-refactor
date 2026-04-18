import { createModuleDefinition } from '../module-definition-factory';
import { renderQrCodeStage } from '../qr-code.renderer';

export const QrCodeDefinition = createModuleDefinition({
  type: 'qr-code',
  label: 'QR Code',
  category: 'interactive',
  frame: { x: 80, y: 70, width: 220, height: 116, rotation: 0 },
  props: { title: 'QR Code', url: 'https://example.com', codeLabel: 'Scan me' },
  inspectorFields: [{ key: 'title' }, { key: 'url', label: 'URL' }, { key: 'codeLabel', label: 'Label' }],
  style: { backgroundColor: '#ffffff', accentColor: '#111827', color: '#111827' },
  renderStage: renderQrCodeStage,
});
