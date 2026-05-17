import { createId } from '../../domain/document/factories';
import { createInspectorTabs, type WidgetDefinition } from '../registry/widget-definition';
import { BadgeThumb } from '../registry/widget-thumbnails';
import { renderBadgeExport } from './badge.export';
import { renderBadgeWidget } from './badge.renderer';
import { defaultsFromWidgetSchema, defineWidgetSchema } from '../../domain/widget-schema';

const badgeSchema = defineWidgetSchema({
  version: 1,
  fields: {
    text: { type: 'string', default: 'New badge', minLength: 1, maxLength: 80 },
    icon: { type: 'string', default: '★', maxLength: 8 },
  },
});

export const badgeDefinition: WidgetDefinition = {
  type: 'badge',
  label: 'Badge',
  category: 'content',
  thumbnail: BadgeThumb,
  defaults: (sceneId, zIndex) => ({
    id: createId('badge'),
    type: 'badge',
    name: 'Badge',
    sceneId,
    zIndex,
    frame: { x: 40, y: 40, width: 180, height: 44, rotation: 0 },
    props: defaultsFromWidgetSchema(badgeSchema),
    style: {
      color: '#ffffff',
      fontSize: 16,
      fontWeight: 800,
      backgroundColor: '#7c3aed',
      borderRadius: 999,
      borderColor: 'rgba(255,255,255,0.18)',
      boxShadow: '0 12px 24px rgba(0,0,0,0.18)',
    },
    timeline: { startMs: 0, endMs: 15000 },
  }),
  inspectorSections: ['position-size', 'text-content', 'shadow', 'timing', 'states', 'data-bindings', 'variants'],
  inspectorTabs: createInspectorTabs([
    { id: 'basics', label: 'Basics', panels: ['position-size', 'widget-fields', 'text-content', 'shadow', 'timing'] },
    { id: 'behavior', label: 'Behavior', panels: ['conditions', 'actions', 'states', 'keyframes'] },
    { id: 'data', label: 'Data', panels: ['data-bindings', 'variants'] },
  ]),
  inspectorTitle: 'Badge content',
  inspectorFields: [
    { key: 'text', label: 'Label', type: 'text' },
    { key: 'icon', label: 'Icon', type: 'text' },
  ],
  schema: badgeSchema,
  capabilities: {
    supportsMotion: true,
    supportsHoverMotion: true,
    acceptsFontAsset: true,
    acceptsAssetSwap: true,
    exposesActions: true,
  },
  renderStage: renderBadgeWidget,
  renderExport: (node) => renderBadgeExport(node),
  renderLabel: (node) => String(node.props.text ?? node.name),
};
