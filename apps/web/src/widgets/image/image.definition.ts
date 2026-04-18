import { createId } from '../../domain/document/factories';
import { renderImageWidget } from './image.renderer';
import { createInspectorTabs, type WidgetDefinition } from '../registry/widget-definition';
import { renderImageExport } from '../registry/base-exporters';

export const imageDefinition: WidgetDefinition = {
  type: 'image',
  label: 'Image',
  category: 'media',
  defaults: (sceneId, zIndex) => ({
    id: createId('image'),
    type: 'image',
    name: 'Image',
    sceneId,
    zIndex,
    frame: { x: 40, y: 140, width: 260, height: 140, rotation: 0 },
    props: { src: '', alt: 'Placeholder image' },
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
  renderStage: renderImageWidget,
  renderExport: (node) => renderImageExport(node, 'image'),
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
