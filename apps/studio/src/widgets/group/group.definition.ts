import { createId } from '../../domain/document/factories';
import { renderGroupWidget } from './group.renderer';
import { createInspectorTabs, type WidgetDefinition } from '../registry/widget-definition';
import { renderGenericExport } from '../registry/export-helpers';

export const groupDefinition: WidgetDefinition = {
  type: 'group',
  label: 'Group',
  category: 'layout',
  defaults: (sceneId, zIndex) => ({
    id: createId('group'),
    type: 'group',
    name: 'Group',
    sceneId,
    zIndex,
    frame: { x: 80, y: 80, width: 240, height: 160, rotation: 0 },
    props: { title: 'Group' },
    style: { backgroundColor: 'transparent', accentColor: '#8b5cf6', color: '#ffffff' },
    timeline: { startMs: 0, endMs: 15000 },
    childIds: [],
  }),
  inspectorSections: ['position-size', 'module-config', 'timing', 'states'],
  inspectorTabs: createInspectorTabs([
    { id: 'basics', label: 'Basics', panels: ['position-size', 'widget-fields', 'timing'] },
    { id: 'behavior', label: 'Behavior', panels: ['conditions', 'actions', 'states', 'keyframes'] },
  ]),
  inspectorTitle: 'Group settings',
  inspectorFields: [{ key: 'title', label: 'Title' }],
  renderStage: renderGroupWidget,
  renderExport: (node) => renderGenericExport(node, node.name, 'Group'),
  renderLabel: (node) => node.name,
};
