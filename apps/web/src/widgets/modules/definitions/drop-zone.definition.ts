import { createElement } from 'react';
import { createModuleDefinition } from '../module-definition-factory';
import { renderDropZoneStage } from '../drop-zone.renderer';
import { DropZoneInspector } from '../drop-zone.inspector';

export const DropZoneDefinition = createModuleDefinition({
  type: 'drop-zone',
  label: 'Drop Zone',
  category: 'interactive',
  frame: { x: 60, y: 60, width: 140, height: 140, rotation: 0 },
  props: { acceptsSource: '', hitPadding: 16, width: 120, height: 120, debugOutline: true, onMatchAction: '' },
  style: { backgroundColor: 'transparent', accentColor: '#00e5ff', color: '#ffffff' },
  renderStage: renderDropZoneStage,
  renderInspector: (node) => createElement(DropZoneInspector, { node }),
  exportDetail: 'Bocadeli World Cup drop zone',
});
