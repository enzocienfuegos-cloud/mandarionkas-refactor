import { createElement } from 'react';
import { createId } from '../../domain/document/factories';
import { renderGroupWidget } from './group.renderer';
import { createInspectorTabs, type WidgetDefinition } from '../registry/widget-definition';
import { GroupThumb } from '../registry/widget-thumbnails';
import { GroupInspector } from './group.inspector';
import { renderGroupExport } from './group.export';
import { DEFAULT_SCRATCH_AUTO_REVEAL_THRESHOLD, DEFAULT_SCRATCH_MILESTONES } from './group-scratch-constants';

export const groupDefinition: WidgetDefinition = {
  type: 'group',
  label: 'Group',
  category: 'layout',
  thumbnail: GroupThumb,
  defaults: (sceneId, zIndex) => ({
    id: createId('group'),
    type: 'group',
    name: 'Group',
    sceneId,
    zIndex,
    frame: { x: 80, y: 80, width: 240, height: 160, rotation: 0 },
    props: {
      title: 'Group',
      scratchEnabled: false,
      revealTargetMode: 'auto',
      revealTargetId: '',
      coverLabel: 'Scratch to reveal',
      beforeImage: '',
      beforeAssetId: '',
      scratchCoverAssetId: '',
      coverBlur: 0,
      scratchRadius: 22,
      autoRevealThresholdPercent: DEFAULT_SCRATCH_AUTO_REVEAL_THRESHOLD,
      scratchMilestones: DEFAULT_SCRATCH_MILESTONES,
      scratchActivationMode: 'delay',
      scratchActivationDelayMs: 0,
    },
    style: { backgroundColor: 'transparent', accentColor: '#8b5cf6', color: '#ffffff' },
    timeline: { startMs: 0, endMs: 15000 },
    childIds: [],
  }),
  inspectorSections: ['position-size', 'module-config', 'shadow', 'timing', 'states'],
  inspectorTabs: createInspectorTabs([
    { id: 'basics', label: 'Basics', panels: ['position-size', 'widget-fields', 'shadow', 'timing'] },
    { id: 'behavior', label: 'Behavior', panels: ['conditions', 'actions', 'states', 'keyframes'] },
  ]),
  inspectorTitle: 'Group settings',
  renderInspector: (widget) => createElement(GroupInspector, { widget }),
  capabilities: {
    supportsMotion: true,
    supportsHoverMotion: false,
    hasAccentColor: true,
    exposesActions: true,
    isContainer: true,
    hasTitleVariant: true,
  },
  renderStage: renderGroupWidget,
  renderExport: (node, state, assetPathMap) => renderGroupExport(node, state, assetPathMap),
  renderLabel: (node) => node.name,
};
