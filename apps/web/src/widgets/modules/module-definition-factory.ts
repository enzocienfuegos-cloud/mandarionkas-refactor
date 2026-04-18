import { createId } from '../../domain/document/factories';
import type { WidgetNode, WidgetType } from '../../domain/document/types';
import { createInspectorTabs, type WidgetDefinition } from '../registry/widget-definition';
import { createModuleExportRenderer } from './module-exporter';

export type ModuleSpec = {
  type: WidgetType;
  label: string;
  category: 'interactive' | 'media' | 'content' | 'layout';
  frame: WidgetNode['frame'];
  props: Record<string, unknown>;
  style: Record<string, unknown>;
  renderStage: WidgetDefinition['renderStage'];
  renderInspector?: WidgetDefinition['renderInspector'];
  renderExport?: WidgetDefinition['renderExport'];
  inspectorFields?: WidgetDefinition['inspectorFields'];
  exportDetail?: string;
};

export function createModuleDefinition(spec: ModuleSpec): WidgetDefinition {
  return {
    type: spec.type,
    label: spec.label,
    category: spec.category,
    defaults: (sceneId, zIndex) => ({
      id: createId(spec.type.replace(/[^a-z]/g, '')),
      type: spec.type,
      name: spec.label,
      sceneId,
      zIndex,
      frame: spec.frame,
      props: { ...spec.props },
      style: { ...spec.style },
      timeline: { startMs: 0, endMs: 15000 },
    }),
    inspectorSections: ['position-size', 'module-config', 'fill', 'timing', 'states', 'data-bindings', 'variants'],
    inspectorTabs: createInspectorTabs([
      { id: 'basics', label: 'Basics', panels: ['position-size', 'widget-fields', 'fill', 'timing'] },
      { id: 'behavior', label: 'Behavior', panels: ['conditions', 'actions', 'states', 'keyframes'] },
      { id: 'data', label: 'Data', panels: ['data-bindings', 'variants'] },
    ]),
    renderStage: spec.renderStage,
    renderInspector: spec.renderInspector,
    inspectorTitle: spec.label,
    inspectorFields: spec.inspectorFields,
    renderExport: spec.renderExport ?? createModuleExportRenderer(spec.exportDetail ?? spec.label),
    renderLabel: (node) => String(node.props.title ?? node.props.label ?? node.name),
  };
}
