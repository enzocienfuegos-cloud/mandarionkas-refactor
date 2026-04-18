import { createElement } from 'react';
import { createModuleDefinition } from '../module-definition-factory';
import { renderInteractiveGalleryStage } from '../interactive-gallery.renderer';
import { GalleryAssetsInspector } from '../gallery-assets-inspector';

export const InteractiveGalleryDefinition = createModuleDefinition({
  type: 'interactive-gallery',
  label: 'Interactive Gallery',
  category: 'interactive',
  frame: { x: 80, y: 60, width: 240, height: 128, rotation: 0 },
  props: {
    title: 'Gallery',
    slides: '',
    assetIdsCsv: '',
    itemCount: 4,
    activeIndex: 1,
    arrowStyle: 'chevron',
    cornerStyle: 'rounded',
    showPrevButton: true,
    showNextButton: true,
    showPaginationDots: true,
    paginationDotSize: 6,
  },
  renderInspector: (widget) => createElement(GalleryAssetsInspector, { widget, title: 'Interactive gallery' }),
  style: { backgroundColor: '#ffffff', accentColor: '#111827', color: '#111827', borderRadius: 20 },
  renderStage: renderInteractiveGalleryStage,
});
