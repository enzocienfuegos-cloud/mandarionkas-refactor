import type { StudioState, WidgetNode } from '../../domain/document/types';
import { renderGenericExport } from '../registry/export-helpers';

export function renderModuleExport(node: WidgetNode, detail?: string): string {
  return renderGenericExport(node, node.name, detail ?? node.type);
}

export function createModuleExportRenderer(detail?: string) {
  return (node: WidgetNode, _state: StudioState): string => renderModuleExport(node, detail);
}
