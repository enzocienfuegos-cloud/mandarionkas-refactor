import { createElement } from 'react';
import { createModuleDefinition } from '../module-definition-factory';
import { renderTeadsLayout2Stage } from '../teads-layout2.renderer';
import { TeadsLayout2Inspector } from '../teads-layout2.inspector';
import { TEADS_LAYOUT2_DEFAULT_PROPS } from '../teads.shared';
import { TeadsLayout2Thumb } from '../../registry/widget-thumbnails';

export const TeadsLayout2Definition = createModuleDefinition({
  type: 'teads-layout2',
  label: 'Teads Layout 2',
  category: 'interactive',
  thumbnail: TeadsLayout2Thumb,
  frame: { x: 10, y: 10, width: 300, height: 380, rotation: 0 },
  props: TEADS_LAYOUT2_DEFAULT_PROPS,
  style: { backgroundColor: '#ffffff', accentColor: '#1877f2', color: '#050505' },
  renderStage: renderTeadsLayout2Stage,
  renderInspector: (node) => createElement(TeadsLayout2Inspector, { node }),
  exportDetail: 'Teads Social Video/Image Layout 2',
});
