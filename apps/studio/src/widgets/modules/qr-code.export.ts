import type { WidgetNode } from '../../domain/document/types';
import type { ExportRendererManifestEntry } from './export-registry';
import { renderQrCodeExport as renderQrCodeExportImpl } from './export-renderers';

export const renderQrCodeExport = renderQrCodeExportImpl;

export const qrCodeExportRenderer: ExportRendererManifestEntry = {
  type: 'qr-code',
  render: ({ node }) => renderQrCodeExportImpl(node as unknown as WidgetNode),
};
