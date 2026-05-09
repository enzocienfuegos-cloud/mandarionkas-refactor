import { createElement } from 'react';
import { createModuleDefinition } from '../module-definition-factory';
import { renderTeadsLayout1Stage } from '../teads-layout1.renderer';
import { TeadsLayout1Inspector } from '../teads-layout1.inspector';
import { TEADS_LAYOUT1_DEFAULT_PROPS } from '../teads.shared';
import { TeadsLayout1Thumb } from '../../registry/widget-thumbnails';

export const TeadsLayout1Definition = createModuleDefinition({
  type: 'teads-layout1',
  label: 'Teads Layout 1',
  category: 'interactive',
  thumbnail: TeadsLayout1Thumb,
  frame: { x: 10, y: 10, width: 300, height: 420, rotation: 0 },
  props: TEADS_LAYOUT1_DEFAULT_PROPS,
  style: { backgroundColor: '#ffffff', accentColor: '#1877f2', color: '#050505' },
  renderStage: renderTeadsLayout1Stage,
  renderInspector: (node) => createElement(TeadsLayout1Inspector, { node }),
  exportDetail: 'Teads Social Video/Image Layout 1',
});
