import { createId } from '../../domain/document/factories';
import { renderShapeWidget, renderShapeMaskInspector } from './shape.renderer';
import { createInspectorTabs, type WidgetDefinition } from '../registry/widget-definition';
import { renderShapeExport } from '../registry/base-exporters';

export const shapeDefinition: WidgetDefinition = {
  type: 'shape',
  label: 'Shape',
  category: 'layout',
  defaults: (sceneId, zIndex) => ({
    id: createId('shape'),
    type: 'shape',
    name: 'Shape',
    sceneId,
    zIndex,
    frame: { x: 320, y: 40, width: 180, height: 80, rotation: 0 },
    props: { shape: 'rectangle', maskSrc: '', maskAssetId: '', maskFit: 'cover', maskFocalX: 50, maskFocalY: 50 },
    style: { backgroundColor: '#f6a11c' },
    timeline: { startMs: 0, endMs: 15000 },
  }),
  inspectorSections: ['position-size', 'fill', 'timing', 'states', 'data-bindings', 'variants'],
  inspectorTabs: createInspectorTabs([
    { id: 'basics', label: 'Basics', panels: ['position-size', 'widget-fields', 'fill', 'timing'] },
    { id: 'behavior', label: 'Behavior', panels: ['conditions', 'actions', 'states', 'keyframes'] },
    { id: 'data', label: 'Data', panels: ['data-bindings', 'variants'] },
  ]),
  inspectorTitle: 'Shape',
  inspectorFields: [
    {
      key: 'shape',
      label: 'Shape',
      type: 'select',
      options: [
        { label: 'Rectangle', value: 'rectangle' },
        { label: 'Square', value: 'square' },
        { label: 'Circle', value: 'circle' },
        { label: 'Triangle', value: 'triangle' },
        { label: 'Line', value: 'line' },
        { label: 'Arrow', value: 'arrow' },
      ],
    },
  ],
  renderInspector: renderShapeMaskInspector,
  renderStage: renderShapeWidget,
  renderExport: (node) => renderShapeExport(node),
  renderLabel: () => 'Shape',
};
