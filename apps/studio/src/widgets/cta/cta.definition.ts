import { createId } from '../../domain/document/factories';
import { renderCtaWidget } from './cta.renderer';
import { createInspectorTabs, type WidgetDefinition } from '../registry/widget-definition';
import { renderCtaExport } from '../registry/base-exporters';
import { CtaThumb } from '../registry/widget-thumbnails';
import { defaultsFromWidgetSchema, defineWidgetSchema } from '../../domain/widget-schema';

const ctaSchema = defineWidgetSchema({
  version: 1,
  fields: {
    text: { type: 'string', default: 'Learn more', minLength: 1, maxLength: 120 },
    url: { type: 'string', default: '' },
  },
});

export const ctaDefinition: WidgetDefinition = {
  type: 'cta',
  label: 'CTA',
  category: 'interactive',
  thumbnail: CtaThumb,
  defaults: (sceneId, zIndex) => ({
    id: createId('cta'),
    type: 'cta',
    name: 'CTA',
    sceneId,
    zIndex,
    frame: { x: 360, y: 180, width: 240, height: 44, rotation: 0 },
    props: defaultsFromWidgetSchema(ctaSchema),
    style: { color: '#10161c', backgroundColor: '#ffd400', fontSize: 24, fontWeight: 700 },
    timeline: { startMs: 0, endMs: 15000 },
  }),
  inspectorSections: ['position-size', 'text-content', 'fill', 'timing', 'states', 'data-bindings', 'variants'],
  inspectorTabs: createInspectorTabs([
    { id: 'basics', label: 'Basics', panels: ['position-size', 'text-content', 'fill', 'timing'] },
    { id: 'behavior', label: 'Behavior', panels: ['conditions', 'actions', 'states', 'keyframes'] },
    { id: 'data', label: 'Data', panels: ['data-bindings', 'variants'] },
  ]),
  capabilities: {
    acceptsFontAsset: true,
    acceptsAssetSwap: true,
    hasFill: true,
    isInteractive: true,
    exposesActions: true,
    hasTextVariant: true,
  },
  schema: ctaSchema,
  renderStage: renderCtaWidget,
  renderExport: (node) => renderCtaExport(node),
  buildPortableExport: (node) => ({
    props: {
      ...node.props,
      exportRole: 'cta',
      ctaText: String(node.props.text ?? node.name),
      clickthroughUrl: String(node.props.url ?? ''),
    },
  }),
  renderLabel: (node) => String(node.props.text ?? node.name),
};
