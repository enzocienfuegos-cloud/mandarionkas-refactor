import { useState } from 'react';
import type { WidgetNode } from '../../domain/document/types';
import type { RenderContext } from '../../canvas/stage/render-context';
import { escapeHtml, getBaseWidgetStyle } from '../registry/export-helpers';
import { clamp, getAccent, moduleBody, moduleHeader, moduleShell, renderCollapsedIfNeeded } from './shared-styles';
type GalleryItem = {
  src: string;
  title: string;
  subtitle?: string;
};

function parseGalleryItems(raw: unknown, fallbackCount = 0): GalleryItem[] {
  const value = String(raw ?? '').trim();
  if (value.startsWith('[')) {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return parsed
          .map((item, index): GalleryItem | null => {
            if (!item || typeof item !== 'object') return null;
            const src = typeof (item as { src?: unknown }).src === 'string' ? (item as { src: string }).src.trim() : '';
            const title = typeof (item as { title?: unknown }).title === 'string'
              ? (item as { title: string }).title.trim()
              : `Item ${index + 1}`;
            const subtitle = typeof (item as { subtitle?: unknown }).subtitle === 'string'
              ? (item as { subtitle: string }).subtitle.trim()
              : undefined;
            return src ? { src, title, subtitle } : null;
          })
          .filter((item): item is GalleryItem => Boolean(item));
      }
    } catch {
      // Fall through to placeholders below.
    }
  }
  return Array.from({ length: Math.max(0, fallbackCount) }, (_, index) => ({
    src: '',
    title: `Item ${index + 1}`,
  }));
}

function InteractiveGalleryModuleRenderer({ node, ctx }: { node: WidgetNode; ctx: RenderContext }): JSX.Element {
  const accent = getAccent(node);
  const items = parseGalleryItems(node.props.items, clamp(Number(node.props.itemCount ?? 4), 2, 6));
  const itemCount = items.length || clamp(Number(node.props.itemCount ?? 4), 2, 6);
  const [activeIndex, setActiveIndex] = useState(clamp(Number(node.props.activeIndex ?? 1), 1, itemCount) - 1);
  const activeItem = items[activeIndex] ?? items[0];

  return <div style={moduleShell(node, ctx)}><div style={moduleHeader(node)}>{String(node.props.title ?? node.name)}</div><div style={moduleBody}><div style={{ flex: 1, borderRadius: 12, overflow: 'hidden', background: `linear-gradient(135deg, ${accent}55, rgba(255,255,255,.08))`, display: 'grid' }}>{activeItem?.src ? <img src={activeItem.src} alt={activeItem.title} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} /> : <div style={{ display: 'grid', placeItems: 'center', fontSize: 26, fontWeight: 900 }}>{activeIndex + 1} / {itemCount}</div>}</div><div style={{ display: 'grid', gap: 2 }}><strong>{activeItem?.title ?? `Item ${activeIndex + 1}`}</strong>{activeItem?.subtitle ? <small style={{ opacity: 0.72 }}>{activeItem.subtitle}</small> : null}</div><div style={{ display: 'flex', gap: 8 }}><button type="button" onClick={(event) => { event.stopPropagation(); setActiveIndex((value) => (value - 1 + itemCount) % itemCount); }} style={{ flex: 1, borderRadius: 10, border: `1px solid ${accent}`, background: 'transparent', color: 'inherit', padding: '8px 10px' }}>Prev</button><button type="button" onClick={(event) => { event.stopPropagation(); setActiveIndex((value) => (value + 1) % itemCount); ctx.triggerWidgetAction('click'); }} style={{ flex: 1, borderRadius: 10, border: 'none', background: accent, color: '#111827', padding: '8px 10px', fontWeight: 800 }}>Next</button></div></div></div>;
}
export function renderInteractiveGalleryStage(node: WidgetNode, ctx: RenderContext): JSX.Element { const collapsed=renderCollapsedIfNeeded(node,ctx); if(collapsed) return collapsed; return <InteractiveGalleryModuleRenderer node={node} ctx={ctx}/>; }

export function renderInteractiveGalleryExport(node: WidgetNode): string {
  const items = parseGalleryItems(node.props.items, clamp(Number(node.props.itemCount ?? 4), 2, 6));
  const activeIndex = clamp(Number(node.props.activeIndex ?? 1), 1, Math.max(1, items.length || 1)) - 1;
  const activeItem = items[activeIndex] ?? items[0];
  const base = `${getBaseWidgetStyle(node)};flex-direction:column;justify-content:flex-start;align-items:stretch;padding:10px;gap:10px;`;
  const accent = escapeHtml(String(node.style.accentColor ?? '#111827'));
  const background = activeItem?.src
    ? `<img src="${escapeHtml(activeItem.src)}" alt="${escapeHtml(activeItem.title)}" style="width:100%;height:100%;object-fit:cover;display:block;" />`
    : `<div style="width:100%;height:100%;display:grid;place-items:center;font-size:26px;font-weight:900;">${activeIndex + 1} / ${Math.max(1, items.length)}</div>`;
  return `<div class="widget widget-interactive-gallery" data-widget-id="${node.id}" style="${base}"><div style="font-size:12px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;color:${accent};">${escapeHtml(String(node.props.title ?? node.name))}</div><div style="flex:1;min-height:0;border-radius:12px;overflow:hidden;background:rgba(255,255,255,0.06);">${background}</div><div style="display:grid;gap:2px;"><strong>${escapeHtml(activeItem?.title ?? `Item ${activeIndex + 1}`)}</strong>${activeItem?.subtitle ? `<small style="opacity:.72;">${escapeHtml(activeItem.subtitle)}</small>` : ''}</div><div style="display:flex;gap:8px;"><button class="widget-cta" type="button" style="flex:1;border-radius:10px;border:1px solid ${accent};background:transparent;color:inherit;padding:8px 10px;">Prev</button><button class="widget-cta" type="button" style="flex:1;border-radius:10px;border:none;background:${accent};color:#111827;padding:8px 10px;font-weight:800;">Next</button></div></div>`;
}
