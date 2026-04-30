import { createId } from '../../domain/document/factories';
import type { WidgetNode, WidgetType } from '../../domain/document/types';
import { createInspectorTabs, type WidgetDefinition } from '../registry/widget-definition';
import { createModuleExportRenderer } from './module-exporter';
import type { PortableExportWidget } from '../../export/portable';

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
  buildPortableExport?: WidgetDefinition['buildPortableExport'];
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
    buildPortableExport: spec.buildPortableExport ?? ((node) => buildModulePortableExport(node)),
    renderLabel: (node) => String(node.props.title ?? node.props.label ?? node.name),
  };
}

function buildModulePortableExport(node: WidgetNode): Partial<PortableExportWidget> {
  const exportRole = node.type;
  const patch: Partial<PortableExportWidget> = {
    props: {
      ...node.props,
      exportRole,
    },
  };

  switch (node.type) {
    case 'buttons':
      patch.props = {
        ...patch.props,
        primaryLabel: String(node.props.primaryLabel ?? ''),
        secondaryLabel: String(node.props.secondaryLabel ?? ''),
      };
      break;
    case 'interactive-gallery':
    case 'image-carousel':
      patch.props = {
        ...patch.props,
        galleryItems: String(node.props.slides ?? ''),
      };
      break;
    case 'interactive-hotspot':
      patch.props = {
        ...patch.props,
        hotspotX: Number(node.props.hotspotX ?? 50),
        hotspotY: Number(node.props.hotspotY ?? 50),
      };
      break;
    case 'range-slider':
    case 'slider':
      patch.props = {
        ...patch.props,
        min: Number(node.props.min ?? 0),
        max: Number(node.props.max ?? 100),
        value: Number(node.props.value ?? node.props.current ?? 0),
      };
      break;
    case 'scratch-reveal':
      patch.props = {
        ...patch.props,
        revealAmount: Number(node.props.revealAmount ?? 0),
      };
      break;
    default:
      break;
  }

  return patch;
}
