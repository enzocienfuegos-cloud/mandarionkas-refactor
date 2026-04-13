import { createModuleDefinition } from '../module-definition-factory';
import { renderImageCarouselStage } from '../image-carousel.renderer';

export const ImageCarouselDefinition = createModuleDefinition({
  type: 'image-carousel',
  label: 'Image Carousel',
  category: 'media',
  frame: { x: 80, y: 60, width: 320, height: 180, rotation: 0 },
  props: { title: 'Image Carousel', slides: 'https://images.unsplash.com/photo-1491553895911-0055eca6402d?w=1200&q=80|Road trip;https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?w=1200&q=80|Beach escape;https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1200&q=80|Ocean light', autoplay: true, intervalMs: 2600 },
  inspectorFields: [{ key: 'title' }, { key: 'slides', type: 'textarea' }, { key: 'autoplay', type: 'checkbox' }, { key: 'intervalMs', label: 'Interval ms', type: 'number' }],
  style: { backgroundColor: '#0f172a', accentColor: '#f8fafc', color: '#ffffff' },
  renderStage: renderImageCarouselStage,
});
