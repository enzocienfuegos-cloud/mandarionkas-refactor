import { createElement } from 'react';
import { createModuleDefinition } from '../module-definition-factory';
import { renderImageCarouselExport } from '../export-renderers';
import { renderImageCarouselStage } from '../image-carousel.renderer';
import { ImageCarouselInspector } from '../image-carousel.inspector';

export const ImageCarouselDefinition = createModuleDefinition({
  type: 'image-carousel',
  label: 'Image Carousel',
  category: 'media',
  frame: { x: 80, y: 60, width: 320, height: 180, rotation: 0 },
  props: {
    title: 'Image Carousel',
    slides: '',
    assetIdsCsv: '',
    autoplay: true,
    intervalMs: 2600,
    cornerStyle: 'rounded',
    showPrevButton: true,
    showNextButton: true,
    showPaginationDots: true,
    paginationDotSize: 3,
  },
  renderInspector: (widget) => createElement(ImageCarouselInspector, { widget }),
  style: { backgroundColor: '#0f172a', accentColor: '#f8fafc', color: '#ffffff', borderRadius: 20 },
  renderStage: renderImageCarouselStage,
  renderExport: (node, state, assetPathMap) => renderImageCarouselExport(node, state, assetPathMap),
});
