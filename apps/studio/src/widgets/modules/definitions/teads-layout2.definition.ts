import { createElement } from 'react';
import { createModuleDefinition } from '../module-definition-factory';
import { renderTeadsLayout2Stage } from '../teads-layout2.renderer';
import { TeadsLayout2Inspector } from '../teads-layout2.inspector';

export const TeadsLayout2Definition = createModuleDefinition({
  type: 'teads-layout2',
  label: 'Teads Layout 2',
  category: 'interactive',
  frame: { x: 10, y: 10, width: 300, height: 380, rotation: 0 },
  props: {
    // Brand row
    brandLogoSrc: '',
    brandLogoAssetId: '',
    brandName: 'Brand Name',
    // Media (large center)
    mediaSrc: '',
    mediaAssetId: '',
    mediaKind: 'image',
    // CTA full-width button
    ctaLabel: 'Learn More',
    ctaUrl: '',
    // Primary text below CTA
    primaryText: 'Our mission is to foster a sustainable advertising and media ecosystem that funds quality journalism.',
  },
  style: { backgroundColor: '#ffffff', accentColor: '#1877f2', color: '#050505' },
  renderStage: renderTeadsLayout2Stage,
  renderInspector: (node) => createElement(TeadsLayout2Inspector, { node }),
  exportDetail: 'Teads Social Video/Image Layout 2',
});
