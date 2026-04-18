import { createElement } from 'react';
import { createModuleDefinition } from '../module-definition-factory';
import { renderImageCarouselStage } from '../image-carousel.renderer';
import { GalleryAssetsInspector } from '../gallery-assets-inspector';

export const ImageCarouselDefinition = createModuleDefinition({
  type: 'image-carousel',
  label: 'Image Carousel',
  category: 'media',
  frame: { x: 80, y: 60, width: 320, height: 180, rotation: 0 },
  props: { title: 'Image Carousel', slides: '', assetIdsCsv: '', autoplay: true, intervalMs: 2600, cornerStyle: 'rounded' },
  renderInspector: (widget) => createElement(GalleryAssetsInspector, { widget, title: 'Image carousel' }),
  style: { backgroundColor: '#0f172a', accentColor: '#f8fafc', color: '#ffffff', borderRadius: 20 },
  renderStage: renderImageCarouselStage,
});
