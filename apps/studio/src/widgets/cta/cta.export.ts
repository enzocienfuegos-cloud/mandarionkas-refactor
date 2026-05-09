import type { WidgetNode } from '../../domain/document/types';
import { renderCtaExport } from '../registry/base-exporters';
import type { ExportRendererManifestEntry } from '../modules/export-registry';

export const ctaExportRenderer: ExportRendererManifestEntry = {
  type: 'cta',
  render: ({ node }) => renderCtaExport(node as unknown as WidgetNode),
};
