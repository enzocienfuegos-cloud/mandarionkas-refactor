import { createModuleDefinition } from '../module-definition-factory';
import { renderQrCodeExport } from '../qr-code.export';
import { renderQrCodeStage } from '../qr-code.renderer';
import { QrCodeThumb } from '../../registry/widget-thumbnails';
import { defaultsFromWidgetSchema, defineWidgetSchema } from '../../../domain/widget-schema';

const qrCodeSchema = defineWidgetSchema({
  version: 1,
  fields: {
    title: { type: 'string', default: 'QR Code', minLength: 1, maxLength: 120 },
    url: { type: 'string', default: 'https://example.com' },
    codeLabel: { type: 'string', default: 'Scan me', minLength: 1, maxLength: 80 },
    qrScale: { type: 'number', default: 0.72, min: 0.2, max: 1.2 },
    qrPadding: { type: 'number', default: 8, min: 0, max: 48, integer: true },
  },
});

export const QrCodeDefinition = createModuleDefinition({
  type: 'qr-code',
  label: 'QR Code',
  category: 'interactive',
  thumbnail: QrCodeThumb,
  frame: { x: 80, y: 70, width: 220, height: 116, rotation: 0 },
  props: defaultsFromWidgetSchema(qrCodeSchema),
  inspectorFields: [
    { key: 'title' },
    { key: 'url', label: 'URL' },
    { key: 'codeLabel', label: 'Label' },
    { key: 'qrScale', label: 'QR scale', type: 'number' },
    { key: 'qrPadding', label: 'QR padding', type: 'number' },
  ],
  schema: qrCodeSchema,
  style: { backgroundColor: '#ffffff', accentColor: '#111827', color: '#111827' },
  renderStage: renderQrCodeStage,
  renderExport: (node) => renderQrCodeExport(node),
});
