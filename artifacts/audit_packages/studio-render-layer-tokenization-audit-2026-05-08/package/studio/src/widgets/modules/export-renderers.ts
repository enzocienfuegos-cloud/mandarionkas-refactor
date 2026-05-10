import type { WidgetNode } from '../../domain/document/types';
import { buildExportLeafletMapSrcdoc } from '../../export/leaflet-map-srcdoc';
import { escapeHtml } from '../registry/export-helpers';
import { BUTTONS_EXPORT_DEFAULT_PRIMARY_LABEL, BUTTONS_EXPORT_DEFAULT_SECONDARY_LABEL } from './buttons.shared';
import { buildQrPattern, getFlagEmoji, isFilenameLikeCaption } from './shared-styles';
import { parseShoppableProducts } from './shoppable-sidebar.shared';
import { resolveCornerRadius } from '../shared/corner-style';
import {
  buildPlaceCtaUrl,
  DYNAMIC_MAP_ACTION_LABELS,
  DYNAMIC_MAP_DEFAULT_CTA_LABEL,
  DYNAMIC_MAP_DEFAULT_CTA_TYPE,
  DYNAMIC_MAP_DEFAULT_LATITUDE,
  DYNAMIC_MAP_DEFAULT_LONGITUDE,
  DYNAMIC_MAP_DEFAULT_RENDER_MODE,
  DYNAMIC_MAP_DEFAULT_ZOOM,
  parseNearbyPlaces,
} from './dynamic-map.shared';
import {
  FORM_DEFAULT_CONSENT_LABEL,
  FORM_DEFAULT_CTA_LABEL,
  FORM_DEFAULT_FIELD_ONE_LABEL,
  FORM_DEFAULT_FIELD_THREE_LABEL,
  FORM_DEFAULT_FIELD_TWO_LABEL,
  FORM_DEFAULT_METHOD,
  FORM_DEFAULT_SUCCESS_MESSAGE,
} from './form.shared';
import {
  SHOPPABLE_PRODUCT_DEFAULT_CTA_LABEL,
  SHOPPABLE_PRODUCT_DEFAULT_ITEM,
  SHOPPABLE_PRODUCT_DEFAULT_PRICE,
} from './shoppable-sidebar.shared';
import { SPEED_TEST_DEFAULT_CTA_LABEL } from './speed-test.shared';
import { TRAVEL_DEAL_DEFAULT_PROPS } from './travel-deal.shared';
import { resolveWeatherIcon } from './weather-conditions.shared';

const exportPalette = {
  white: '#ffffff',
  slate50: '#f8fafc',
  ink: '#111827',
  slate: '#0f172a',
  darkSurface: '#1f2937',
  navy700: '#0b3b7a',
  teal700: '#0f766e',
  softBlue: '#dbeafe',
  softText: '#475569',
  mutedText: '#555',
  mutedTextSecondary: '#666',
  mutedTextStrong: '#334155',
  green: '#22c55e',
  teal: '#2dd4bf',
  sky: '#60a5fa',
  cyan: '#67e8f9',
  amber: '#f59e0b',
  red: '#ef4444',
  pink: '#ec4899',
  orange: '#f97316',
  bronze: '#9a3412',
  mapsBlue: '#4285f4',
  wazeBlue: '#08d4ff',
  darkOverlay: 'rgba(15,23,42,.68)',
  whitePanel: 'rgba(255,255,255,.78)',
  inkPanel: 'rgba(17,24,39,.94)',
  darkOverlaySoft: 'rgba(15,23,42,.24)',
  blackOverlay18: 'rgba(0,0,0,.18)',
  blackShadow20: 'rgba(0,0,0,.2)',
  blackShadow24: 'rgba(0,0,0,.24)',
  darkInputBorder: 'rgba(15,23,42,.12)',
  darkInputBorderSoft: 'rgba(15,23,42,.10)',
  softPanelBorder: 'rgba(0,0,0,.08)',
  darkShadowSoft: 'rgba(15,23,42,.08)',
  darkShadowMedium: 'rgba(15,23,42,.12)',
  whiteText40: 'rgba(255,255,255,.4)',
  whiteText45: 'rgba(255,255,255,.45)',
  whiteText94: 'rgba(255,255,255,.94)',
  whiteBorder08: 'rgba(255,255,255,.08)',
  whiteBorder12: 'rgba(255,255,255,.12)',
  whiteBorder18: 'rgba(255,255,255,.18)',
  greenGaugeGlow: 'rgba(34,197,94,.20)',
  tealGaugeGlow: 'rgba(45,212,191,.28)',
  greenGaugeBorder: 'rgba(120,255,196,.24)',
  slateGradient: 'linear-gradient(135deg,#0f172a,#1e293b)',
  forestGradient: 'linear-gradient(135deg,#14532d,#365314)',
  skyGradient: 'linear-gradient(135deg,#dbeafe,#bfdbfe)',
  heroGradient: 'linear-gradient(160deg,#0f172a,#1d4ed8)',
  transparentToBlack: 'rgba(15,23,42,0)',
} as const;

function resolveAssetPath(src: unknown, assetPathMap: Record<string, string>): string {
  if (typeof src !== 'string') return '';
  return assetPathMap[src] ?? src;
}

function parseCarouselSlidesWithAssets(raw: unknown, assetPathMap: Record<string, string>): Array<{ src: string; caption: string }> {
  if (typeof raw !== 'string' || raw.trim().length === 0) return [];
  return raw
    .split(';')
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => {
      const [src, caption] = item.split('|');
      return {
        src: resolveAssetPath((src ?? '').trim(), assetPathMap),
        caption: (caption ?? '').trim(),
      };
    })
    .filter((item) => item.src);
}

function renderHotspotExportIcon(icon: string, counterRotate = false): string {
  const common = 'xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"';
  const transform = counterRotate ? ' style="display:inline-flex;transform:rotate(-45deg);"' : ' style="display:inline-flex;"';
  switch (icon) {
    case 'arrow-up':
      return `<span${transform}><svg ${common}><path d="M8 13V3"/><path d="M4.5 6.5L8 3l3.5 3.5"/></svg></span>`;
    case 'arrow-down':
      return `<span${transform}><svg ${common}><path d="M8 3v10"/><path d="M4.5 9.5L8 13l3.5-3.5"/></svg></span>`;
    case 'arrow-left':
      return `<span${transform}><svg ${common}><path d="M13 8H3"/><path d="M6.5 4.5L3 8l3.5 3.5"/></svg></span>`;
    case 'arrow-right':
      return `<span${transform}><svg ${common}><path d="M3 8h10"/><path d="M9.5 4.5L13 8l-3.5 3.5"/></svg></span>`;
    case 'info':
      return `<span${transform}><svg ${common}><circle cx="8" cy="8" r="5.25"/><path d="M8 7v3"/><path d="M8 4.75h.01"/></svg></span>`;
    default:
      return `<span${transform}><svg ${common}><path d="M8 3v10"/><path d="M3 8h10"/></svg></span>`;
  }
}

function renderChevronExportIcon(direction: 'left' | 'right'): string {
  return direction === 'left'
    ? '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" style="display:inline-flex;"><path d="M10 3.5L5.5 8 10 12.5"/></svg>'
    : '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" style="display:inline-flex;"><path d="M6 3.5L10.5 8 6 12.5"/></svg>';
}

