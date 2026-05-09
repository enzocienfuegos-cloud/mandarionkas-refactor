import { createId } from '../../domain/document/factories';
import { renderImageWidget } from './image.renderer';
import { createInspectorTabs, type WidgetDefinition } from '../registry/widget-definition';
import { renderImageExport } from '../registry/base-exporters';
import { ImageThumb } from '../registry/widget-thumbnails';
import { defaultsFromWidgetSchema, defineWidgetSchema } from '../../domain/widget-schema';

const imageSchema = defineWidgetSchema({
  version: 1,
  fields: {
    src: { type: 'asset-ref', default: '', kind: 'image' },
    alt: { type: 'string', default: 'Placeholder image', maxLength: 180 },
  },
});

export const imageDefinition: WidgetDefinition = {
  type: 'image',
  label: 'Image',
  category: 'media',
  thumbnail: ImageThumb,
  description: 'Display a single responsive image with alt text and asset swap support.',
  requiresAsset: true,
  mraidCompatibility: 'supported',
  defaults: (sceneId, zIndex) => ({
    id: createId('image'),
    type: 'image',
    name: 'Image',
    sceneId,
    zIndex,
    frame: { x: 40, y: 140, width: 260, height: 140, rotation: 0 },
    props: defaultsFromWidgetSchema(imageSchema),
    style: { backgroundColor: '#324454', fit: 'cover' },
    timeline: { startMs: 0, endMs: 15000 },
  }),
  inspectorSections: ['position-size', 'fill', 'timing', 'states', 'data-bindings', 'variants'],
  inspectorTabs: createInspectorTabs([
    { id: 'basics', label: 'Basics', panels: ['position-size', 'widget-fields', 'fill', 'timing'] },
    { id: 'behavior', label: 'Behavior', panels: ['conditions', 'actions', 'states', 'keyframes'] },
    { id: 'data', label: 'Data', panels: ['data-bindings', 'variants'] },
  ]),
  inspectorTitle: 'Image source',
  inspectorFields: [{ key: 'src', label: 'Source URL' }, { key: 'alt', label: 'Alt text' }],
  schema: imageSchema,
  capabilities: {
    acceptsImageAsset: true,
    acceptsAssetSwap: true,
    hasFill: true,
    isMedia: true,
    exposesActions: true,
  },
  renderStage: renderImageWidget,
  renderExport: (node, _state, assetPathMap) => renderImageExport(node, 'image', assetPathMap),
  buildPortableExport: (node) => ({
    props: {
      ...node.props,
      exportRole: 'image',
      src: String(node.props.src ?? ''),
      alt: String(node.props.alt ?? ''),
      fit: String(node.style.fit ?? 'cover'),
    },
  }),
  renderLabel: () => 'Image',
};
