import type { WidgetNode } from '../../domain/document/types';
import { escapeHtml, getBaseWidgetStyle, renderGenericExport } from './export-helpers';

export function renderTextExport(node: WidgetNode): string {
  const textAlign = escapeHtml(String(node.style.textAlign ?? 'left'));
  const letterSpacing = escapeHtml(String(node.style.letterSpacing ?? '0'));
  const lineHeight = escapeHtml(String(node.style.lineHeight ?? 1.1));
  const base = `${getBaseWidgetStyle(node)};background:transparent;border:none;justify-content:flex-start;align-items:flex-start;padding:0;white-space:pre-wrap;text-align:${textAlign};letter-spacing:${letterSpacing};line-height:${lineHeight};`;
  return `<div class="widget widget-text" data-widget-id="${node.id}" style="${base}"><span data-text-slot="primary">${escapeHtml(node.props.text ?? '')}</span></div>`;
}

export function renderCtaExport(node: WidgetNode): string {
  const base = `${getBaseWidgetStyle(node)};cursor:pointer;`;
  return `<button class="widget widget-cta" data-widget-id="${node.id}" style="${base}"><span data-text-slot="primary">${escapeHtml(node.props.text ?? node.name)}</span></button>`;
}

export function renderImageExport(node: WidgetNode, kind: 'image' | 'hero-image' = 'image'): string {
  const src = String(node.props.src ?? '').trim();
  if (!src) {
    const detail = escapeHtml(String(node.props.alt ?? (kind === 'hero-image' ? 'Hero image' : 'Image placeholder')));
    return renderGenericExport(node, node.name, detail);
  }
  const base = getBaseWidgetStyle(node);
  const alt = escapeHtml(String(node.props.alt ?? (kind === 'hero-image' ? 'Hero image' : node.name)));
  const objectPosition = `${escapeHtml(String(node.props.focalX ?? 50))}% ${escapeHtml(String(node.props.focalY ?? 50))}%`;
  return `<img class="widget widget-${kind}" data-widget-id="${node.id}" src="${escapeHtml(src)}" alt="${alt}" style="${base};display:block;object-fit:${escapeHtml(String(node.style.fit ?? 'cover'))};object-position:${objectPosition};padding:0;" />`;
}

export function renderVideoExport(node: WidgetNode): string {
  const src = String(node.props.src ?? '').trim();
  const posterSrc = String(node.props.posterSrc ?? '').trim();
  if (!src && !posterSrc) {
    return renderGenericExport(node, node.name, 'Video hero');
  }
  const base = getBaseWidgetStyle(node);
  if (posterSrc) {
    return `<div class="widget widget-video-hero" data-widget-id="${node.id}" style="${base};padding:0;overflow:hidden;position:absolute;">
      <img src="${escapeHtml(posterSrc)}" alt="${escapeHtml(String(node.name))}" style="width:100%;height:100%;display:block;object-fit:${escapeHtml(String(node.style.fit ?? 'cover'))};" />
      <div style="position:absolute;right:12px;bottom:12px;padding:6px 10px;border-radius:999px;background:rgba(15,23,42,.72);color:#fff;font-size:12px;font-weight:700;">Video fallback</div>
    </div>`;
  }
  return `<div class="widget widget-video-hero" data-widget-id="${node.id}" style="${base};display:flex;align-items:center;justify-content:center;gap:8px;">
    <span style="font-weight:700;">Video source linked</span>
  </div>`;
}

export function renderShapeExport(node: WidgetNode): string {
  const shape = String(node.props.shape ?? 'rectangle');
  const borderRadius = shape === 'pill'
    ? '999px'
    : shape === 'circle'
      ? '999px'
      : `${Number(node.style.borderRadius ?? 16)}px`;
  const base = `${getBaseWidgetStyle(node)};border-radius:${borderRadius};box-shadow:${escapeHtml(String(node.style.boxShadow ?? 'none'))};`;
  return `<div class="widget widget-shape" data-widget-id="${node.id}" style="${base};"></div>`;
}