function locateIconMarkup(color: string): string {
  return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="3.2" stroke="${escapeHtml(color)}" stroke-width="2"></circle><path d="M12 2.5v3.2M12 18.3v3.2M2.5 12h3.2M18.3 12h3.2" stroke="${escapeHtml(color)}" stroke-width="2" stroke-linecap="round"></path></svg>`;
}

export function renderVideoHeroExport(node: WidgetNode, _state: unknown, assetPathMap: Record<string, string> = {}): string {
  const frame = node.frame;
  const style = node.style ?? {};
  const src = resolveAssetPath(node.props.src, assetPathMap);
  const posterSrc = resolveAssetPath(node.props.posterSrc, assetPathMap);
  const base = [
    `position:absolute`,
    `left:${frame.x}px`,
    `top:${frame.y}px`,
    `width:${frame.width}px`,
    `height:${frame.height}px`,
    `transform:rotate(${frame.rotation}deg)`,
    `opacity:${Number(style.opacity ?? 1)}`,
    `overflow:hidden`,
    `box-sizing:border-box`,
    `border-radius:${Number(style.borderRadius ?? 12)}px`,
    `background:${String(style.backgroundColor ?? exportPalette.ink)}`,
  ].join(';');

  return `<div class="widget widget-video-hero" data-widget-id="${node.id}" style="${base}"><video src="${escapeHtml(src)}" ${posterSrc ? `poster="${escapeHtml(posterSrc)}"` : ''} ${Boolean(node.props.autoplay ?? true) ? 'autoplay' : ''} ${Boolean(node.props.muted ?? true) ? 'muted' : ''} ${Boolean(node.props.loop ?? true) ? 'loop' : ''} ${Boolean(node.props.controls ?? false) ? 'controls' : ''} playsinline style="width:100%;height:100%;display:block;object-fit:cover;"></video></div>`;
}

export function renderImageCarouselExport(node: WidgetNode, _state: unknown, assetPathMap: Record<string, string> = {}): string {
  const frame = node.frame;
  const style = node.style ?? {};
  const borderRadius = resolveCornerRadius(node, 20);
  const slides = parseCarouselSlidesWithAssets(node.props.slides, assetPathMap);
  const accent = String(style.accentColor ?? exportPalette.white);
  const activeSlide = slides[0];
  const base = [
    `position:absolute`,`left:${frame.x}px`,`top:${frame.y}px`,`width:${frame.width}px`,`height:${frame.height}px`,
    `transform:rotate(${frame.rotation}deg)`,`opacity:${Number(style.opacity ?? 1)}`,`overflow:hidden`,`box-sizing:border-box`,
    `border-radius:${borderRadius}px`,`background:${String(style.backgroundColor ?? exportPalette.ink)}`,`color:${String(style.color ?? exportPalette.white)}`,
    `display:flex`,`flex-direction:column`,
  ].join(';');
  const slidesJson = escapeHtml(JSON.stringify(slides));
  const showPrevButton = Boolean(node.props.showPrevButton ?? true);
  const showNextButton = Boolean(node.props.showNextButton ?? true);
  const showPaginationDots = Boolean(node.props.showPaginationDots ?? true);
  const paginationDotSize = Math.max(2, Math.min(5, Number(node.props.paginationDotSize ?? 3)));
  return `<div class="widget widget-image-carousel" data-widget-id="${node.id}" data-carousel-slides="${slidesJson}" data-carousel-index="0" data-carousel-accent="${escapeHtml(accent)}" style="${base}">
    <div style="padding:10px 12px 0;font-size:12px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;color:${escapeHtml(accent)};">${escapeHtml(String(node.props.title ?? node.name))}</div>
    <div style="position:relative;flex:1;margin:8px 12px 12px;border-radius:12px;overflow:hidden;background:${exportPalette.ink};">
      ${activeSlide ? `<img data-carousel-image src="${escapeHtml(activeSlide.src)}" alt="${escapeHtml(activeSlide.caption && !isFilenameLikeCaption(activeSlide.caption) ? activeSlide.caption : '')}" style="width:100%;height:100%;display:block;object-fit:cover;" />` : '<div style="width:100%;height:100%;display:grid;place-items:center;opacity:.7;">Add slides</div>'}
      <div style="position:absolute;inset-inline:12px;bottom:10px;display:flex;justify-content:space-between;align-items:end;gap:8px;">
        ${(activeSlide?.caption && !isFilenameLikeCaption(activeSlide.caption)) ? `<div data-carousel-caption style="border-radius:10px;padding:8px 10px;background:${exportPalette.darkOverlay};font-size:12px;">${escapeHtml(activeSlide.caption)}</div>` : '<div data-carousel-caption style="display:none;"></div>'}
        ${showPaginationDots ? `<div style="display:flex;gap:4px;align-items:center;flex-shrink:0;">${slides.map((_, index) => `<button type="button" data-smx-action="carousel-dot" data-widget-id="${node.id}" data-carousel-target="${index}" style="width:${paginationDotSize}px;min-width:${paginationDotSize}px;height:${paginationDotSize}px;min-height:${paginationDotSize}px;border-radius:50%;border:none;padding:0;margin:0;background:${index === 0 ? escapeHtml(accent) : exportPalette.whiteText45};cursor:pointer;appearance:none;-webkit-appearance:none;display:block;flex:0 0 auto;line-height:1;box-sizing:border-box;"></button>`).join('')}</div>` : ''}
      </div>
    </div>
    ${showPrevButton || showNextButton ? `<div style="display:flex;gap:8px;padding:0 12px 12px;">${showPrevButton ? `<button type="button" data-smx-action="carousel-prev" data-widget-id="${node.id}" style="flex:1;border-radius:10px;border:1px solid ${escapeHtml(accent)};background:transparent;color:inherit;padding:8px 10px;">Prev</button>` : ''}${showNextButton ? `<button type="button" data-smx-action="carousel-next" data-widget-id="${node.id}" style="flex:1;border-radius:10px;border:none;background:${escapeHtml(accent)};color:${exportPalette.ink};font-weight:800;padding:8px 10px;">Next</button>` : ''}</div>` : ''}
  </div>`;
}

export function renderInteractiveGalleryExport(node: WidgetNode): string {
  const frame = node.frame;
  const style = node.style ?? {};
  const accent = String(style.accentColor ?? exportPalette.ink);
  const slides = parseCarouselSlidesWithAssets(node.props.slides ?? node.props.items, {});
  const itemCount = Math.max(1, slides.length || Number(node.props.itemCount ?? 4));
  const activeIndex = Math.max(0, Math.min(itemCount - 1, Number(node.props.activeIndex ?? 1) - 1));
  const activeSlide = slides[activeIndex] ?? slides[0];
  const slidesJson = escapeHtml(JSON.stringify(slides));
  const showPrevButton = Boolean(node.props.showPrevButton ?? true);
  const showNextButton = Boolean(node.props.showNextButton ?? true);
  const showPaginationDots = Boolean(node.props.showPaginationDots ?? true);
  const paginationDotSize = Math.max(2, Math.min(6, Number(node.props.paginationDotSize ?? 4)));
  const base = [
    `position:absolute`,`left:${frame.x}px`,`top:${frame.y}px`,`width:${frame.width}px`,`height:${frame.height}px`,`transform:rotate(${frame.rotation}deg)`,
    `opacity:${Number(style.opacity ?? 1)}`,`overflow:hidden`,`box-sizing:border-box`,`border-radius:${Number(style.borderRadius ?? 14)}px`,
    `background:${String(style.backgroundColor ?? exportPalette.white)}`,`color:${String(style.color ?? exportPalette.ink)}`,`display:flex`,`flex-direction:column`,
  ].join(';');

  return `<div class="widget widget-interactive-gallery" data-widget-id="${node.id}" data-gallery-count="${itemCount}" data-gallery-index="${activeIndex}" data-gallery-slides="${slidesJson}" data-gallery-accent="${escapeHtml(accent)}" style="${base}">
    <div style="padding:10px 12px 0;font-size:12px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;color:${escapeHtml(accent)};">${escapeHtml(String(node.props.title ?? node.name))}</div>
    <div style="padding:8px 12px 12px;display:flex;flex:1;flex-direction:column;gap:10px;">
      <div data-gallery-card style="flex:1;border-radius:12px;overflow:hidden;background:${activeSlide ? exportPalette.ink : `linear-gradient(135deg, ${escapeHtml(accent)}55, ${exportPalette.whiteBorder08})`};display:grid;place-items:center;font-size:26px;font-weight:900;position:relative;">
        ${activeSlide ? `<img data-gallery-image src="${escapeHtml(activeSlide.src)}" alt="${escapeHtml(activeSlide.caption && !isFilenameLikeCaption(activeSlide.caption) ? activeSlide.caption : '')}" style="width:100%;height:100%;display:block;object-fit:cover;" />` : `${activeIndex + 1} / ${itemCount}`}
         ${activeSlide ? `<div style="position:absolute;left:12px;right:12px;bottom:12px;display:flex;justify-content:space-between;align-items:end;gap:8px;">${(activeSlide.caption && !isFilenameLikeCaption(activeSlide.caption)) ? `<div data-gallery-caption style="border-radius:10px;padding:8px 10px;background:${exportPalette.darkOverlay};font-size:12px;color:${exportPalette.white};">${escapeHtml(activeSlide.caption)}</div>` : '<div data-gallery-caption style="display:none;"></div>'}<div style="display:flex;align-items:center;gap:8px;">${showPaginationDots ? `<div style="display:flex;gap:6px;">${Array.from({ length: itemCount }, (_, index) => `<button type="button" data-smx-action="gallery-dot" data-widget-id="${node.id}" data-gallery-target="${index}" style="width:${paginationDotSize}px;height:${paginationDotSize}px;border-radius:50%;border:none;background:${index === activeIndex ? escapeHtml(accent) : exportPalette.whiteText40};cursor:pointer;"></button>`).join('')}</div>` : ''}<div data-gallery-count style="border-radius:999px;padding:4px 8px;background:${exportPalette.darkOverlay};font-size:12px;color:${exportPalette.white};">${activeIndex + 1} / ${itemCount}</div></div></div>` : ''}
      </div>
      ${showPrevButton || showNextButton ? `<div style="display:flex;gap:8px;">${showPrevButton ? `<button type="button" data-smx-action="gallery-prev" data-widget-id="${node.id}" style="flex:1;border-radius:10px;border:1px solid ${escapeHtml(accent)};background:transparent;color:inherit;padding:8px 10px;">Prev</button>` : ''}${showNextButton ? `<button type="button" data-smx-action="gallery-next" data-widget-id="${node.id}" style="flex:1;border-radius:10px;border:none;background:${escapeHtml(accent)};color:${String(style.backgroundColor ?? exportPalette.white)};padding:8px 10px;font-weight:800;">Next</button>` : ''}</div>` : ''}
    </div>
  </div>`;
}

export function renderInteractiveHotspotExport(node: WidgetNode): string {
  const frame = node.frame;
  const style = node.style ?? {};
  const accent = String(style.accentColor ?? exportPalette.amber);
  const hotspotX = Number(node.props.hotspotX ?? 55);
  const hotspotY = Number(node.props.hotspotY ?? 45);
  const hotspotShape = String(node.props.hotspotShape ?? 'circle');
  const hotspotIcon = String(node.props.hotspotIcon ?? 'plus');
  const base = [
    `position:absolute`,`left:${frame.x}px`,`top:${frame.y}px`,`width:${frame.width}px`,`height:${frame.height}px`,`transform:rotate(${frame.rotation}deg)`,
    `opacity:${Number(style.opacity ?? 1)}`,`overflow:hidden`,`box-sizing:border-box`,`border-radius:${Number(style.borderRadius ?? 14)}px`,
    `background:transparent`,`color:${String(style.color ?? exportPalette.white)}`,
  ].join(';');

  return `<div class="widget widget-interactive-hotspot" data-widget-id="${node.id}" data-hotspot-auto-close-ms="${Math.max(0, Number(node.props.autoCloseMs ?? 2000))}" style="${base}">
    <button type="button" data-smx-action="hotspot-toggle" data-widget-id="${node.id}" style="position:absolute;left:${hotspotX}%;top:${hotspotY}%;transform:translate(-50%,-50%)${hotspotShape === 'diamond' ? ' rotate(45deg)' : ''};width:${hotspotShape === 'pill' ? '44px' : '30px'};min-width:${hotspotShape === 'pill' ? '44px' : '30px'};max-width:${hotspotShape === 'pill' ? '44px' : '30px'};height:30px;min-height:30px;max-height:30px;inline-size:${hotspotShape === 'pill' ? '44px' : '30px'};min-inline-size:${hotspotShape === 'pill' ? '44px' : '30px'};max-inline-size:${hotspotShape === 'pill' ? '44px' : '30px'};block-size:30px;min-block-size:30px;max-block-size:30px;border-radius:${hotspotShape === 'square' ? '12px' : hotspotShape === 'pill' ? '999px' : hotspotShape === 'diamond' ? '10px' : '999px'};${hotspotShape === 'circle' ? 'clip-path:circle(50% at 50% 50%);' : ''}border:none;background:${escapeHtml(accent)};box-shadow:${String(node.props.hotspotEffect ?? 'pulse') === 'none' ? 'none' : `0 0 0 6px ${escapeHtml(accent)}33,0 0 0 18px ${escapeHtml(accent)}11`};cursor:pointer;font-weight:900;font-size:15px;line-height:1;padding:0;color:${exportPalette.ink};appearance:none;-webkit-appearance:none;display:grid;place-items:center;aspect-ratio:1 / 1;flex-shrink:0;box-sizing:border-box;overflow:hidden;">${renderHotspotExportIcon(hotspotIcon, hotspotShape === 'diamond')}</button>
    <button type="button" data-hotspot-panel data-smx-action="hotspot-toggle" data-widget-id="${node.id}" style="position:absolute;left:12px;right:12px;bottom:12px;border-radius:14px;background:${exportPalette.inkPanel};padding:10px 12px;display:none;gap:6px;border:none;text-align:left;color:inherit;cursor:pointer;">
      <div style="font-size:12px;font-weight:900;text-transform:uppercase;letter-spacing:.06em;color:${escapeHtml(accent)};">${escapeHtml(String(node.props.header ?? 'Interactive hotspot'))}</div>
      <div style="font-size:12px;line-height:1.45;">${escapeHtml(String(node.props.body ?? 'Add more context for this interactive point.'))}</div>
    </button>
    <div data-hotspot-label style="position:absolute;left:12px;bottom:12px;font-size:12px;">${escapeHtml(String(node.props.label ?? 'Tap point'))}</div>
  </div>`;
}

export function renderRangeSliderExport(node: WidgetNode): string {
  return renderRangeLikeExport(node, 'Range');
}

export function renderSliderExport(node: WidgetNode): string {
  return renderRangeLikeExport(node, 'Slider');
}

function renderRangeLikeExport(node: WidgetNode, label: string): string {
  const frame = node.frame;
  const style = node.style ?? {};
  const accent = String(style.accentColor ?? exportPalette.white);
  const min = Number(node.props.min ?? 0);
  const max = Number(node.props.max ?? 100);
  const value = Number(node.props.value ?? node.props.current ?? 50);
  const units = String(node.props.units ?? '');
  const base = [
    `position:absolute`,`left:${frame.x}px`,`top:${frame.y}px`,`width:${frame.width}px`,`height:${frame.height}px`,`transform:rotate(${frame.rotation}deg)`,
    `opacity:${Number(style.opacity ?? 1)}`,`overflow:hidden`,`box-sizing:border-box`,`border-radius:${Number(style.borderRadius ?? 14)}px`,
    `background:${String(style.backgroundColor ?? exportPalette.ink)}`,`color:${String(style.color ?? exportPalette.white)}`,`display:flex`,`flex-direction:column`,
  ].join(';');
  return `<div class="widget widget-${escapeHtml(node.type)}" data-widget-id="${node.id}" style="${base}">
    <div style="padding:10px 12px 0;font-size:12px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;color:${escapeHtml(accent)};">${escapeHtml(String(node.props.title ?? node.name))}</div>
    <div style="padding:8px 12px 12px;display:flex;flex:1;flex-direction:column;justify-content:center;gap:10px;">
      <input type="range" min="${min}" max="${max}" value="${value}" data-smx-action="range-update" data-widget-id="${node.id}" data-units="${escapeHtml(units)}" style="accent-color:${escapeHtml(accent)};" />
      <div data-range-value style="font-size:13px;font-weight:700;">${escapeHtml(label)}: ${value}${escapeHtml(units)}</div>
    </div>
  </div>`;
}

export function renderScratchRevealExport(node: WidgetNode): string {
  const frame = node.frame;
  const style = node.style ?? {};
  const accent = String(style.accentColor ?? exportPalette.orange);
  const coverLabel = String(node.props.coverLabel ?? 'Scratch to reveal');
  const revealLabel = String(node.props.revealLabel ?? '20% off today');
  const beforeImage = String(node.props.beforeImage ?? '');
  const afterImage = String(node.props.afterImage ?? '');
  const coverBlur = Math.max(0, Number(node.props.coverBlur ?? 6));
  const scratchRadius = Math.max(8, Number(node.props.scratchRadius ?? 22));
  const revealBackground = afterImage ? exportPalette.ink : `linear-gradient(135deg, ${accent}22, ${exportPalette.whiteBorder12})`;
  const base = [
    `position:absolute`,`left:${frame.x}px`,`top:${frame.y}px`,`width:${frame.width}px`,`height:${frame.height}px`,`transform:rotate(${frame.rotation}deg)`,
    `opacity:${Number(style.opacity ?? 1)}`,`overflow:hidden`,`box-sizing:border-box`,`border-radius:${Number(style.borderRadius ?? 14)}px`,
    `background:${String(style.backgroundColor ?? exportPalette.ink)}`,`color:${String(style.color ?? exportPalette.white)}`,`display:flex`,`flex-direction:column`,
  ].join(';');
  return `<div class="widget widget-scratch-reveal" data-widget-id="${node.id}" style="${base}">
    <div style="padding:10px 12px 0;font-size:12px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;color:${escapeHtml(accent)};">${escapeHtml(String(node.props.title ?? node.name))}</div>
    <div style="padding:8px 12px 12px;display:flex;flex:1;flex-direction:column;justify-content:center;gap:10px;">
      <div class="scratch-reveal-shell" data-scratch-widget-id="${node.id}" data-scratch-cover-image="${escapeHtml(beforeImage)}" data-scratch-cover-blur="${coverBlur}" data-scratch-radius="${scratchRadius}" data-scratch-accent="${escapeHtml(accent)}" style="position:relative;flex:1;border-radius:12px;overflow:hidden;background:${escapeHtml(revealBackground)};">
        ${afterImage ? `<img src="${escapeHtml(afterImage)}" alt="${escapeHtml(revealLabel)}" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;" />` : ''}
        <div style="position:absolute;inset:0;display:grid;place-items:center;font-weight:800;font-size:22px;text-align:center;padding:16px;">${escapeHtml(revealLabel)}</div>
        <canvas data-scratch-canvas style="position:absolute;inset:0;width:100%;height:100%;cursor:crosshair;touch-action:none;outline:none;background:transparent;-webkit-tap-highlight-color:transparent;user-select:none;"></canvas>
        <div style="position:absolute;left:12px;right:12px;bottom:12px;display:flex;flex-direction:column;gap:6px;pointer-events:none;">
          <div style="font-size:12px;">${escapeHtml(coverLabel)}</div>
        </div>
      </div>
    </div>
  </div>`;
}

export function renderQrCodeExport(node: WidgetNode): string {
  const frame = node.frame;
  const style = node.style ?? {};
  const accent = String(style.accentColor ?? exportPalette.ink);
  const url = String(node.props.url ?? '').trim();
  const qrScale = Math.max(0.3, Math.min(1, Number(node.props.qrScale ?? 0.72)));
  const qrPadding = Math.max(0, Number(node.props.qrPadding ?? 8));
  const qrSize = Math.max(72, Math.min(frame.width, frame.height - 24) * qrScale);
  const qrUrl = url ? `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(url)}` : '';
  const pattern = buildQrPattern(url);
  const base = [
    `position:absolute`,`left:${frame.x}px`,`top:${frame.y}px`,`width:${frame.width}px`,`height:${frame.height}px`,`transform:rotate(${frame.rotation}deg)`,
    `opacity:${Number(style.opacity ?? 1)}`,`overflow:hidden`,`box-sizing:border-box`,`border-radius:${Number(style.borderRadius ?? 14)}px`,
    `background:${String(style.backgroundColor ?? exportPalette.white)}`,`color:${String(style.color ?? exportPalette.ink)}`,`display:flex`,`flex-direction:column`,`cursor:pointer`,
  ].join(';');

  return `<button type="button" class="widget widget-qr-code" data-widget-id="${node.id}" data-smx-action="qr-open" data-qr-url="${escapeHtml(url)}" style="${base}">
    <div style="padding:10px 12px 0;font-size:12px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;color:${escapeHtml(accent)};">${escapeHtml(String(node.props.title ?? node.name))}</div>
    <div style="padding:8px 12px 12px;display:flex;flex:1;flex-direction:column;align-items:center;justify-content:center;gap:10px;">
      <div style="width:${qrSize}px;height:${qrSize}px;border-radius:14px;background:${exportPalette.white};padding:${qrPadding}px;display:grid;place-items:center;flex-shrink:0;">
        ${qrUrl ? `<img src="${escapeHtml(qrUrl)}" alt="${escapeHtml(String(node.props.codeLabel ?? 'QR code'))}" style="width:100%;height:100%;object-fit:contain;border-radius:8px;" onerror="this.replaceWith(this.nextElementSibling)" />` : ''}
        <div style="display:none;grid-template-columns:repeat(9,1fr);gap:2px;width:100%;height:100%;">
          ${pattern.map((filled) => `<div style="background:${filled ? escapeHtml(accent) : exportPalette.white};"></div>`).join('')}
        </div>
      </div>
      <div style="text-align:center;font-size:12px;color:${escapeHtml(String(style.color ?? exportPalette.ink))};">${escapeHtml(String(node.props.codeLabel ?? 'Scan me'))}</div>
    </div>
  </button>`;
}

export function renderFormExport(node: WidgetNode): string {
  const frame = node.frame;
  const style = node.style ?? {};
  const accent = String(style.accentColor ?? exportPalette.pink);
  const consentRequired = Boolean(node.props.consentRequired ?? true);
  const consentLabel = String(node.props.consentLabel ?? FORM_DEFAULT_CONSENT_LABEL);
  const fieldThree = String(node.props.fieldThree ?? FORM_DEFAULT_FIELD_THREE_LABEL);
  const userScale = Math.max(45, Math.min(140, Number(node.props.formScale ?? 100))) / 100;
  const scale = Math.max(0.38, Math.min(1.1, Math.min(frame.width / 250, frame.height / 184) * userScale));
  const headerPaddingTop = Math.max(6, Math.round(8 * scale));
  const headerPaddingX = Math.max(8, Math.round(10 * scale));
  const bodyPaddingTop = Math.max(4, Math.round(6 * scale));
  const bodyPaddingBottom = Math.max(6, Math.round(8 * scale));
  const inputPaddingY = Math.max(6, Math.round(8 * scale));
  const inputPaddingX = Math.max(8, Math.round(10 * scale));
  const compactFont = Math.max(10, Math.round(11 * scale));
  const checkboxSize = Math.max(14, Math.round(16 * scale));
  const base = [
    `position:absolute`,`left:${frame.x}px`,`top:${frame.y}px`,`width:${frame.width}px`,`height:${frame.height}px`,`transform:rotate(${frame.rotation}deg)`,
    `opacity:${Number(style.opacity ?? 1)}`,`overflow:hidden`,`box-sizing:border-box`,`border-radius:${Number(style.borderRadius ?? 14)}px`,
    `background:${String(style.backgroundColor ?? exportPalette.white)}`,`color:${String(style.color ?? exportPalette.ink)}`,`display:flex`,`flex-direction:column`,
  ].join(';');

  return `<form class="widget widget-form" data-widget-id="${node.id}" data-form-target-type="${escapeHtml(String(node.props.submitTargetType ?? 'none'))}" data-form-submit-url="${escapeHtml(String(node.props.submitUrl ?? ''))}" data-form-method="${escapeHtml(String(node.props.method ?? FORM_DEFAULT_METHOD).toUpperCase())}" data-form-success-message="${escapeHtml(String(node.props.successMessage ?? FORM_DEFAULT_SUCCESS_MESSAGE))}" data-form-field-one="${escapeHtml(String(node.props.fieldOne ?? FORM_DEFAULT_FIELD_ONE_LABEL))}" data-form-field-two="${escapeHtml(String(node.props.fieldTwo ?? FORM_DEFAULT_FIELD_TWO_LABEL))}" data-form-field-three="${escapeHtml(fieldThree)}" data-form-consent-required="${String(consentRequired)}" style="${base}">
    <div style="padding:${headerPaddingTop}px ${headerPaddingX}px 0;font-size:${Math.max(10, Math.round(12 * scale))}px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;color:${escapeHtml(accent)};">${escapeHtml(String(node.props.title ?? node.name))}</div>
    <div style="padding:${bodyPaddingTop}px ${headerPaddingX}px ${bodyPaddingBottom}px;display:flex;flex:1;flex-direction:column;gap:${Math.max(4, Math.round(6 * scale))}px;overflow-y:auto;">
      <input data-form-input="one" placeholder="${escapeHtml(String(node.props.fieldOne ?? FORM_DEFAULT_FIELD_ONE_LABEL))}" style="border-radius:10px;padding:${inputPaddingY}px ${inputPaddingX}px;background:${exportPalette.slate50};color:${exportPalette.slate};border:1px solid ${exportPalette.darkInputBorder};font-size:${compactFont}px;" />
      <input data-form-input="two" placeholder="${escapeHtml(String(node.props.fieldTwo ?? FORM_DEFAULT_FIELD_TWO_LABEL))}" style="border-radius:10px;padding:${inputPaddingY}px ${inputPaddingX}px;background:${exportPalette.slate50};color:${exportPalette.slate};border:1px solid ${exportPalette.darkInputBorder};font-size:${compactFont}px;" />
      <input data-form-input="three" placeholder="${escapeHtml(fieldThree)}" style="border-radius:10px;padding:${inputPaddingY}px ${inputPaddingX}px;background:${exportPalette.slate50};color:${exportPalette.slate};border:1px solid ${exportPalette.darkInputBorder};font-size:${compactFont}px;" />
      ${consentRequired ? `<label style="display:flex;gap:10px;align-items:center;font-size:${compactFont}px;line-height:1.35;color:${exportPalette.mutedTextStrong};"><input type="checkbox" data-form-consent style="margin:0;width:${checkboxSize}px;height:${checkboxSize}px;accent-color:${escapeHtml(accent)};flex:0 0 auto;" /><span>${escapeHtml(consentLabel)}</span></label>` : ''}
      <div data-form-status style="font-size:11px;opacity:.7;"></div>
      <button type="submit" style="margin-top:auto;padding:${inputPaddingY}px ${inputPaddingX}px;border-radius:12px;background:${escapeHtml(accent)};color:${exportPalette.ink};font-weight:800;border:none;cursor:pointer;font-size:${compactFont}px;">${escapeHtml(String(node.props.ctaLabel ?? FORM_DEFAULT_CTA_LABEL))}</button>
    </div>
  </form>`;
}

export function renderDynamicMapExport(node: WidgetNode): string {
  const frame = node.frame;
  const style = node.style ?? {};
  const accent = String(style.accentColor ?? exportPalette.red);
  const latitude = Number(node.props.latitude ?? DYNAMIC_MAP_DEFAULT_LATITUDE);
  const longitude = Number(node.props.longitude ?? DYNAMIC_MAP_DEFAULT_LONGITUDE);
  const zoom = Number(node.props.zoom ?? DYNAMIC_MAP_DEFAULT_ZOOM);
  const provider = String(node.props.provider ?? 'manual');
  const mode = String(node.props.mode ?? 'street');
  const routeVisible = Boolean(node.props.showRoute ?? false);
  const renderMode = String(node.props.renderMode ?? DYNAMIC_MAP_DEFAULT_RENDER_MODE);
  const mapPaneRatio = Math.max(35, Math.min(85, Number(node.props.mapPaneRatio ?? 72)));
  const requestUserLocation = Boolean(node.props.requestUserLocation ?? false);
  const sortByDistance = Boolean(node.props.sortByDistance ?? true);
  const showOpenNow = Boolean(node.props.showOpenNow ?? true);
  const showDistance = Boolean(node.props.showDistance ?? true);
  const cardsAutoscroll = Boolean(node.props.cardsAutoscroll ?? false);
  const cardsAutoscrollIntervalMs = Math.max(800, Number(node.props.cardsAutoscrollIntervalMs ?? 2200));
  const scrollbarThumbColor = String(node.props.scrollbarThumbColor ?? exportPalette.white);
  const scrollbarTrackColor = String(node.props.scrollbarTrackColor ?? exportPalette.whiteBorder18);
  const defaultCtaType = String(node.props.ctaType ?? DYNAMIC_MAP_DEFAULT_CTA_TYPE);
  const defaultCtaLabel = String(node.props.ctaLabel ?? DYNAMIC_MAP_DEFAULT_CTA_LABEL);
  const heroImage = String(node.props.heroImage ?? '');
  const logoImage = String(node.props.logoImage ?? '');
  const headlineText = String(node.props.headlineText ?? 'Estamos cerca de ti');
  const subheadlineText = String(node.props.subheadlineText ?? 'Visitanos hoy');
  const infoLabelText = String(node.props.infoLabelText ?? 'Encuentranos aqui');
  const brandText = String(node.props.brandText ?? 'Mi marca');
  const primaryAddressText = String(node.props.primaryAddressText ?? '123 Calle Principal');
  const primaryHoursText = String(node.props.primaryHoursText ?? 'Lun-Vie 8am-6pm');
  const directionsCtaLabel = String(node.props.directionsCtaLabel ?? 'Como llegar?');
  const locateMeLabel = String(node.props.locateMeLabel ?? 'Mi ubicacion');
  const nearbyTitleText = String(node.props.nearbyTitleText ?? 'Las 3 ubicaciones mas cercanas');
  const locatingText = String(node.props.locatingText ?? 'Buscando cerca de ti');
  const locationFoundText = String(node.props.locationFoundText ?? 'Ubicacion encontrada');
  const bottomBackgroundColor = String(node.props.bottomBackgroundColor ?? exportPalette.white);
  const searchBackgroundColor = String(node.props.searchBackgroundColor ?? exportPalette.white);
  const heroOverlayOpacity = Math.max(0, Math.min(1, Number(node.props.heroOverlayOpacity ?? 0.45)));
  const parsedPlaces = parseNearbyPlaces(String(node.props.markersCsv ?? ''));
  const places = (parsedPlaces.length ? parsedPlaces : [{
    name: String(node.props.location ?? 'Main location'),
    flag: '', lat: latitude, lng: longitude, address: '', badge: String(node.props.pinLabel ?? 'Store'),
    openNow: null, ctaLabel: defaultCtaLabel, ctaType: defaultCtaType as any, ctaUrl: '',
  }]).slice(0, 5);
  const mapFramePlaces = places.map((place) => ({
    name: place.name, lat: place.lat, lng: place.lng, address: place.address, badge: place.badge,
    mapsUrl: buildPlaceCtaUrl(place, 'maps'), wazeUrl: buildPlaceCtaUrl(place, 'waze'),
  }));
  const exportMapSrcdoc = escapeHtml(buildExportLeafletMapSrcdoc({ places: mapFramePlaces, latitude, longitude, zoom, accent, routeVisible }));
  const placesJson = escapeHtml(JSON.stringify(places.map((place) => ({
    ...place, resolvedUrl: buildPlaceCtaUrl(place, (place.ctaType || defaultCtaType) as never),
    mapsUrl: buildPlaceCtaUrl(place, 'maps'), wazeUrl: buildPlaceCtaUrl(place, 'waze'),
  }))));
  const cardsOnly = renderMode === 'cards-only';
  const mapFirst = renderMode === 'map-first';
  const searchBarMode = renderMode === 'search-bar';
  const isVertical = frame.height > frame.width;
  const stackedLayout = !cardsOnly && isVertical;
  const mapShare = `${mapPaneRatio}fr`;
  const cardsShare = `${Math.max(1, 100 - mapPaneRatio)}fr`;
  const gridTemplateColumns = cardsOnly || stackedLayout ? '1fr' : mapFirst ? `${mapShare} ${cardsShare}` : `${cardsShare} ${mapShare}`;
  const gridTemplateRows = stackedLayout ? (mapFirst ? `${mapShare} ${cardsShare}` : `${cardsShare} ${mapShare}`) : 'none';
  const mapBackground = mode === 'dark' ? exportPalette.slateGradient : mode === 'satellite' ? exportPalette.forestGradient : exportPalette.skyGradient;
  const base = [
    `position:absolute`,`left:${frame.x}px`,`top:${frame.y}px`,`width:${frame.width}px`,`height:${frame.height}px`,`transform:rotate(${frame.rotation}deg)`,
    `opacity:${Number(style.opacity ?? 1)}`,`overflow:hidden`,`box-sizing:border-box`,`border-radius:${Number(style.borderRadius ?? 14)}px`,
    `background:${String(style.backgroundColor ?? exportPalette.darkSurface)}`,`color:${String(style.color ?? exportPalette.white)}`,`display:flex`,`flex-direction:column`,
  ].join(';');

  if (searchBarMode) {
    const heroHeight = isVertical ? '46%' : '60%';
    const bottomHeight = isVertical ? '54%' : '40%';
    const panelWidth = isVertical ? 'calc(100% - 20px)' : 'min(78%,280px)';
    const panelMargin = isVertical ? 'margin:0 auto;' : 'margin-left:auto;';
    return `<div class="widget widget-dynamic-map widget-dynamic-map-search" data-widget-id="${node.id}" data-map-render-mode="search-bar" data-map-places="${placesJson}" data-map-latitude="${latitude}" data-map-longitude="${longitude}" data-map-request-user-location="${String(requestUserLocation)}" data-map-sort-by-distance="${String(sortByDistance)}" data-map-show-open-now="${String(showOpenNow)}" data-map-show-distance="${String(showDistance)}" data-map-autoscroll="${String(cardsAutoscroll)}" data-map-autoscroll-interval="${cardsAutoscrollIntervalMs}" data-map-default-cta-type="${escapeHtml(defaultCtaType)}" data-map-default-cta-label="${escapeHtml(defaultCtaLabel)}" data-map-accent="${escapeHtml(accent)}" data-map-info-label="${escapeHtml(infoLabelText)}" data-map-primary-address="${escapeHtml(primaryAddressText)}" data-map-primary-hours="${escapeHtml(primaryHoursText)}" data-map-directions-label="${escapeHtml(directionsCtaLabel)}" data-map-locate-label="${escapeHtml(locateMeLabel)}" data-map-nearby-title="${escapeHtml(nearbyTitleText)}" data-map-locating-text="${escapeHtml(locatingText)}" data-map-location-found-text="${escapeHtml(locationFoundText)}" style="${base}">
      <div style="position:relative;width:100%;height:100%;overflow:hidden;background:${exportPalette.slate};">
        <div style="position:absolute;inset:0;height:${heroHeight};overflow:hidden;background:${heroImage ? exportPalette.ink : exportPalette.heroGradient};">
          ${heroImage ? `<img src="${escapeHtml(heroImage)}" alt="${escapeHtml(headlineText)}" style="width:100%;height:100%;object-fit:cover;display:block;" />` : ''}
        <div style="position:absolute;inset:0;background:linear-gradient(to bottom, ${exportPalette.blackOverlay18}, rgba(0,0,0,${heroOverlayOpacity}));"></div>
          ${logoImage ? `<img src="${escapeHtml(logoImage)}" alt="${escapeHtml(brandText)}" style="position:absolute;top:12px;left:12px;height:28px;max-width:110px;object-fit:contain;" />` : ''}
          <div style="position:absolute;left:16px;right:16px;bottom:16px;color:${exportPalette.white};">
            <div style="font-size:24px;font-weight:900;line-height:1.05;text-transform:uppercase;">${escapeHtml(headlineText)}</div>
            <div style="font-size:12px;margin-top:6px;opacity:.92;">${escapeHtml(subheadlineText)}</div>
          </div>
        </div>
        <div style="position:absolute;left:0;right:0;bottom:0;height:${bottomHeight};background:${escapeHtml(bottomBackgroundColor)};color:${exportPalette.ink};padding:14px;display:flex;flex-direction:column;gap:10px;">
          <div style="display:flex;align-items:center;gap:8px;"><div style="display:flex;align-items:center;gap:8px;background:${escapeHtml(searchBackgroundColor)};border:1px solid ${exportPalette.softPanelBorder};border-radius:999px;padding:9px 12px;"><span style="font-size:14px;opacity:.6;">⌕</span><span style="font-size:11px;">${escapeHtml(infoLabelText)}</span></div></div>
          <div style="display:flex;align-items:flex-start;gap:10px;">
            <div style="width:34px;height:34px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:${escapeHtml(accent)}22;color:${escapeHtml(accent)};font-size:16px;font-weight:900;flex:0 0 34px;">⌖</div>
            <div style="flex:1;min-width:0;"><div style="font-size:11px;font-weight:900;line-height:1.2;text-transform:uppercase;color:${exportPalette.mutedText};">${escapeHtml(brandText)}</div><div style="font-size:13px;font-weight:900;line-height:1.2;margin-top:4px;">${escapeHtml(primaryAddressText)}</div><div style="font-size:11px;color:${exportPalette.mutedTextSecondary};line-height:1.25;margin-top:4px;">${escapeHtml(primaryHoursText)}</div></div>
            <button type="button" data-smx-action="map-open-panel" style="appearance:none;border:none;border-radius:14px;padding:10px 14px;background:${escapeHtml(accent)};color:${exportPalette.white};font-weight:800;font-size:12px;cursor:pointer;white-space:nowrap;">${escapeHtml(defaultCtaLabel)}</button>
          </div>
        </div>
        <div data-map-search-panel="true" style="position:absolute;inset:0;display:none;background:${exportPalette.darkOverlaySoft};backdrop-filter:blur(2px);padding:10px;">
          <div style="${panelMargin}width:${panelWidth};height:100%;background:${exportPalette.white};border-radius:18px;box-shadow:0 14px 42px ${exportPalette.blackShadow24};overflow:hidden;display:flex;flex-direction:column;">
            <div style="padding:10px 12px;display:flex;align-items:center;justify-content:space-between;gap:10px;border-bottom:1px solid ${exportPalette.softPanelBorder};background:${escapeHtml(searchBackgroundColor)};"><div style="display:flex;align-items:center;gap:8px;min-width:0;"><span style="font-size:14px;opacity:.68;">⌕</span><span style="font-size:11px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(infoLabelText)}</span></div><button type="button" data-smx-action="map-close-panel" style="appearance:none;border:none;background:transparent;color:${exportPalette.mutedTextStrong};font-size:18px;line-height:1;cursor:pointer;">×</button></div>
            <div style="position:relative;height:122px;background:${mapBackground};overflow:hidden;"><iframe title="Nearby locations map" srcdoc="${exportMapSrcdoc}" style="position:absolute;inset:0;width:100%;height:100%;border:0;background:${mapBackground};" loading="lazy"></iframe><button type="button" aria-label="${escapeHtml(locateMeLabel)}" title="${escapeHtml(locateMeLabel)}" data-smx-action="map-request-location" style="position:absolute;right:10px;top:10px;width:40px;height:40px;border-radius:999px;border:none;background:${exportPalette.white};color:${escapeHtml(accent)};box-shadow:0 3px 14px ${exportPalette.blackShadow20};cursor:pointer;padding:0;display:inline-flex;align-items:center;justify-content:center;z-index:2;touch-action:manipulation;">${locateIconMarkup(accent)}</button></div>
            <div style="padding:10px 12px;border-bottom:1px solid ${exportPalette.softPanelBorder};display:flex;align-items:flex-start;gap:10px;">${logoImage ? `<img src="${escapeHtml(logoImage)}" alt="${escapeHtml(brandText)}" style="height:22px;max-width:90px;object-fit:contain;" />` : `<div style="width:12px;height:12px;border-radius:50%;background:${escapeHtml(accent)};margin-top:4px;flex:0 0 12px;"></div>`}<div style="flex:1;min-width:0;"><div data-map-search-status style="font-size:12px;font-weight:900;line-height:1.2;">${escapeHtml(infoLabelText)}</div><div data-map-search-substatus style="font-size:11px;color:${exportPalette.mutedText};line-height:1.25;margin-top:2px;"><b>${escapeHtml(primaryAddressText)}</b><br />${escapeHtml(primaryHoursText)}</div></div><a href="${escapeHtml(places[0] ? buildPlaceCtaUrl(places[0], 'maps') : '')}" target="_blank" rel="noopener noreferrer" data-smx-action="map-primary-directions" style="appearance:none;border:none;border-radius:12px;padding:10px 14px;background:${escapeHtml(accent)};color:${exportPalette.white};font-weight:800;font-size:12px;cursor:pointer;white-space:nowrap;text-decoration:none;display:inline-flex;align-items:center;justify-content:center;">${escapeHtml(directionsCtaLabel)}</a></div>
            <div data-map-search-scroll style="padding:10px 12px;display:flex;flex-direction:column;gap:8px;overflow:auto;flex:1;min-height:0;scrollbar-color:${escapeHtml(scrollbarThumbColor)} ${escapeHtml(scrollbarTrackColor)};scrollbar-width:thin;--map-scrollbar-thumb:${escapeHtml(scrollbarThumbColor)};--map-scrollbar-track:${escapeHtml(scrollbarTrackColor)};"><div style="font-size:11px;font-weight:900;text-transform:uppercase;letter-spacing:.5px;color:${exportPalette.mutedText};">${escapeHtml(nearbyTitleText)}</div><div data-map-search-list></div></div>
          </div>
        </div>
      </div>
    </div>`;
  }

  return `<div class="widget widget-dynamic-map" data-widget-id="${node.id}" data-map-places="${placesJson}" data-map-latitude="${latitude}" data-map-longitude="${longitude}" data-map-request-user-location="${String(requestUserLocation)}" data-map-sort-by-distance="${String(sortByDistance)}" data-map-show-open-now="${String(showOpenNow)}" data-map-show-distance="${String(showDistance)}" data-map-autoscroll="${String(cardsAutoscroll)}" data-map-autoscroll-interval="${cardsAutoscrollIntervalMs}" data-map-default-cta-type="${escapeHtml(defaultCtaType)}" data-map-default-cta-label="${escapeHtml(defaultCtaLabel)}" data-map-accent="${escapeHtml(accent)}" style="${base}">
    <div style="padding:10px 12px 0;font-size:12px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;color:${escapeHtml(accent)};display:flex;align-items:center;justify-content:space-between;gap:8px;"><span>${escapeHtml(String(node.props.title ?? node.name))}</span></div>
    <div style="padding:8px 12px 12px;flex:1;display:grid;grid-template-columns:${gridTemplateColumns};grid-template-rows:${gridTemplateRows};gap:10px;min-height:0;">
      ${cardsOnly ? '' : `<div style="position:relative;min-height:${stackedLayout ? 150 : 110}px;border-radius:12px;overflow:hidden;background:${mapBackground};"><iframe title="Nearby locations map" srcdoc="${exportMapSrcdoc}" style="position:absolute;inset:0;width:100%;height:100%;border:0;background:${mapBackground};"></iframe>${requestUserLocation ? `<button type="button" aria-label="${escapeHtml(locateMeLabel)}" title="${escapeHtml(locateMeLabel)}" data-smx-action="map-request-location-inline" style="position:absolute;right:10px;top:10px;width:40px;height:40px;border-radius:999px;border:none;background:${exportPalette.white};color:${escapeHtml(accent)};box-shadow:0 3px 14px ${exportPalette.blackShadow20};cursor:pointer;padding:0;display:inline-flex;align-items:center;justify-content:center;z-index:2;touch-action:manipulation;">${locateIconMarkup(accent)}</button>` : ''}<div style="position:absolute;left:10px;right:10px;bottom:8px;display:flex;justify-content:space-between;font-size:10px;color:${exportPalette.slate};opacity:.82;pointer-events:none;"><span>${places.length} locations · zoom ${zoom}</span><span>${requestUserLocation ? 'Location ready on tap' : 'Location fixed'}</span></div></div>`}
      <div data-map-cards data-map-scroll-region style="display:grid;gap:4px;overflow:auto;min-height:0;padding-right:2px;align-content:start;scrollbar-color:${escapeHtml(scrollbarThumbColor)} ${escapeHtml(scrollbarTrackColor)};scrollbar-width:thin;--map-scrollbar-thumb:${escapeHtml(scrollbarThumbColor)};--map-scrollbar-track:${escapeHtml(scrollbarTrackColor)};">${places.map((place) => `<div data-map-card data-place-name="${escapeHtml(place.name)}" style="border-radius:10px;background:${exportPalette.whitePanel};border:1px solid ${escapeHtml(accent)}22;padding:7px 8px;display:grid;gap:3px;"><div style="display:flex;align-items:center;justify-content:space-between;gap:8px;"><strong style="font-size:11px;line-height:1.1;">${escapeHtml(place.name)}</strong><span data-place-badge style="font-size:8px;border-radius:999px;padding:2px 5px;background:${escapeHtml(accent)}22;color:${exportPalette.slate};white-space:nowrap;">${escapeHtml(place.badge || (place.openNow ? 'Open now' : 'Store'))}</span></div><div style="font-size:9px;opacity:.78;line-height:1.15;">${escapeHtml(place.address || `${place.lat.toFixed(3)}, ${place.lng.toFixed(3)}`)}</div><div data-place-meta style="display:flex;gap:5px;flex-wrap:wrap;font-size:9px;">${showOpenNow && place.openNow != null ? `<span data-place-open-now>${place.openNow ? 'Open now' : 'Closed'}</span>` : ''}</div><div style="display:flex;gap:6px;flex-wrap:wrap;"><a href="${escapeHtml(buildPlaceCtaUrl(place, 'waze'))}" target="_blank" rel="noopener noreferrer" data-smx-action="map-place-cta" data-place-url="${escapeHtml(buildPlaceCtaUrl(place, 'waze'))}" style="display:inline-flex;flex:1;align-items:center;justify-content:center;height:30px;border-radius:12px;padding:0 10px;color:${exportPalette.white};font-size:9px;font-weight:800;text-decoration:none;border:none;background:${exportPalette.wazeBlue};cursor:pointer;">${DYNAMIC_MAP_ACTION_LABELS.waze}</a><a href="${escapeHtml(buildPlaceCtaUrl(place, 'maps'))}" target="_blank" rel="noopener noreferrer" data-smx-action="map-place-cta" data-place-url="${escapeHtml(buildPlaceCtaUrl(place, 'maps'))}" style="display:inline-flex;flex:1;align-items:center;justify-content:center;height:30px;border-radius:12px;padding:0 10px;color:${exportPalette.white};font-size:9px;font-weight:800;text-decoration:none;border:none;background:${exportPalette.mapsBlue};cursor:pointer;">${DYNAMIC_MAP_ACTION_LABELS.maps}</a></div></div>`).join('')}</div>
    </div>
  </div>`;
}

export function renderCountdownExport(node: WidgetNode): string {
  const frame = node.frame;
  const style = node.style ?? {};
  const accent = String(style.accentColor ?? exportPalette.amber);
  const totalSeconds = Number(node.props.totalSeconds ?? (Number(node.props.days ?? 0) * 86400) + (Number(node.props.hours ?? 0) * 3600) + (Number(node.props.minutes ?? 0) * 60) + Number(node.props.seconds ?? 0));
  const base = [
    `position:absolute`,`left:${frame.x}px`,`top:${frame.y}px`,`width:${frame.width}px`,`height:${frame.height}px`,`transform:rotate(${frame.rotation}deg)`,
    `opacity:${Number(style.opacity ?? 1)}`,`overflow:hidden`,`box-sizing:border-box`,`border-radius:${Number(style.borderRadius ?? 14)}px`,
    `background:${String(style.backgroundColor ?? exportPalette.darkSurface)}`,`color:${String(style.color ?? exportPalette.white)}`,`display:flex`,`flex-direction:column`,
  ].join(';');
  return `<div class="widget widget-countdown" data-widget-id="${node.id}" data-countdown-seconds="${totalSeconds}" style="${base}">
    <div style="padding:10px 12px 0;font-size:12px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;color:${escapeHtml(accent)};">${escapeHtml(String(node.props.title ?? node.name))}</div>
    <div style="padding:8px 12px 12px;display:grid;grid-template-columns:repeat(4,1fr);gap:8px;flex:1;align-content:center;">
      ${['DD', 'HH', 'MM', 'SS'].map((label) => `<div data-countdown-segment="${label}" style="border-radius:12px;padding:12px 8px;background:${exportPalette.whiteBorder08};display:grid;gap:4px;"><div data-countdown-value="${label}" style="font-size:20px;font-weight:800;text-align:center;">00</div><div style="font-size:10px;text-align:center;opacity:.75;">${label}</div></div>`).join('')}
    </div>
  </div>`;
}

export function renderSpeedTestExport(node: WidgetNode): string {
  const frame = node.frame;
  const style = node.style ?? {};
  const accent = String(style.accentColor ?? exportPalette.teal);
  const min = Number(node.props.min ?? 10);
  const max = Number(node.props.max ?? 100);
  const current = Math.max(min, Math.min(max, Number(node.props.current ?? 64)));
  const durationMs = Math.max(300, Number(node.props.durationMs ?? 1800));
  const units = String(node.props.units ?? 'Mbps');
  const skin = String(node.props.skin ?? 'ookla');
  const pingValue = Number(node.props.pingValue ?? 11);
  const uploadValue = Number(node.props.uploadValue ?? 42);
  const ctaLabel = String(node.props.ctaLabel ?? SPEED_TEST_DEFAULT_CTA_LABEL);
  const resultMode = String(node.props.resultMode ?? 'random');
  const fastThreshold = Number(node.props.fastThreshold ?? 70);
  const fastMessage = String(node.props.fastMessage ?? 'WOW, very fast network');
  const slowMessage = String(node.props.slowMessage ?? 'Slow connection');
  const initialTone = current >= fastThreshold ? exportPalette.green : exportPalette.red;
  const pct = Math.max(0, Math.min(100, (current / Math.max(1, max)) * 100));
  const ooklaSkin = skin === 'ookla';
  const fastSkin = skin === 'fast';
  const compact = frame.width < 240 || frame.height < 150;
  const statLabelFont = compact ? 9 : 11;
  const statValueFont = compact ? 13 : 15;
  const gaugeHeight = compact ? 132 : 156;
  const gaugeBorder = compact ? 12 : 16;
  const gaugeNeedleHeight = compact ? 72 : 88;
  const gaugeNumberFont = compact ? 28 : 34;
  const unitsFont = compact ? 11 : 13;
  const topInset = compact ? 14 : 18;
  const sideInset = compact ? 22 : 28;
  const base = [
    `position:absolute`,`left:${frame.x}px`,`top:${frame.y}px`,`width:${frame.width}px`,`height:${frame.height}px`,`transform:rotate(${frame.rotation}deg)`,
    `opacity:${Number(style.opacity ?? 1)}`,`overflow:hidden`,`box-sizing:border-box`,`border-radius:${Number(style.borderRadius ?? 14)}px`,
    `background:${String(style.backgroundColor ?? exportPalette.navy700)}`,`color:${String(style.color ?? exportPalette.white)}`,`display:flex`,`flex-direction:column`,
  ].join(';');
  return `<div class="widget widget-speed-test" data-widget-id="${node.id}" data-speed-min="${min}" data-speed-max="${max}" data-speed-current="${current}" data-speed-duration="${durationMs}" data-speed-result-mode="${escapeHtml(resultMode)}" data-speed-units="${escapeHtml(units)}" data-speed-fast-threshold="${fastThreshold}" data-speed-fast-message="${escapeHtml(fastMessage)}" data-speed-slow-message="${escapeHtml(slowMessage)}" data-speed-skin="${escapeHtml(skin)}" style="${base}">
    <div style="padding:10px 12px 0;font-size:12px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;color:${escapeHtml(accent)};">${escapeHtml(String(node.props.title ?? node.name))}</div>
    ${(ooklaSkin || fastSkin) ? `<div style="padding:${compact ? '6px 10px 10px' : '8px 12px 12px'};display:flex;flex:1;flex-direction:column;gap:${compact ? 10 : 14}px;"><div style="display:grid;gap:6px;"><div style="display:grid;grid-template-columns:repeat(3, minmax(0, 1fr));gap:${compact ? 8 : 10}px;font-size:${statLabelFont}px;letter-spacing:.08em;text-transform:uppercase;"><div style="display:grid;gap:2px;"><span style="opacity:.74;">Ping <span style="opacity:.5">ms</span></span><strong style="font-size:${statValueFont}px;letter-spacing:normal;">${pingValue}</strong></div><div style="display:grid;gap:2px;"><span style="opacity:.74;">Download <span style="opacity:.5">${escapeHtml(units)}</span></span><strong style="font-size:${statValueFont}px;letter-spacing:normal;">${current}</strong></div><div style="display:grid;gap:2px;"><span style="opacity:.74;">Upload <span style="opacity:.5">${escapeHtml(units)}</span></span><strong style="font-size:${statValueFont}px;letter-spacing:normal;">${uploadValue}</strong></div></div></div><div style="position:relative;height:${gaugeHeight}px;border-radius:999px;background:${fastSkin ? `radial-gradient(circle at 50% 100%, ${exportPalette.greenGaugeGlow}, ${exportPalette.transparentToBlack} 68%)` : `radial-gradient(circle at 50% 100%, ${exportPalette.tealGaugeGlow}, ${exportPalette.transparentToBlack} 68%)`};"><div style="position:absolute;inset:0;display:grid;place-items:center;"><div style="width:100%;height:100%;border-radius:999px 999px 36px 36px / 100% 100% 18px 18px;border:${gaugeBorder}px solid ${fastSkin ? exportPalette.greenGaugeBorder : exportPalette.whiteBorder08};border-bottom:none;transform:scaleX(.92);"></div><div style="position:absolute;top:${topInset}px;left:${sideInset}px;right:${sideInset}px;display:flex;justify-content:space-between;font-size:${compact ? 8 : 10}px;font-weight:900;opacity:.82;"><span>0</span><span>5</span><span>10</span><span>20</span><span>30</span><span>50</span><span>75</span><span>100</span></div><div data-speed-needle style="position:absolute;left:50%;bottom:${compact ? 16 : 18}px;width:${compact ? 5 : 6}px;height:${gaugeNeedleHeight}px;border-radius:999px;background:${initialTone};transform-origin:bottom center;transform:translateX(-50%) rotate(${(-92 + pct * 1.84).toFixed(1)}deg);box-shadow:0 0 16px ${initialTone};"></div><div style="position:absolute;bottom:${compact ? 10 : 10}px;width:${compact ? 14 : 16}px;height:${compact ? 14 : 16}px;border-radius:50%;background:${exportPalette.white};"></div><div style="position:absolute;bottom:${compact ? 8 : 8}px;display:grid;place-items:center;gap:2px;"><div data-speed-value style="font-size:${gaugeNumberFont}px;line-height:1;font-weight:300;">${current.toFixed(2)}</div><div style="font-size:${unitsFont}px;opacity:.82;">${escapeHtml(units)}</div></div></div></div><div style="display:flex;align-items:center;justify-content:space-between;gap:10px;"><div data-speed-status style="font-size:${compact ? 11 : 12}px;font-weight:800;color:${initialTone};">${escapeHtml(current >= fastThreshold ? fastMessage : slowMessage)}</div><button type="button" data-smx-action="speed-test-start" data-widget-id="${node.id}" style="padding:9px 14px;border-radius:999px;background:${exportPalette.white};color:${exportPalette.ink};font-weight:900;border:none;cursor:pointer;white-space:nowrap;">${escapeHtml(ctaLabel)}</button></div></div>` : `<div style="padding:8px 12px 12px;display:flex;flex:1;flex-direction:column;gap:10px;"><div data-speed-value style="font-size:26px;font-weight:900;">${current}<span style="font-size:13px;opacity:.8;"> ${escapeHtml(units)}</span></div><div data-speed-status style="font-size:12px;font-weight:800;color:${initialTone};">${escapeHtml(current >= fastThreshold ? fastMessage : slowMessage)}</div><div style="height:12px;border-radius:999px;background:${exportPalette.whiteBorder12};overflow:hidden;"><div data-speed-bar style="width:${pct}%;height:100%;background:${initialTone};"></div></div><button type="button" data-smx-action="speed-test-start" data-widget-id="${node.id}" style="margin-top:auto;padding:10px 12px;border-radius:12px;background:${escapeHtml(accent)};color:${exportPalette.ink};font-weight:800;border:none;cursor:pointer;">${escapeHtml(ctaLabel)}</button></div>`}
  </div>`;
}

export function renderButtonsExport(node: WidgetNode): string {
  const frame = node.frame;
  const style = node.style ?? {};
  const accent = String(style.accentColor ?? exportPalette.cyan);
  const vertical = String(node.props.orientation ?? 'horizontal') === 'vertical';
  const primaryLabel = String(node.props.primaryLabel ?? BUTTONS_EXPORT_DEFAULT_PRIMARY_LABEL);
  const secondaryLabel = String(node.props.secondaryLabel ?? BUTTONS_EXPORT_DEFAULT_SECONDARY_LABEL);
  const base = [
    `position:absolute`,`left:${frame.x}px`,`top:${frame.y}px`,`width:${frame.width}px`,`height:${frame.height}px`,`transform:rotate(${frame.rotation}deg)`,
    `opacity:${Number(style.opacity ?? 1)}`,`overflow:hidden`,`box-sizing:border-box`,`border-radius:${Number(style.borderRadius ?? 14)}px`,
    `background:${String(style.backgroundColor ?? exportPalette.teal700)}`,`color:${String(style.color ?? exportPalette.white)}`,`display:flex`,`flex-direction:column`,
  ].join(';');
  return `<div class="widget widget-buttons" data-widget-id="${node.id}" style="${base}"><div style="padding:10px 12px 0;font-size:12px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;color:${escapeHtml(accent)};">${escapeHtml(String(node.props.title ?? node.name))}</div><div style="padding:8px 12px 12px;display:flex;flex:1;align-items:center;justify-content:center;"><div style="display:flex;gap:8px;flex-direction:${vertical ? 'column' : 'row'};width:100%;"><button type="button" class="widget-buttons-action" data-smx-action="button-select" data-widget-id="${node.id}" data-button-kind="primary" style="flex:1;padding:10px 12px;border-radius:12px;text-align:center;font-weight:800;cursor:pointer;border:none;background:${escapeHtml(accent)};color:${exportPalette.ink};">${escapeHtml(primaryLabel)}</button><button type="button" class="widget-buttons-action" data-smx-action="button-select" data-widget-id="${node.id}" data-button-kind="secondary" style="flex:1;padding:10px 12px;border-radius:12px;text-align:center;font-weight:800;cursor:pointer;border:1px solid ${escapeHtml(accent)};background:transparent;color:inherit;">${escapeHtml(secondaryLabel)}</button></div></div></div>`;
}

export function renderShoppableSidebarExport(node: WidgetNode, _state: unknown, assetPathMap: Record<string, string> = {}): string {
  const frame = node.frame;
  const style = node.style ?? {};
  const accent = String(style.accentColor ?? exportPalette.bronze);
  const ctaBackgroundColor = String((style as Record<string, unknown>).ctaBackgroundColor ?? accent);
  const ctaTextColor = String((style as Record<string, unknown>).ctaTextColor ?? exportPalette.ink);
  const orientation = String(node.props.orientation ?? 'horizontal');
  const cardShape = String(node.props.cardShape ?? 'portrait');
  const autoscroll = Boolean(node.props.autoscroll ?? true);
  const intervalMs = Math.max(1000, Math.min(10000, Number(node.props.intervalMs ?? 2600)));
  const showPrevButton = Boolean(node.props.showPrevButton ?? true);
  const showNextButton = Boolean(node.props.showNextButton ?? true);
  const products = parseShoppableProducts(String(node.props.products ?? '')).map((product: { src: string; [key: string]: unknown }) => ({ ...product, src: assetPathMap[product.src] ?? product.src }));
  const baseCardSize = cardShape === 'landscape' ? { width: 168, height: 110 } : cardShape === 'square' ? { width: 132, height: 132 } : { width: 124, height: 164 };
  const activeProducts = products.length ? products : [SHOPPABLE_PRODUCT_DEFAULT_ITEM];
  const visibleCount = orientation === 'vertical' ? 1 : Math.min(2, activeProducts.length || 1);
  const availableWidth = Math.max(120, frame.width - 24);
  const availableHeight = Math.max(88, frame.height - 58);
  const gap = 12;
  const effectiveCardSize = orientation === 'horizontal'
    ? { width: Math.max(96, Math.floor((availableWidth - 24 * Math.max(0, visibleCount - 1)) / visibleCount)), height: Math.max(92, Math.min(Math.floor(availableHeight * 0.94), baseCardSize.height)) }
    : { width: Math.max(110, Math.min(availableWidth, baseCardSize.width)), height: Math.max(96, Math.min(Math.floor(availableHeight * 0.94), baseCardSize.height)) };
  const mediaHeight = Math.max(60, Math.min(cardShape === 'landscape' ? Math.floor(effectiveCardSize.height * 0.58) : Math.floor(effectiveCardSize.height * 0.68), effectiveCardSize.height - 44));
  const productsJson = escapeHtml(JSON.stringify(activeProducts));
  const cardBasis = orientation === 'horizontal' ? `calc((100% - ${gap * Math.max(0, visibleCount - 1)}px) / ${visibleCount})` : '100%';
  const base = [
    `position:absolute`,`left:${frame.x}px`,`top:${frame.y}px`,`width:${frame.width}px`,`height:${frame.height}px`,`transform:rotate(${frame.rotation}deg)`,
    `opacity:${Number(style.opacity ?? 1)}`,`overflow:hidden`,`box-sizing:border-box`,`border-radius:${Number(style.borderRadius ?? 20)}px`,
    `background:${String(style.backgroundColor ?? exportPalette.slate50)}`,`color:${String(style.color ?? exportPalette.darkSurface)}`,`display:flex`,`flex-direction:column`,
  ].join(';');
  const cards = activeProducts.map((product: any, index: number) => `<article data-shoppable-card="${index}" style="width:${orientation === 'horizontal' ? cardBasis : '100%'};min-width:${orientation === 'horizontal' ? cardBasis : '100%'};max-width:${orientation === 'horizontal' ? cardBasis : '100%'};flex:${orientation === 'horizontal' ? `0 0 ${cardBasis}` : '0 0 auto'};height:100%;min-height:0;border-radius:10px;overflow:hidden;background:${exportPalette.white};color:${exportPalette.darkSurface};border:1px solid ${exportPalette.darkInputBorderSoft};box-shadow:0 4px 14px ${exportPalette.darkShadowSoft};display:flex;flex-direction:column;"><div style="position:relative;height:${mediaHeight}px;min-height:${mediaHeight}px;background:${product.src ? exportPalette.ink : exportPalette.slate50};flex-shrink:0;">${product.src ? `<img src="${escapeHtml(product.src)}" alt="${escapeHtml(product.title)}" style="width:100%;height:100%;object-fit:cover;display:block;" />` : ''}</div><div style="padding:8px 8px 10px;display:grid;gap:3px;flex:1;min-height:0;align-content:start;"><div style="font-size:11px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:${exportPalette.slate};line-height:1.15;display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;overflow:hidden;">${escapeHtml(product.title)}</div><div style="font-size:12px;color:${exportPalette.softText};line-height:1.15;">${escapeHtml(product.price || SHOPPABLE_PRODUCT_DEFAULT_PRICE)}</div><button type="button" data-smx-action="shoppable-cta" data-widget-id="${node.id}" data-product-url="${escapeHtml(product.url)}" style="margin-top:auto;border:none;border-radius:10px;background:${escapeHtml(ctaBackgroundColor)};color:${escapeHtml(ctaTextColor)};font-weight:800;padding:7px 9px;font-size:11px;cursor:pointer;opacity:${product.ctaLabel ? '1' : '0'};">${escapeHtml(product.ctaLabel || SHOPPABLE_PRODUCT_DEFAULT_CTA_LABEL)}</button></div></article>`).join('');
  return `<div class="widget widget-shoppable-sidebar" data-widget-id="${node.id}" data-shoppable-products="${productsJson}" data-shoppable-index="0" data-shoppable-layout="${escapeHtml(orientation)}" data-shoppable-card-shape="${escapeHtml(cardShape)}" data-shoppable-autoscroll="${String(autoscroll)}" data-shoppable-interval="${intervalMs}" data-shoppable-card-width="${effectiveCardSize.width}" data-shoppable-card-height="${effectiveCardSize.height}" style="${base}"><div style="padding:10px 12px 0;font-size:12px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;color:${escapeHtml(accent)};">${escapeHtml(String(node.props.title ?? node.name))}</div><div style="padding:8px 12px 12px;display:flex;flex:1;flex-direction:column;gap:10px;min-height:0;"><div style="position:relative;flex:1;overflow:hidden;"><div data-shoppable-track style="display:flex;${orientation === 'vertical' ? 'flex-direction:column;' : ''}gap:${gap}px;${orientation === 'horizontal' ? 'width:100%;height:100%;' : 'height:100%;'}transition:transform .28s ease;">${cards}</div>${activeProducts.length > 1 ? `${showPrevButton ? `<button type="button" data-smx-action="shoppable-prev" data-widget-id="${node.id}" style="position:absolute;left:4px;top:50%;transform:translateY(-50%);width:24px;height:24px;border-radius:999px;border:none;background:${exportPalette.whiteText94};color:${exportPalette.ink};font-weight:900;cursor:pointer;box-shadow:0 2px 10px ${exportPalette.darkShadowMedium};display:grid;place-items:center;">${renderChevronExportIcon('left')}</button>` : ''}${showNextButton ? `<button type="button" data-smx-action="shoppable-next" data-widget-id="${node.id}" style="position:absolute;right:4px;top:50%;transform:translateY(-50%);width:24px;height:24px;border-radius:999px;border:none;background:${exportPalette.whiteText94};color:${exportPalette.ink};font-weight:900;cursor:pointer;box-shadow:0 2px 10px ${exportPalette.darkShadowMedium};display:grid;place-items:center;">${renderChevronExportIcon('right')}</button>` : ''}` : ''}</div></div></div>`;
}

export function renderWeatherConditionsExport(node: WidgetNode): string {
  const frame = node.frame;
  const style = node.style ?? {};
  const accent = String(style.accentColor ?? exportPalette.sky);
  const condition = String(node.props.condition ?? 'Cloudy');
  const temperature = Number(node.props.temperature ?? 24);
  const location = String(node.props.location ?? 'San Salvador');
  const latitude = Number(node.props.latitude ?? 13.6929);
  const longitude = Number(node.props.longitude ?? -89.2182);
  const provider = String(node.props.provider ?? 'open-meteo');
  const fetchPolicy = String(node.props.fetchPolicy ?? 'cache-first');
  const cacheTtlMs = Math.max(1000, Number(node.props.cacheTtlMs ?? 300000));
  const liveWeather = Boolean(node.props.liveWeather ?? true);
  const icon = resolveWeatherIcon(condition, true);
  const base = [
    `position:absolute`,`left:${frame.x}px`,`top:${frame.y}px`,`width:${frame.width}px`,`height:${frame.height}px`,`transform:rotate(${frame.rotation}deg)`,
    `opacity:${Number(style.opacity ?? 1)}`,`overflow:hidden`,`box-sizing:border-box`,`border-radius:${Number(style.borderRadius ?? 14)}px`,
    `background:${String(style.backgroundColor ?? exportPalette.slate50)}`,`color:${String(style.color ?? exportPalette.slate)}`,`display:flex`,`flex-direction:column`,
  ].join(';');
  return `<div class="widget widget-weather-conditions" data-widget-id="${node.id}" data-weather-location="${escapeHtml(location)}" data-weather-temperature="${temperature}" data-weather-condition="${escapeHtml(condition)}" data-weather-latitude="${latitude}" data-weather-longitude="${longitude}" data-weather-provider="${escapeHtml(provider)}" data-weather-fetch-policy="${escapeHtml(fetchPolicy)}" data-weather-cache-ttl="${cacheTtlMs}" data-weather-live="${String(liveWeather)}" style="${base}"><div style="padding:10px 12px 0;font-size:12px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;color:${escapeHtml(accent)};">${escapeHtml(String(node.props.title ?? node.name))}</div><div style="padding:8px 12px 12px;display:flex;flex:1;flex-direction:column;gap:10px;"><div style="display:flex;align-items:center;justify-content:space-between;gap:12px;"><div><div data-weather-temperature-display style="font-size:28px;font-weight:900;">${temperature}°</div><div data-weather-location-display style="font-size:12px;opacity:.78;">${escapeHtml(location)}</div></div><div data-weather-icon style="font-size:34px;">${icon}</div></div><div style="padding:8px 10px;border-radius:10px;background:${escapeHtml(accent)}22;font-size:12px;display:flex;justify-content:space-between;gap:8px;"><span data-weather-condition-display>${escapeHtml(condition)}</span><span data-weather-status style="opacity:.74;">${liveWeather && provider === 'open-meteo' ? 'Fetching live weather' : 'Static preview'}</span></div></div></div>`;
}
