import { createElement } from 'react';
import { createModuleDefinition } from '../module-definition-factory';
import { META_CAROUSEL_DEFAULT_PROPS } from '../meta-carousel.shared';
import { renderMetaCarouselStage } from '../meta-carousel.renderer';
import { MetaCarouselInspector } from '../meta-carousel.inspector';
import { SocialCarouselLibraryPreview, SocialCarouselThumb } from '../../registry/widget-thumbnails';

export const MetaCarouselDefinition = createModuleDefinition({
  type: 'meta-carousel',
  label: 'Meta Carousel',
  category: 'interactive',
  thumbnail: SocialCarouselThumb,
  renderLibraryPreview: SocialCarouselLibraryPreview,
  description: 'Feed-style carousel with up to five cards, CTA, and sponsored brand framing.',
  recommendedSize: { width: 300, height: 420, label: 'Feed portrait' },
  requiresAsset: true,
  mraidCompatibility: 'warning',
  frame: { x: 10, y: 10, width: 300, height: 420, rotation: 0 },
  props: META_CAROUSEL_DEFAULT_PROPS,
  style: {
    backgroundColor: '#ffffff',
    accentColor: '#1877f2',
    color: '#050505',
    modulePreset: 'social',
  },
  renderStage: renderMetaCarouselStage,
  renderInspector: (node) => createElement(MetaCarouselInspector, { node }),
  exportDetail: 'Meta Carousel Ad · up to 5 slides',
});