export function renderButtonsExport(node: WidgetNode): string {
  const base = `${getBaseWidgetStyle(node)};justify-content:stretch;align-items:stretch;padding:12px;gap:10px;flex-direction:column;background:${escapeHtml(String(node.style.backgroundColor ?? '#0f766e'))};border:1px solid ${escapeHtml(String(node.style.borderColor ?? 'rgba(255,255,255,0.12)'))};`;
  const accent = escapeHtml(String(node.style.accentColor ?? '#67e8f9'));
  const title = escapeHtml(String(node.props.title ?? node.name));
  const primaryLabel = escapeHtml(String(node.props.primaryLabel ?? 'Primary'));
  const secondaryLabel = escapeHtml(String(node.props.secondaryLabel ?? 'Secondary'));
  const vertical = String(node.props.orientation ?? 'horizontal') === 'vertical';
  const stackDirection = vertical ? 'column' : 'row';
  return `<div class="widget widget-buttons" data-widget-id="${node.id}" style="${base}">
    <div data-text-slot="title" style="font-size:12px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;opacity:.82;">${title}</div>
    <div style="display:flex;flex:1;gap:8px;flex-direction:${stackDirection};align-items:stretch;">
      <div data-target-key="primary-button" style="flex:1;display:flex;align-items:center;justify-content:center;padding:10px 12px;border-radius:12px;background:${accent};color:#0f172a;font-weight:800;"><span data-text-slot="primary">${primaryLabel}</span></div>
      <div data-target-key="secondary-button" style="flex:1;display:flex;align-items:center;justify-content:center;padding:10px 12px;border-radius:12px;border:1px solid ${accent};background:transparent;color:#ffffff;font-weight:800;"><span data-text-slot="secondary">${secondaryLabel}</span></div>
    </div>
  </div>`;
}

export function renderInteractiveHotspotExport(node: WidgetNode): string {
  const base = `${getBaseWidgetStyle(node)};padding:10px;background:${escapeHtml(String(node.style.backgroundColor ?? '#172554'))};border:1px solid ${escapeHtml(String(node.style.borderColor ?? 'rgba(255,255,255,0.12)'))};`;
  const accent = escapeHtml(String(node.style.accentColor ?? '#f59e0b'));
  const title = escapeHtml(String(node.props.title ?? node.name));
  const label = escapeHtml(String(node.props.label ?? 'Tap point'));
  const hotspotX = Number(node.props.hotspotX ?? 55);
  const hotspotY = Number(node.props.hotspotY ?? 45);
  return `<div class="widget widget-interactive-hotspot" data-widget-id="${node.id}" style="${base}">
    <div style="position:relative;width:100%;height:100%;border-radius:12px;background:linear-gradient(135deg,#1e3a8a,#172554);overflow:hidden;">
      <div data-text-slot="title" style="position:absolute;left:12px;top:12px;font-size:12px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;opacity:.88;">${title}</div>
      <div data-target-key="hotspot-pin" style="position:absolute;left:${hotspotX}%;top:${hotspotY}%;transform:translate(-50%,-50%);width:24px;height:24px;border-radius:999px;background:${accent};box-shadow:0 0 0 6px rgba(245,158,11,.24), 0 0 0 18px rgba(245,158,11,.1);"></div>
      <div data-target-key="hotspot-card" style="position:absolute;left:12px;right:12px;bottom:12px;padding:10px 12px;border-radius:12px;background:rgba(15,23,42,.82);border:1px solid rgba(255,255,255,.08);text-align:left;">
        <div style="font-size:12px;opacity:.78;margin-bottom:4px;">Hotspot</div>
        <div data-text-slot="primary" style="font-size:14px;font-weight:700;">${label}</div>
      </div>
    </div>
  </div>`;
}
