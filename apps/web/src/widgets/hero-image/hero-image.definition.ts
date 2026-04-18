import { createId } from '../../domain/document/factories';
import { renderHeroImageWidget } from './hero-image.renderer';
import { createInspectorTabs, type WidgetDefinition } from '../registry/widget-definition';
import { renderImageExport } from '../registry/base-exporters';

export const heroImageDefinition: WidgetDefinition = {
  type: 'hero-image',
  label: 'Hero Image',
  category: 'media',
  defaults: (sceneId, zIndex) => ({
    id: createId('hero'),
    type: 'hero-image',
    name: 'Hero Image',
    sceneId,
    zIndex,
    frame: { x: 24, y: 24, width: 320, height: 168, rotation: 0 },
    props: { src: '', alt: 'Hero image', focalX: 50, focalY: 50, cornerStyle: 'rounded' },
    style: { backgroundColor: '#223142', fit: 'cover', borderRadius: 20 },
    timeline: { startMs: 0, endMs: 15000 },
  }),
  inspectorSections: ['position-size', 'fill', 'timing', 'states', 'data-bindings', 'variants'],
  inspectorTabs: createInspectorTabs([
    { id: 'basics', label: 'Basics', panels: ['position-size', 'widget-fields', 'fill', 'timing'] },
    { id: 'behavior', label: 'Behavior', panels: ['conditions', 'actions', 'states', 'keyframes'] },
    { id: 'data', label: 'Data', panels: ['data-bindings', 'variants'] },
  ]),
  inspectorTitle: 'Hero image',
  inspectorFields: [
    { key: 'src', label: 'Source URL' },
    { key: 'alt', label: 'Alt text' },
    { key: 'focalX', label: 'Focal X', type: 'number' },
    { key: 'focalY', label: 'Focal Y', type: 'number' },
    {
      key: 'cornerStyle',
      label: 'Corners',
      type: 'select',
      options: [
        { label: 'Rounded', value: 'rounded' },
        { label: 'Square', value: 'square' },
        { label: 'Pill', value: 'pill' },
      ],
    },
  ],
  renderStage: renderHeroImageWidget,
  renderExport: (node) => renderImageExport(node, 'hero-image'),
  buildPortableExport: (node) => ({
    props: {
      ...node.props,
      exportRole: 'hero-image',
      src: String(node.props.src ?? ''),
      alt: String(node.props.alt ?? ''),
      focalX: Number(node.props.focalX ?? 50),
      focalY: Number(node.props.focalY ?? 50),
      fit: String(node.style.fit ?? 'cover'),
    },
  }),
  renderLabel: () => 'Hero Image',
};
