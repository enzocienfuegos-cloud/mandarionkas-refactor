import { createModuleDefinition } from '../module-definition-factory';
import { renderImageCarouselStage } from '../image-carousel.renderer';
import { getBaseWidgetStyle, escapeHtml } from '../../registry/export-helpers';

function parseSlides(raw: string): Array<{ src: string; caption: string }> {
  return raw
    .split(';')
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item, index) => {
      const [src, caption] = item.split('|');
      return { src: (src ?? '').trim(), caption: (caption ?? `Slide ${index + 1}`).trim() };
    })
    .filter((item) => item.src);
}

function renderImageCarouselExport(node: import('../../../domain/document/types').WidgetNode): string {
  const slides = parseSlides(String(node.props.slides ?? ''));
  const activeSlide = slides[0];
  const base = `${getBaseWidgetStyle(node)};padding:0;overflow:hidden;display:flex;flex-direction:column;`;
  if (!activeSlide) {
    return `<div class="widget widget-image-carousel" data-widget-id="${node.id}" style="${base};align-items:center;justify-content:center;">No slides</div>`;
  }
  return `<div class="widget widget-image-carousel" data-widget-id="${node.id}" style="${base}">
    <img src="${escapeHtml(activeSlide.src)}" alt="${escapeHtml(activeSlide.caption)}" style="width:100%;height:100%;display:block;object-fit:cover;" />
    <div style="position:absolute;left:12px;right:12px;bottom:12px;display:flex;justify-content:space-between;align-items:end;gap:8px;">
      <div style="border-radius:10px;padding:8px 10px;background:rgba(15,23,42,.68);font-size:12px;color:#fff;">${escapeHtml(activeSlide.caption)}</div>
      <div style="border-radius:999px;padding:6px 10px;background:rgba(15,23,42,.72);font-size:11px;color:#fff;">${slides.length} slide${slides.length === 1 ? '' : 's'} · first-state export</div>
    </div>
  </div>`;
}

export const ImageCarouselDefinition = createModuleDefinition({
  type: 'image-carousel',
  label: 'Image Carousel',
  category: 'media',
  frame: { x: 80, y: 60, width: 320, height: 180, rotation: 0 },
  props: { title: 'Image Carousel', slides: 'https://images.unsplash.com/photo-1491553895911-0055eca6402d?w=1200&q=80|Road trip;https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?w=1200&q=80|Beach escape;https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1200&q=80|Ocean light', autoplay: true, intervalMs: 2600 },
  inspectorFields: [{ key: 'title' }, { key: 'slides', type: 'textarea' }, { key: 'autoplay', type: 'checkbox' }, { key: 'intervalMs', label: 'Interval ms', type: 'number' }],
  style: { backgroundColor: '#0f172a', accentColor: '#f8fafc', color: '#ffffff' },
  renderStage: renderImageCarouselStage,
  renderExport: (node) => renderImageCarouselExport(node),
});
