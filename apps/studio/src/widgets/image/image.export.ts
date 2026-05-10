import type { WidgetNode } from '../../domain/document/types';
import { renderImageExport } from '../registry/base-exporters';
import type { ExportRendererManifestEntry } from '../modules/export-registry';

export const imageExportRenderer: ExportRendererManifestEntry = {
  type: 'image',
  render: ({ node, assetPathMap }) => renderImageExport(node as unknown as WidgetNode, 'image', assetPathMap),
};
