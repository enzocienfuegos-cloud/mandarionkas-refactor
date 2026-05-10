import { createId } from '../../domain/document/factories';
import { renderTextWidget } from './text.renderer';
import { createInspectorTabs, type WidgetDefinition } from '../registry/widget-definition';
import { renderTextExport } from '../registry/base-exporters';
import { TextThumb } from '../registry/widget-thumbnails';

export const textDefinition: WidgetDefinition = {
  type: 'text',
  label: 'Text',
  category: 'content',
  thumbnail: TextThumb,
  defaults: (sceneId, zIndex) => ({
    id: createId('text'),
    type: 'text',
    name: 'Text',
    sceneId,
    zIndex,
    frame: { x: 40, y: 40, width: 280, height: 80, rotation: 0 },
    props: { text: 'New text block' },
    style: { color: '#ffffff', fontSize: 28, fontWeight: 700 },
    timeline: { startMs: 0, endMs: 15000 },
  }),
  inspectorSections: ['position-size', 'text-content', 'timing', 'states', 'data-bindings', 'variants'],
  inspectorTabs: createInspectorTabs([
    { id: 'basics', label: 'Basics', panels: ['position-size', 'text-content', 'timing'] },
    { id: 'behavior', label: 'Behavior', panels: ['conditions', 'actions', 'states', 'keyframes'] },
    { id: 'data', label: 'Data', panels: ['data-bindings', 'variants'] },
  ]),
  capabilities: {
    acceptsFontAsset: true,
    acceptsAssetSwap: true,
    exposesActions: true,
    hasTextVariant: true,
  },
  renderStage: renderTextWidget,
  renderExport: (node) => renderTextExport(node),
  renderLabel: (node) => String(node.props.text ?? node.name),
};
