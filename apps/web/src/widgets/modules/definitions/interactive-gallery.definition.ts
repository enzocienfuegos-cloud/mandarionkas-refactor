import { createElement } from 'react';
import { createModuleDefinition } from '../module-definition-factory';
import { renderInteractiveGalleryExport, renderInteractiveGalleryStage } from '../interactive-gallery.renderer';
import { InteractiveGalleryInspector } from '../interactive-gallery.inspector';

export const InteractiveGalleryDefinition = createModuleDefinition({
  type: 'interactive-gallery',
  label: 'Interactive Gallery',
  category: 'interactive',
  frame: { x: 80, y: 60, width: 240, height: 128, rotation: 0 },
  props: { title: 'Gallery', itemCount: 4, activeIndex: 1, arrowStyle: 'chevron', items: '' },
  style: { backgroundColor: '#ffffff', accentColor: '#111827', color: '#111827' },
  renderInspector: (node) => createElement(InteractiveGalleryInspector, { widget: node }),
  renderStage: renderInteractiveGalleryStage,
  renderExport: (node) => renderInteractiveGalleryExport(node),
});
