import { createElement } from 'react';
import { createModuleDefinition } from '../module-definition-factory';
import { renderDragTokenPoolStage } from '../drag-token-pool.renderer';
import { DragTokenPoolInspector } from '../drag-token-pool.inspector';

export const DragTokenPoolDefinition = createModuleDefinition({
  type: 'drag-token-pool',
  label: 'Drag Token Pool',
  category: 'interactive',
  frame: { x: 20, y: 20, width: 280, height: 96, rotation: 0 },
  props: { tokens: '[]', disabledIds: '', dropTargetId: '', tokenSize: 72, gap: 16 },
  style: { backgroundColor: 'transparent', accentColor: '#ffffff', color: '#ffffff' },
  renderStage: renderDragTokenPoolStage,
  renderInspector: (node) => createElement(DragTokenPoolInspector, { node }),
  exportDetail: 'Bocadeli World Cup token pool',
});
