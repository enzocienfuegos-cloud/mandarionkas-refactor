import type { WidgetNode } from '../../domain/document/types';
import { exportTokens as exportPalette } from '../../export/export-tokens';
import { escapeHtml } from '../registry/export-helpers';
import { buildQrPattern, getFlagEmoji, isFilenameLikeCaption } from './shared-styles';
import { parseShoppableProducts } from './shoppable-sidebar.shared';
import { resolveCornerRadius } from '../shared/corner-style';
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
import { TRAVEL_DEAL_DEFAULT_PROPS } from './travel-deal.shared';
import { resolveWeatherIcon } from './weather-conditions.shared';

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

function renderChevronExportIcon(direction: 'left' | 'right'): string {
  return direction === 'left'
    ? '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" style="display:inline-flex;"><path d="M10 3.5L5.5 8 10 12.5"/></svg>'
    : '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" style="display:inline-flex;"><path d="M6 3.5L10.5 8 6 12.5"/></svg>';
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
    `border-radius:${borderRadius}px`,`background:${String(style.backgroundColor || 'transparent')}`,`color:${String(style.color ?? exportPalette.white)}`,
    `display:flex`,`flex-direction:column`,
  ].join(';');
  const resolvedBg = String(style.backgroundColor || exportPalette.ink);
  const slidesJson = escapeHtml(JSON.stringify(slides));
  const showPrevButton = Boolean(node.props.showPrevButton ?? true);
  const showNextButton = Boolean(node.props.showNextButton ?? true);
  const showPaginationDots = Boolean(node.props.showPaginationDots ?? true);
  const paginationDotSize = Math.max(2, Math.min(5, Number(node.props.paginationDotSize ?? 3)));
  const carouselTitle = String(node.props.title ?? '').trim();
  return `<div class="widget widget-image-carousel" data-widget-id="${node.id}" data-carousel-slides="${slidesJson}" data-carousel-index="0" data-carousel-accent="${escapeHtml(accent)}" style="${base}">
    ${carouselTitle ? `<div style="padding:10px 12px 0;font-size:12px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;color:${escapeHtml(accent)};">${escapeHtml(carouselTitle)}</div>` : ''}
    <div style="position:relative;flex:1;${carouselTitle ? 'margin:8px 12px 12px' : 'margin:0'};border-radius:${carouselTitle ? 12 : borderRadius}px;overflow:hidden;background:${activeSlide ? 'transparent' : escapeHtml(resolvedBg)};">
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
