import { createElement } from 'react';
import { createModuleDefinition } from '../module-definition-factory';
import { renderTeadsLayout1Stage } from '../teads-layout1.renderer';
import { TeadsLayout1Inspector } from '../teads-layout1.inspector';

export const TeadsLayout1Definition = createModuleDefinition({
  type: 'teads-layout1',
  label: 'Teads Layout 1',
  category: 'interactive',
  frame: { x: 10, y: 10, width: 300, height: 420, rotation: 0 },
  props: {
    // Brand row
    brandLogoSrc: '',
    brandLogoAssetId: '',
    brandName: 'Brand Name',
    // Primary text (above media)
    primaryText: 'Our mission is to foster a sustainable advertising and media ecosystem.',
    // Media (center)
    mediaSrc: '',
    mediaAssetId: '',
    mediaKind: 'image',
    // Footer fields
    websiteDisplay: 'brand.com',
    description: 'Together, we innovate.',
    headline: 'The Global Media Platform',
    ctaLabel: 'Learn More',
    ctaUrl: '',
  },
  style: { backgroundColor: '#ffffff', accentColor: '#1877f2', color: '#050505' },
  renderStage: renderTeadsLayout1Stage,
  renderInspector: (node) => createElement(TeadsLayout1Inspector, { node }),
  exportDetail: 'Teads Social Video/Image Layout 1',
});
