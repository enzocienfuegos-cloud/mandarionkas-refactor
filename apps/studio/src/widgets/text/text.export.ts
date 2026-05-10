import type { WidgetNode } from '../../domain/document/types';
import { renderTextExport } from '../registry/base-exporters';
import type { ExportRendererManifestEntry } from '../modules/export-registry';

export const textExportRenderer: ExportRendererManifestEntry = {
  type: 'text',
  render: ({ node }) => renderTextExport(node as unknown as WidgetNode),
};
