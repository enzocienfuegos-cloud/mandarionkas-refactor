import { createId } from '../../domain/document/factories';
import { renderTextWidget } from './text.renderer';
import { createInspectorTabs, type WidgetDefinition } from '../registry/widget-definition';
import { renderTextExport } from '../registry/base-exporters';
import { TextThumb } from '../registry/widget-thumbnails';
import { defaultsFromWidgetSchema, defineWidgetSchema } from '../../domain/widget-schema';

const textSchema = defineWidgetSchema({
  version: 1,
  fields: {
    text: { type: 'string', default: 'New text block', minLength: 1, maxLength: 1000 },
  },
});

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
    props: defaultsFromWidgetSchema(textSchema),
    style: { color: '#ffffff', fontSize: 28, fontWeight: 700 },
    timeline: { startMs: 0, endMs: 15000 },
  }),
  inspectorSections: ['position-size', 'text-content', 'shadow', 'timing', 'states', 'data-bindings', 'variants'],
  inspectorTabs: createInspectorTabs([
    { id: 'basics', label: 'Basics', panels: ['position-size', 'text-content', 'shadow', 'timing'] },
    { id: 'behavior', label: 'Behavior', panels: ['conditions', 'actions', 'states', 'keyframes'] },
    { id: 'data', label: 'Data', panels: ['data-bindings', 'variants'] },
  ]),
  capabilities: {
    supportsMotion: true,
    supportsHoverMotion: true,
    acceptsFontAsset: true,
    acceptsAssetSwap: true,
    exposesActions: true,
    hasTextVariant: true,
  },
  schema: textSchema,
  renderStage: renderTextWidget,
  renderExport: (node) => renderTextExport(node),
  renderLabel: (node) => String(node.props.text ?? node.name),
};
