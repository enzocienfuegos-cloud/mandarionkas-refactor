import { createElement } from 'react';
import { createModuleDefinition } from '../module-definition-factory';
import { renderMetaCarouselStage } from '../meta-carousel.renderer';
import { MetaCarouselInspector } from '../meta-carousel.inspector';

export const MetaCarouselDefinition = createModuleDefinition({
  type: 'meta-carousel',
  label: 'Meta Carousel',
  category: 'interactive',
  frame: { x: 10, y: 10, width: 300, height: 420, rotation: 0 },
  props: {
    // Account
    brandName: 'Brand Name',
    brandAvatarSrc: '',
    brandAvatarAssetId: '',
    sponsoredLabel: 'Sponsored',
    primaryText: 'Check out our latest products.',
    // Global CTA
    ctaLabel: 'Shop Now',
    ctaUrl: '',
    // Carousel sizing
    cardWidthPct: 75,     // card width as % of widget width
    imageHeightPct: 60,   // image area as % of carousel zone
    cardGap: 10,          // gap between cards in px
    cardRadius: 8,        // border-radius of cards in px
    // Slides (up to 5)
    slideCount: 3,
    slide1Src: '', slide1AssetId: '', slide1Kind: 'image', slide1Title: 'Product 1', slide1Description: '',
    slide2Src: '', slide2AssetId: '', slide2Kind: 'image', slide2Title: 'Product 2', slide2Description: '',
    slide3Src: '', slide3AssetId: '', slide3Kind: 'image', slide3Title: 'Product 3', slide3Description: '',
    slide4Src: '', slide4AssetId: '', slide4Kind: 'image', slide4Title: 'Product 4', slide4Description: '',
    slide5Src: '', slide5AssetId: '', slide5Kind: 'image', slide5Title: 'Product 5', slide5Description: '',
  },
  style: { backgroundColor: '#ffffff', accentColor: '#1877f2', color: '#050505' },
  renderStage: renderMetaCarouselStage,
  renderInspector: (node) => createElement(MetaCarouselInspector, { node }),
  exportDetail: 'Meta Carousel Ad · up to 5 slides',
});
