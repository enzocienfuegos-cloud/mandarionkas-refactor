import { getActiveFeedRecord } from '../domain/document/resolvers';
import type { StudioState, WidgetNode } from '../domain/document/types';
import { getWidgetDefinition } from '../widgets/registry/widget-registry';
import type { GamHtml5AdapterResult, GenericHtml5AdapterResult, GoogleDisplayAdapterResult, PlayableExportAdapterResult } from './adapters';
import { buildExportAssetPathMap, buildExportAssetPlan } from './assets';
import { buildExportManifest } from './manifest';
import { buildExportRuntimeModelFromPortable } from './runtime-model';
import { buildExportExitConfig } from './packaging';
import { buildPortableProjectExport, type PortableExportScene, type PortableExportWidget } from './portable';
import { resolveCornerRadius } from '../widgets/shared/corner-style';
import { buildQrPattern, getFlagEmoji, parseCsvMarkers } from '../widgets/modules/shared-styles';
import { parseShoppableProducts, renderRatingStars } from '../widgets/modules/shoppable-sidebar.shared';
import { resolveWeatherIcon } from '../widgets/modules/weather-conditions.shared';
import { buildPlaceCtaUrl, parseNearbyPlaces } from '../widgets/modules/dynamic-map.shared';

export function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildExportLeafletMapSrcdoc(input: {
  places: Array<{ name: string; lat: number; lng: number }>;
  latitude: number;
  longitude: number;
  zoom: number;
  accent: string;
  routeVisible: boolean;
}): string {
  const places = input.places.filter((place) => Number.isFinite(place.lat) && Number.isFinite(place.lng)).slice(0, 25);
  const placesJson = JSON.stringify(places);
  const routeScript = input.routeVisible
    ? `
      if (places.length > 1) {
        const latlngs = places.map((place) => [place.lat, place.lng]);
        L.polyline(latlngs, { color: '${input.accent}', weight: 3, dashArray: '7 6', opacity: 0.9 }).addTo(map);
      }
    `
    : '';
  return `
<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <style>
    html, body, #map { margin: 0; width: 100%; height: 100%; overflow: hidden; background: #dbeafe; }
    .leaflet-container { font-family: Inter, Arial, sans-serif; background: #dbeafe; }
    .smx-export-map-label.leaflet-tooltip {
      background: #111827;
      border: none;
      border-radius: 999px;
      color: #fff;
      padding: 4px 8px;
      font-size: 10px;
      font-weight: 700;
      box-shadow: none;
    }
    .smx-export-map-label.leaflet-tooltip:before { display: none; }
  </style>
</head>
<body>
  <div id="map"></div>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script>
    const places = ${placesJson};
    const map = L.map('map', { zoomControl: true, attributionControl: false, scrollWheelZoom: true }).setView([${input.latitude}, ${input.longitude}], ${input.zoom});
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', { maxZoom: 19 }).addTo(map);
    places.forEach((place) => {
      const marker = L.circleMarker([place.lat, place.lng], {
        radius: 7,
        color: '${input.accent}',
        weight: 3,
        fillColor: '#111827',
        fillOpacity: 1
      }).addTo(map);
      marker.bindTooltip(place.name, {
        permanent: true,
        direction: 'top',
        offset: [0, -10],
        className: 'smx-export-map-label'
      });
    });
    ${routeScript}
    if (places.length) {
      const bounds = L.latLngBounds(places.map((place) => [place.lat, place.lng]));
      if (bounds.isValid()) map.fitBounds(bounds.pad(0.25));
    }
  </script>
</body>
</html>`.trim();
}

function resolveAssetPath(src: unknown, assetPathMap: Record<string, string>): string {
  if (typeof src !== 'string') return '';
  return assetPathMap[src] ?? src;
}

function parseCarouselSlides(raw: unknown, assetPathMap: Record<string, string>): Array<{ src: string; caption: string }> {
  if (typeof raw !== 'string' || raw.trim().length === 0) return [];
  return raw
    .split(';')
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item, index) => {
      const [src, caption] = item.split('|');
      return {
        src: resolveAssetPath((src ?? '').trim(), assetPathMap),
        caption: (caption ?? `Slide ${index + 1}`).trim(),
      };
    })
    .filter((item) => item.src);
}

function renderImageWidget(node: WidgetNode, assetPathMap: Record<string, string>, kind: 'image' | 'hero-image'): string {
  const frame = node.frame;
  const style = node.style ?? {};
  const borderRadius = resolveCornerRadius(node, kind === 'hero-image' ? 20 : 12);
  const src = resolveAssetPath(node.props.src, assetPathMap);
  const alt = escapeHtml(String(node.props.alt ?? (kind === 'hero-image' ? 'Hero image' : 'Image')));
  const fit = kind === 'hero-image' ? 'cover' : String(node.props.fit ?? 'cover');
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
    `border-radius:${borderRadius}px`,
    `background:${String(style.backgroundColor ?? 'transparent')}`,
  ].join(';');

  return `<div class="widget widget-${kind}" data-widget-id="${node.id}" style="${base}"><img src="${escapeHtml(src)}" alt="${alt}" style="width:100%;height:100%;display:block;object-fit:${escapeHtml(fit)};" /></div>`;
}

function renderVideoWidget(node: WidgetNode, assetPathMap: Record<string, string>): string {
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
    `background:${String(style.backgroundColor ?? '#000000')}`,
  ].join(';');

  return `<div class="widget widget-video-hero" data-widget-id="${node.id}" style="${base}"><video src="${escapeHtml(src)}" ${posterSrc ? `poster="${escapeHtml(posterSrc)}"` : ''} ${Boolean(node.props.autoplay ?? true) ? 'autoplay' : ''} ${Boolean(node.props.muted ?? true) ? 'muted' : ''} ${Boolean(node.props.loop ?? true) ? 'loop' : ''} ${Boolean(node.props.controls ?? false) ? 'controls' : ''} playsinline style="width:100%;height:100%;display:block;object-fit:cover;"></video></div>`;
}

function renderCarouselWidget(node: WidgetNode, assetPathMap: Record<string, string>): string {
  const frame = node.frame;
  const style = node.style ?? {};
  const borderRadius = resolveCornerRadius(node, 20);
  const slides = parseCarouselSlides(node.props.slides, assetPathMap);
  const accent = String(style.accentColor ?? '#ffffff');
  const activeSlide = slides[0];
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
    `border-radius:${borderRadius}px`,
    `background:${String(style.backgroundColor ?? '#111827')}`,
    `color:${String(style.color ?? '#ffffff')}`,
    `display:flex`,
    `flex-direction:column`,
  ].join(';');
  const slidesJson = escapeHtml(JSON.stringify(slides));

  return `<div class="widget widget-image-carousel" data-widget-id="${node.id}" data-carousel-slides="${slidesJson}" data-carousel-index="0" style="${base}">
    <div style="padding:10px 12px 0;font-size:12px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;color:${escapeHtml(accent)};">${escapeHtml(String(node.props.title ?? node.name))}</div>
    <div style="position:relative;flex:1;margin:8px 12px 12px;border-radius:12px;overflow:hidden;background:#111827;">
      ${activeSlide ? `<img data-carousel-image src="${escapeHtml(activeSlide.src)}" alt="${escapeHtml(activeSlide.caption)}" style="width:100%;height:100%;display:block;object-fit:cover;" />` : '<div style="width:100%;height:100%;display:grid;place-items:center;opacity:.7;">Add slides</div>'}
      <div style="position:absolute;inset-inline:12px;bottom:10px;display:flex;justify-content:space-between;align-items:end;gap:8px;">
        <div data-carousel-caption style="border-radius:10px;padding:8px 10px;background:rgba(15,23,42,.68);font-size:12px;">${escapeHtml(activeSlide?.caption ?? 'No slide')}</div>
        <div style="display:flex;gap:6px;">${slides.map((_, index) => `<button type="button" data-smx-action="carousel-dot" data-widget-id="${node.id}" data-carousel-target="${index}" style="width:10px;height:10px;border-radius:50%;border:none;background:${index === 0 ? escapeHtml(accent) : 'rgba(255,255,255,.45)'};cursor:pointer;"></button>`).join('')}</div>
      </div>
    </div>
    <div style="display:flex;gap:8px;padding:0 12px 12px;">
      <button type="button" data-smx-action="carousel-prev" data-widget-id="${node.id}" style="flex:1;border-radius:10px;border:1px solid ${escapeHtml(accent)};background:transparent;color:inherit;padding:8px 10px;">Prev</button>
      <button type="button" data-smx-action="carousel-next" data-widget-id="${node.id}" style="flex:1;border-radius:10px;border:none;background:${escapeHtml(accent)};color:#111827;font-weight:800;padding:8px 10px;">Next</button>
    </div>
  </div>`;
}

function renderHotspotWidget(node: WidgetNode): string {
  const frame = node.frame;
  const style = node.style ?? {};
  const accent = String(style.accentColor ?? '#f59e0b');
  const hotspotX = Number(node.props.hotspotX ?? 55);
  const hotspotY = Number(node.props.hotspotY ?? 45);
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
    `border-radius:${Number(style.borderRadius ?? 14)}px`,
    `background:${String(style.backgroundColor ?? '#172554')}`,
    `color:${String(style.color ?? '#ffffff')}`,
  ].join(';');

  return `<div class="widget widget-interactive-hotspot" data-widget-id="${node.id}" style="${base}">
    <button type="button" data-smx-action="hotspot-toggle" data-widget-id="${node.id}" style="position:absolute;left:${hotspotX}%;top:${hotspotY}%;transform:translate(-50%,-50%);width:22px;height:22px;border-radius:50%;border:none;background:${escapeHtml(accent)};box-shadow:0 0 0 6px ${escapeHtml(accent)}33,0 0 0 18px ${escapeHtml(accent)}11;cursor:pointer;"></button>
    <div data-hotspot-panel style="position:absolute;left:12px;right:12px;bottom:12px;border-radius:10px;background:rgba(17,24,39,.92);padding:8px 10px;font-size:12px;display:none;">${escapeHtml(String(node.props.label ?? 'Tap point'))}</div>
    <div data-hotspot-label style="position:absolute;left:12px;bottom:12px;font-size:12px;">${escapeHtml(String(node.props.label ?? 'Tap point'))}</div>
  </div>`;
}

function renderRangeLikeWidget(node: WidgetNode, label: string): string {
  const frame = node.frame;
  const style = node.style ?? {};
  const accent = String(style.accentColor ?? '#ffffff');
  const min = Number(node.props.min ?? 0);
  const max = Number(node.props.max ?? 100);
  const value = Number(node.props.value ?? node.props.current ?? 50);
  const units = String(node.props.units ?? '');
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
    `border-radius:${Number(style.borderRadius ?? 14)}px`,
    `background:${String(style.backgroundColor ?? '#111827')}`,
    `color:${String(style.color ?? '#ffffff')}`,
    `display:flex`,
    `flex-direction:column`,
  ].join(';');

  return `<div class="widget widget-${escapeHtml(node.type)}" data-widget-id="${node.id}" style="${base}">
    <div style="padding:10px 12px 0;font-size:12px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;color:${escapeHtml(accent)};">${escapeHtml(String(node.props.title ?? node.name))}</div>
    <div style="padding:8px 12px 12px;display:flex;flex:1;flex-direction:column;justify-content:center;gap:10px;">
      <input type="range" min="${min}" max="${max}" value="${value}" data-smx-action="range-update" data-widget-id="${node.id}" data-units="${escapeHtml(units)}" style="accent-color:${escapeHtml(accent)};" />
      <div data-range-value style="font-size:13px;font-weight:700;">${escapeHtml(label)}: ${value}${escapeHtml(units)}</div>
    </div>
  </div>`;
}

function renderScratchRevealWidget(node: WidgetNode): string {
  const frame = node.frame;
  const style = node.style ?? {};
  const accent = String(style.accentColor ?? '#f97316');
  const coverLabel = String(node.props.coverLabel ?? 'Scratch to reveal');
  const revealLabel = String(node.props.revealLabel ?? '20% off today');
  const beforeImage = String(node.props.beforeImage ?? '');
  const afterImage = String(node.props.afterImage ?? '');
  const coverBlur = Math.max(0, Number(node.props.coverBlur ?? 6));
  const scratchRadius = Math.max(8, Number(node.props.scratchRadius ?? 22));
  const revealBackground = afterImage
    ? '#111827'
    : `linear-gradient(135deg, ${accent}22, rgba(255,255,255,.12))`;
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
    `border-radius:${Number(style.borderRadius ?? 14)}px`,
    `background:${String(style.backgroundColor ?? '#111827')}`,
    `color:${String(style.color ?? '#ffffff')}`,
    `display:flex`,
    `flex-direction:column`,
  ].join(';');

  return `<div class="widget widget-scratch-reveal" data-widget-id="${node.id}" style="${base}">
    <div style="padding:10px 12px 0;font-size:12px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;color:${escapeHtml(accent)};">${escapeHtml(String(node.props.title ?? node.name))}</div>
    <div style="padding:8px 12px 12px;display:flex;flex:1;flex-direction:column;justify-content:center;gap:10px;">
      <div class="scratch-reveal-shell" data-scratch-widget-id="${node.id}" data-scratch-cover-image="${escapeHtml(beforeImage)}" data-scratch-cover-blur="${coverBlur}" data-scratch-radius="${scratchRadius}" data-scratch-accent="${escapeHtml(accent)}" style="position:relative;flex:1;border-radius:12px;overflow:hidden;background:${escapeHtml(revealBackground)};">
        ${afterImage ? `<img src="${escapeHtml(afterImage)}" alt="${escapeHtml(revealLabel)}" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;" />` : ''}
        <div style="position:absolute;inset:0;display:grid;place-items:center;font-weight:800;font-size:22px;text-align:center;padding:16px;">${escapeHtml(revealLabel)}</div>
        <canvas data-scratch-canvas style="position:absolute;inset:0;width:100%;height:100%;cursor:crosshair;touch-action:none;"></canvas>
        <div style="position:absolute;left:12px;right:12px;bottom:12px;display:flex;flex-direction:column;gap:6px;pointer-events:none;">
          <div style="font-size:12px;">${escapeHtml(coverLabel)}</div>
        </div>
      </div>
    </div>
  </div>`;
}

function renderQrCodeWidget(node: WidgetNode): string {
  const frame = node.frame;
  const style = node.style ?? {};
  const accent = String(style.accentColor ?? '#111827');
  const url = String(node.props.url ?? 'https://example.com');
  const qrScale = Math.max(0.3, Math.min(1, Number(node.props.qrScale ?? 0.72)));
  const qrPadding = Math.max(0, Number(node.props.qrPadding ?? 8));
  const qrSize = Math.max(72, Math.min(frame.width, frame.height - 24) * qrScale);
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(url)}`;
  const pattern = buildQrPattern(url);
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
    `border-radius:${Number(style.borderRadius ?? 14)}px`,
    `background:${String(style.backgroundColor ?? '#ffffff')}`,
    `color:${String(style.color ?? '#111827')}`,
    `display:flex`,
    `flex-direction:column`,
    `cursor:pointer`,
  ].join(';');

  return `<button type="button" class="widget widget-qr-code" data-widget-id="${node.id}" data-smx-action="qr-open" data-qr-url="${escapeHtml(url)}" style="${base}">
    <div style="padding:10px 12px 0;font-size:12px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;color:${escapeHtml(accent)};">${escapeHtml(String(node.props.title ?? node.name))}</div>
    <div style="padding:8px 12px 12px;display:flex;flex:1;flex-direction:column;align-items:center;justify-content:center;gap:10px;">
      <div style="width:${qrSize}px;height:${qrSize}px;border-radius:14px;background:#fff;padding:${qrPadding}px;display:grid;place-items:center;flex-shrink:0;">
        <img src="${escapeHtml(qrUrl)}" alt="${escapeHtml(String(node.props.codeLabel ?? 'QR code'))}" style="width:100%;height:100%;object-fit:contain;border-radius:8px;" onerror="this.replaceWith(this.nextElementSibling)" />
        <div style="display:none;grid-template-columns:repeat(9,1fr);gap:2px;width:100%;height:100%;">
          ${pattern.map((filled) => `<div style="background:${filled ? escapeHtml(accent) : '#fff'};"></div>`).join('')}
        </div>
      </div>
      <div style="text-align:center;font-size:12px;color:${escapeHtml(String(style.color ?? '#111827'))};">${escapeHtml(String(node.props.codeLabel ?? 'Scan me'))}</div>
    </div>
  </button>`;
}

function renderDynamicMapWidget(node: WidgetNode): string {
  const frame = node.frame;
  const style = node.style ?? {};
  const accent = String(style.accentColor ?? '#ef4444');
  const latitude = Number(node.props.latitude ?? 13.6929);
  const longitude = Number(node.props.longitude ?? -89.2182);
  const zoom = Number(node.props.zoom ?? 13);
  const provider = String(node.props.provider ?? 'manual');
  const mode = String(node.props.mode ?? 'street');
  const routeVisible = Boolean(node.props.showRoute ?? false);
  const renderMode = String(node.props.renderMode ?? 'cards-map');
  const mapPaneRatio = Math.max(35, Math.min(85, Number(node.props.mapPaneRatio ?? 72)));
  const requestUserLocation = Boolean(node.props.requestUserLocation ?? false);
  const sortByDistance = Boolean(node.props.sortByDistance ?? true);
  const showOpenNow = Boolean(node.props.showOpenNow ?? true);
  const showDistance = Boolean(node.props.showDistance ?? true);
  const defaultCtaType = String(node.props.ctaType ?? 'maps');
  const defaultCtaLabel = String(node.props.ctaLabel ?? 'Open in Maps');
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
  const bottomBackgroundColor = String(node.props.bottomBackgroundColor ?? '#ffffff');
  const searchBackgroundColor = String(node.props.searchBackgroundColor ?? '#ffffff');
  const heroOverlayOpacity = Math.max(0, Math.min(1, Number(node.props.heroOverlayOpacity ?? 0.45)));
  const places = (parseNearbyPlaces(String(node.props.markersCsv ?? '')).length
    ? parseNearbyPlaces(String(node.props.markersCsv ?? ''))
    : [{
        name: String(node.props.location ?? 'Main location'),
        flag: '',
        lat: latitude,
        lng: longitude,
        address: '',
        badge: String(node.props.pinLabel ?? 'Store'),
        openNow: null,
        ctaLabel: defaultCtaLabel,
        ctaType: defaultCtaType as any,
        ctaUrl: '',
      }]).slice(0, 5);
  const mapFramePlaces = places.map((place) => ({ name: place.name, lat: place.lat, lng: place.lng }));
  const exportMapSrcdoc = escapeHtml(buildExportLeafletMapSrcdoc({
    places: mapFramePlaces,
    latitude,
    longitude,
    zoom,
    accent,
    routeVisible,
  }));
  const placesJson = escapeHtml(JSON.stringify(places.map((place) => ({
    ...place,
    resolvedUrl: buildPlaceCtaUrl(place, (place.ctaType || defaultCtaType) as any),
    mapsUrl: buildPlaceCtaUrl(place, 'maps'),
    wazeUrl: buildPlaceCtaUrl(place, 'waze'),
  }))));
  const cardsOnly = renderMode === 'cards-only';
  const mapFirst = renderMode === 'map-first';
  const searchBarMode = renderMode === 'search-bar';
  const isVertical = frame.height > frame.width;
  const stackedLayout = !cardsOnly && isVertical;
  const mapShare = `${mapPaneRatio}fr`;
  const cardsShare = `${Math.max(1, 100 - mapPaneRatio)}fr`;
  const gridTemplateColumns = cardsOnly || stackedLayout
    ? '1fr'
    : mapFirst
      ? `${mapShare} ${cardsShare}`
      : `${cardsShare} ${mapShare}`;
  const gridTemplateRows = stackedLayout
    ? (mapFirst ? `${mapShare} ${cardsShare}` : `${cardsShare} ${mapShare}`)
    : 'none';
  const mapBackground = mode === 'dark'
    ? 'linear-gradient(135deg,#0f172a,#1e293b)'
    : mode === 'satellite'
      ? 'linear-gradient(135deg,#14532d,#365314)'
      : 'linear-gradient(135deg,#dbeafe,#bfdbfe)';
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
    `border-radius:${Number(style.borderRadius ?? 14)}px`,
    `background:${String(style.backgroundColor ?? '#1f2937')}`,
    `color:${String(style.color ?? '#ffffff')}`,
    `display:flex`,
    `flex-direction:column`,
  ].join(';');

  if (searchBarMode) {
    const heroHeight = isVertical ? '46%' : '60%';
    const bottomHeight = isVertical ? '54%' : '40%';
    const panelWidth = isVertical ? 'calc(100% - 20px)' : 'min(78%,280px)';
    const panelMargin = isVertical ? 'margin:0 auto;' : 'margin-left:auto;';
    return `<div class="widget widget-dynamic-map widget-dynamic-map-search" data-widget-id="${node.id}" data-map-render-mode="search-bar" data-map-places="${placesJson}" data-map-latitude="${latitude}" data-map-longitude="${longitude}" data-map-request-user-location="${String(requestUserLocation)}" data-map-sort-by-distance="${String(sortByDistance)}" data-map-show-open-now="${String(showOpenNow)}" data-map-show-distance="${String(showDistance)}" data-map-default-cta-type="${escapeHtml(defaultCtaType)}" data-map-default-cta-label="${escapeHtml(defaultCtaLabel)}" data-map-accent="${escapeHtml(accent)}" data-map-info-label="${escapeHtml(infoLabelText)}" data-map-primary-address="${escapeHtml(primaryAddressText)}" data-map-primary-hours="${escapeHtml(primaryHoursText)}" data-map-directions-label="${escapeHtml(directionsCtaLabel)}" data-map-locate-label="${escapeHtml(locateMeLabel)}" data-map-nearby-title="${escapeHtml(nearbyTitleText)}" data-map-locating-text="${escapeHtml(locatingText)}" data-map-location-found-text="${escapeHtml(locationFoundText)}" style="${base}">
      <div style="position:relative;width:100%;height:100%;overflow:hidden;background:#0f172a;">
        <div style="position:absolute;inset:0;height:${heroHeight};overflow:hidden;background:${heroImage ? '#111827' : 'linear-gradient(160deg,#0f172a,#1d4ed8)'};">
          ${heroImage ? `<img src="${escapeHtml(heroImage)}" alt="${escapeHtml(headlineText)}" style="width:100%;height:100%;object-fit:cover;display:block;" />` : ''}
          <div style="position:absolute;inset:0;background:linear-gradient(to bottom, rgba(0,0,0,.18), rgba(0,0,0,${heroOverlayOpacity}));"></div>
          ${logoImage ? `<img src="${escapeHtml(logoImage)}" alt="${escapeHtml(brandText)}" style="position:absolute;top:12px;left:12px;height:28px;max-width:110px;object-fit:contain;" />` : ''}
          <div style="position:absolute;left:16px;right:16px;bottom:16px;color:#fff;">
            <div style="font-size:24px;font-weight:900;line-height:1.05;text-transform:uppercase;">${escapeHtml(headlineText)}</div>
            <div style="font-size:12px;margin-top:6px;opacity:.92;">${escapeHtml(subheadlineText)}</div>
          </div>
        </div>
        <div style="position:absolute;left:0;right:0;bottom:0;height:${bottomHeight};background:${escapeHtml(bottomBackgroundColor)};color:#111827;padding:14px;display:flex;flex-direction:column;gap:10px;">
          <div style="display:flex;align-items:center;gap:8px;">
            <div style="display:flex;align-items:center;gap:8px;background:${escapeHtml(searchBackgroundColor)};border:1px solid rgba(0,0,0,.08);border-radius:999px;padding:9px 12px;">
              <span style="font-size:14px;opacity:.6;">⌕</span>
              <span style="font-size:11px;">${escapeHtml(infoLabelText)}</span>
            </div>
          </div>
          <div style="display:flex;align-items:flex-start;gap:10px;">
            <div style="width:34px;height:34px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:${escapeHtml(accent)}22;color:${escapeHtml(accent)};font-size:16px;font-weight:900;flex:0 0 34px;">⌖</div>
            <div style="flex:1;min-width:0;">
              <div style="font-size:11px;font-weight:900;line-height:1.2;text-transform:uppercase;color:#555;">${escapeHtml(brandText)}</div>
              <div style="font-size:13px;font-weight:900;line-height:1.2;margin-top:4px;">${escapeHtml(primaryAddressText)}</div>
              <div style="font-size:11px;color:#666;line-height:1.25;margin-top:4px;">${escapeHtml(primaryHoursText)}</div>
            </div>
            <button type="button" data-smx-action="map-open-panel" style="appearance:none;border:none;border-radius:14px;padding:10px 14px;background:${escapeHtml(accent)};color:#fff;font-weight:800;font-size:12px;cursor:pointer;white-space:nowrap;">${escapeHtml(defaultCtaLabel)}</button>
          </div>
        </div>
        <div data-map-search-panel="true" style="position:absolute;inset:0;display:none;background:rgba(15,23,42,.24);backdrop-filter:blur(2px);padding:10px;">
          <div style="${panelMargin}width:${panelWidth};height:100%;background:#fff;border-radius:18px;box-shadow:0 14px 42px rgba(0,0,0,.24);overflow:hidden;display:flex;flex-direction:column;">
            <div style="padding:10px 12px;display:flex;align-items:center;justify-content:space-between;gap:10px;border-bottom:1px solid rgba(0,0,0,.08);background:${escapeHtml(searchBackgroundColor)};">
              <div style="display:flex;align-items:center;gap:8px;min-width:0;">
                <span style="font-size:14px;opacity:.68;">⌕</span>
                <span style="font-size:11px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(infoLabelText)}</span>
              </div>
              <button type="button" data-smx-action="map-close-panel" style="appearance:none;border:none;background:transparent;color:#334155;font-size:18px;line-height:1;cursor:pointer;">×</button>
            </div>
            <div style="position:relative;height:122px;background:${mapBackground};overflow:hidden;">
              <iframe title="Nearby locations map" srcdoc="${exportMapSrcdoc}" style="position:absolute;inset:0;width:100%;height:100%;border:0;background:${mapBackground};" loading="lazy"></iframe>
              <button type="button" data-smx-action="map-request-location" style="position:absolute;right:10px;top:10px;min-width:40px;height:40px;border-radius:999px;border:none;background:#fff;color:${escapeHtml(accent)};box-shadow:0 3px 14px rgba(0,0,0,.2);font-size:11px;font-weight:900;cursor:pointer;padding:0 10px;">${escapeHtml(locateMeLabel)}</button>
            </div>
            <div style="padding:10px 12px;border-bottom:1px solid rgba(0,0,0,.08);display:flex;align-items:flex-start;gap:10px;">
              ${logoImage ? `<img src="${escapeHtml(logoImage)}" alt="${escapeHtml(brandText)}" style="height:22px;max-width:90px;object-fit:contain;" />` : `<div style="width:12px;height:12px;border-radius:50%;background:${escapeHtml(accent)};margin-top:4px;flex:0 0 12px;"></div>`}
              <div style="flex:1;min-width:0;">
                <div data-map-search-status style="font-size:12px;font-weight:900;line-height:1.2;">${escapeHtml(infoLabelText)}</div>
                <div data-map-search-substatus style="font-size:11px;color:#555;line-height:1.25;margin-top:2px;"><b>${escapeHtml(primaryAddressText)}</b><br />${escapeHtml(primaryHoursText)}</div>
              </div>
              <button type="button" data-smx-action="map-primary-directions" style="appearance:none;border:none;border-radius:12px;padding:10px 14px;background:${escapeHtml(accent)};color:#fff;font-weight:800;font-size:12px;cursor:pointer;white-space:nowrap;">${escapeHtml(directionsCtaLabel)}</button>
            </div>
            <div style="padding:10px 12px;display:flex;flex-direction:column;gap:8px;overflow:auto;flex:1;min-height:0;">
              <div style="font-size:11px;font-weight:900;text-transform:uppercase;letter-spacing:.5px;color:#555;">${escapeHtml(nearbyTitleText)}</div>
              <div data-map-search-list></div>
            </div>
          </div>
        </div>
      </div>
    </div>`;
  }

  return `<div class="widget widget-dynamic-map" data-widget-id="${node.id}" data-map-places="${placesJson}" data-map-latitude="${latitude}" data-map-longitude="${longitude}" data-map-request-user-location="${String(requestUserLocation)}" data-map-sort-by-distance="${String(sortByDistance)}" data-map-show-open-now="${String(showOpenNow)}" data-map-show-distance="${String(showDistance)}" data-map-default-cta-type="${escapeHtml(defaultCtaType)}" data-map-default-cta-label="${escapeHtml(defaultCtaLabel)}" data-map-accent="${escapeHtml(accent)}" style="${base}">
    <div style="padding:10px 12px 0;font-size:12px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;color:${escapeHtml(accent)};display:flex;align-items:center;justify-content:space-between;gap:8px;">
      <span>${escapeHtml(String(node.props.title ?? node.name))}</span>
    </div>
    <div style="padding:8px 12px 12px;flex:1;display:grid;grid-template-columns:${gridTemplateColumns};grid-template-rows:${gridTemplateRows};gap:10px;min-height:0;">
      ${cardsOnly ? '' : `<div style="position:relative;min-height:${stackedLayout ? 150 : 110}px;border-radius:12px;overflow:hidden;background:${mapBackground};">
        <iframe title="Nearby locations map" srcdoc="${exportMapSrcdoc}" style="position:absolute;inset:0;width:100%;height:100%;border:0;background:${mapBackground};"></iframe>
        ${requestUserLocation ? `<button type="button" data-smx-action="map-request-location-inline" style="position:absolute;right:10px;top:10px;min-width:40px;height:40px;border-radius:999px;border:none;background:#fff;color:${escapeHtml(accent)};box-shadow:0 3px 14px rgba(0,0,0,.2);font-size:11px;font-weight:900;cursor:pointer;padding:0 10px;">${escapeHtml(locateMeLabel)}</button>` : ''}
      <div style="position:absolute;left:10px;right:10px;bottom:8px;display:flex;justify-content:space-between;font-size:10px;color:#0f172a;opacity:.82;pointer-events:none;"><span>${places.length} locations · zoom ${zoom}</span><span>${requestUserLocation ? 'Location ready on tap' : 'Location fixed'}</span></div></div>`}
      <div data-map-cards style="display:grid;gap:4px;overflow:auto;min-height:0;padding-right:2px;align-content:start;scrollbar-color:rgba(255,255,255,.92) rgba(255,255,255,.18);scrollbar-width:thin;">${places.map((place) => `<div data-map-card data-place-name="${escapeHtml(place.name)}" style="border-radius:10px;background:rgba(255,255,255,.78);border:1px solid ${escapeHtml(accent)}22;padding:7px 8px;display:grid;gap:3px;">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;"><strong style="font-size:11px;line-height:1.1;">${escapeHtml(place.name)}</strong><span data-place-badge style="font-size:8px;border-radius:999px;padding:2px 5px;background:${escapeHtml(accent)}22;color:#0f172a;white-space:nowrap;">${escapeHtml(place.badge || (place.openNow ? 'Open now' : 'Store'))}</span></div>
        <div style="font-size:9px;opacity:.78;line-height:1.15;">${escapeHtml(place.address || `${place.lat.toFixed(3)}, ${place.lng.toFixed(3)}`)}</div>
        <div data-place-meta style="display:flex;gap:5px;flex-wrap:wrap;font-size:9px;">${showOpenNow && place.openNow != null ? `<span data-place-open-now>${place.openNow ? 'Open now' : 'Closed'}</span>` : ''}</div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;">
          <button type="button" data-smx-action="map-place-cta" data-place-url="${escapeHtml(buildPlaceCtaUrl(place, 'waze'))}" style="display:inline-flex;align-items:center;justify-content:center;min-width:40px;height:24px;border-radius:999px;padding:0 9px;color:#fff;font-size:8px;font-weight:800;text-decoration:none;border:none;background:#08d4ff;cursor:pointer;">Waze</button>
          <button type="button" data-smx-action="map-place-cta" data-place-url="${escapeHtml(buildPlaceCtaUrl(place, 'maps'))}" style="display:inline-flex;align-items:center;justify-content:center;min-width:40px;height:24px;border-radius:999px;padding:0 9px;color:#fff;font-size:8px;font-weight:800;text-decoration:none;border:none;background:#4285f4;cursor:pointer;">Maps</button>
        </div>
      </div>`).join('')}</div>
    </div>
  </div>`;
}

function renderCountdownWidget(node: WidgetNode): string {
  const frame = node.frame;
  const style = node.style ?? {};
  const accent = String(style.accentColor ?? '#f59e0b');
  const totalSeconds = Number(
    node.props.totalSeconds ??
      (Number(node.props.days ?? 0) * 86400) +
        (Number(node.props.hours ?? 0) * 3600) +
        (Number(node.props.minutes ?? 0) * 60) +
        Number(node.props.seconds ?? 0),
  );
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
    `border-radius:${Number(style.borderRadius ?? 14)}px`,
    `background:${String(style.backgroundColor ?? '#1f2937')}`,
    `color:${String(style.color ?? '#ffffff')}`,
    `display:flex`,
    `flex-direction:column`,
  ].join(';');

  return `<div class="widget widget-countdown" data-widget-id="${node.id}" data-countdown-seconds="${totalSeconds}" style="${base}">
    <div style="padding:10px 12px 0;font-size:12px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;color:${escapeHtml(accent)};">${escapeHtml(String(node.props.title ?? node.name))}</div>
    <div style="padding:8px 12px 12px;display:grid;grid-template-columns:repeat(4,1fr);gap:8px;flex:1;align-content:center;">
      ${['DD', 'HH', 'MM', 'SS'].map((label) => `
        <div data-countdown-segment="${label}" style="border-radius:12px;padding:12px 8px;background:rgba(255,255,255,0.08);display:grid;gap:4px;">
          <div data-countdown-value="${label}" style="font-size:20px;font-weight:800;text-align:center;">00</div>
          <div style="font-size:10px;text-align:center;opacity:.75;">${label}</div>
        </div>
      `).join('')}
    </div>
  </div>`;
}

function renderSpeedTestWidget(node: WidgetNode): string {
  const frame = node.frame;
  const style = node.style ?? {};
  const accent = String(style.accentColor ?? '#2dd4bf');
  const min = Number(node.props.min ?? 10);
  const max = Number(node.props.max ?? 100);
  const current = Math.max(min, Math.min(max, Number(node.props.current ?? 64)));
  const durationMs = Math.max(300, Number(node.props.durationMs ?? 1800));
  const units = String(node.props.units ?? 'Mbps');
  const ctaLabel = String(node.props.ctaLabel ?? 'Start test');
  const resultMode = String(node.props.resultMode ?? 'random');
  const fastThreshold = Number(node.props.fastThreshold ?? 70);
  const fastMessage = String(node.props.fastMessage ?? 'WOW, very fast network');
  const slowMessage = String(node.props.slowMessage ?? 'Slow connection');
  const initialTone = current >= fastThreshold ? '#22c55e' : '#ef4444';
  const pct = Math.max(0, Math.min(100, (current / Math.max(1, max)) * 100));
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
    `border-radius:${Number(style.borderRadius ?? 14)}px`,
    `background:${String(style.backgroundColor ?? '#0b3b7a')}`,
    `color:${String(style.color ?? '#ffffff')}`,
    `display:flex`,
    `flex-direction:column`,
  ].join(';');

  return `<div class="widget widget-speed-test" data-widget-id="${node.id}" data-speed-min="${min}" data-speed-max="${max}" data-speed-current="${current}" data-speed-duration="${durationMs}" data-speed-result-mode="${escapeHtml(resultMode)}" data-speed-units="${escapeHtml(units)}" data-speed-fast-threshold="${fastThreshold}" data-speed-fast-message="${escapeHtml(fastMessage)}" data-speed-slow-message="${escapeHtml(slowMessage)}" style="${base}">
    <div style="padding:10px 12px 0;font-size:12px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;color:${escapeHtml(accent)};">${escapeHtml(String(node.props.title ?? node.name))}</div>
    <div style="padding:8px 12px 12px;display:flex;flex:1;flex-direction:column;gap:10px;">
      <div data-speed-value style="font-size:26px;font-weight:900;">${current}<span style="font-size:13px;opacity:.8;"> ${escapeHtml(units)}</span></div>
      <div data-speed-status style="font-size:12px;font-weight:800;color:${initialTone};">${escapeHtml(current >= fastThreshold ? fastMessage : slowMessage)}</div>
      <div style="height:12px;border-radius:999px;background:rgba(255,255,255,0.12);overflow:hidden;">
        <div data-speed-bar style="width:${pct}%;height:100%;background:${initialTone};"></div>
      </div>
      <button type="button" data-smx-action="speed-test-start" data-widget-id="${node.id}" style="margin-top:auto;padding:10px 12px;border-radius:12px;background:${escapeHtml(accent)};color:#111827;font-weight:800;border:none;cursor:pointer;">${escapeHtml(ctaLabel)}</button>
    </div>
  </div>`;
}

function renderButtonsWidget(node: WidgetNode): string {
  const frame = node.frame;
  const style = node.style ?? {};
  const accent = String(style.accentColor ?? '#67e8f9');
  const vertical = String(node.props.orientation ?? 'horizontal') === 'vertical';
  const primaryLabel = String(node.props.primaryLabel ?? 'Primary');
  const secondaryLabel = String(node.props.secondaryLabel ?? 'Secondary');
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
    `border-radius:${Number(style.borderRadius ?? 14)}px`,
    `background:${String(style.backgroundColor ?? '#0f766e')}`,
    `color:${String(style.color ?? '#ffffff')}`,
    `display:flex`,
    `flex-direction:column`,
  ].join(';');

  return `<div class="widget widget-buttons" data-widget-id="${node.id}" style="${base}">
    <div style="padding:10px 12px 0;font-size:12px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;color:${escapeHtml(accent)};">${escapeHtml(String(node.props.title ?? node.name))}</div>
    <div style="padding:8px 12px 12px;display:flex;flex:1;align-items:center;justify-content:center;">
      <div style="display:flex;gap:8px;flex-direction:${vertical ? 'column' : 'row'};width:100%;">
        <button type="button" class="widget-buttons-action" data-smx-action="button-select" data-widget-id="${node.id}" data-button-kind="primary" style="flex:1;padding:10px 12px;border-radius:12px;text-align:center;font-weight:800;cursor:pointer;border:none;background:${escapeHtml(accent)};color:#111827;">${escapeHtml(primaryLabel)}</button>
        <button type="button" class="widget-buttons-action" data-smx-action="button-select" data-widget-id="${node.id}" data-button-kind="secondary" style="flex:1;padding:10px 12px;border-radius:12px;text-align:center;font-weight:800;cursor:pointer;border:1px solid ${escapeHtml(accent)};background:transparent;color:inherit;">${escapeHtml(secondaryLabel)}</button>
      </div>
    </div>
  </div>`;
}

function renderInteractiveGalleryWidget(node: WidgetNode): string {
  const frame = node.frame;
  const style = node.style ?? {};
  const accent = String(style.accentColor ?? '#111827');
  const slides = parseCarouselSlides(node.props.slides, {});
  const itemCount = Math.max(1, slides.length || Number(node.props.itemCount ?? 4));
  const activeIndex = Math.max(0, Math.min(itemCount - 1, Number(node.props.activeIndex ?? 1) - 1));
  const activeSlide = slides[activeIndex] ?? slides[0];
  const slidesJson = escapeHtml(JSON.stringify(slides));
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
    `border-radius:${Number(style.borderRadius ?? 14)}px`,
    `background:${String(style.backgroundColor ?? '#ffffff')}`,
    `color:${String(style.color ?? '#111827')}`,
    `display:flex`,
    `flex-direction:column`,
  ].join(';');

  return `<div class="widget widget-interactive-gallery" data-widget-id="${node.id}" data-gallery-count="${itemCount}" data-gallery-index="${activeIndex}" data-gallery-slides="${slidesJson}" style="${base}">
    <div style="padding:10px 12px 0;font-size:12px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;color:${escapeHtml(accent)};">${escapeHtml(String(node.props.title ?? node.name))}</div>
    <div style="padding:8px 12px 12px;display:flex;flex:1;flex-direction:column;gap:10px;">
      <div data-gallery-card style="flex:1;border-radius:12px;overflow:hidden;background:${activeSlide ? '#111827' : `linear-gradient(135deg, ${escapeHtml(accent)}55, rgba(255,255,255,.08))`};display:grid;place-items:center;font-size:26px;font-weight:900;position:relative;">
        ${activeSlide ? `<img data-gallery-image src="${escapeHtml(activeSlide.src)}" alt="${escapeHtml(activeSlide.caption)}" style="width:100%;height:100%;display:block;object-fit:cover;" />` : `${activeIndex + 1} / ${itemCount}`}
        ${activeSlide ? `<div style="position:absolute;left:12px;right:12px;bottom:12px;display:flex;justify-content:space-between;align-items:end;gap:8px;"><div data-gallery-caption style="border-radius:10px;padding:8px 10px;background:rgba(15,23,42,.68);font-size:12px;color:#fff;">${escapeHtml(activeSlide.caption || `Image ${activeIndex + 1}`)}</div><div data-gallery-count style="border-radius:999px;padding:4px 8px;background:rgba(15,23,42,.68);font-size:12px;color:#fff;">${activeIndex + 1} / ${itemCount}</div></div>` : ''}
      </div>
      <div style="display:flex;gap:8px;">
        <button type="button" data-smx-action="gallery-prev" data-widget-id="${node.id}" style="flex:1;border-radius:10px;border:1px solid ${escapeHtml(accent)};background:transparent;color:inherit;padding:8px 10px;">Prev</button>
        <button type="button" data-smx-action="gallery-next" data-widget-id="${node.id}" style="flex:1;border-radius:10px;border:none;background:${escapeHtml(accent)};color:${String(style.backgroundColor ?? '#ffffff')};padding:8px 10px;font-weight:800;">Next</button>
      </div>
    </div>
  </div>`;
}

function renderShoppableSidebarWidget(node: WidgetNode, assetPathMap: Record<string, string>): string {
  const frame = node.frame;
  const style = node.style ?? {};
  const accent = String(style.accentColor ?? '#9a3412');
  const orientation = String(node.props.orientation ?? 'horizontal');
  const cardShape = String(node.props.cardShape ?? 'portrait');
  const autoscroll = Boolean(node.props.autoscroll ?? true);
  const intervalMs = Math.max(1000, Math.min(10000, Number(node.props.intervalMs ?? 2600)));
  const products = parseShoppableProducts(String(node.props.products ?? '')).map((product) => ({
    ...product,
    src: assetPathMap[product.src] ?? product.src,
  }));
  const cardSize = cardShape === 'landscape'
    ? { width: 168, height: 110 }
    : cardShape === 'square'
      ? { width: 132, height: 132 }
      : { width: 124, height: 164 };
  const activeProducts = products.length ? products : [{
    src: '',
    title: 'Product 1',
    subtitle: 'Featured item',
    price: '$0',
    rating: 4,
    ctaLabel: 'Shop now',
    url: '',
  }];
  const visibleCount = orientation === 'vertical' ? 1 : Math.min(2, activeProducts.length || 1);
  const effectiveCardSize = orientation === 'horizontal'
    ? {
        width: Math.max(110, Math.floor((frame.width - 24 - 12 * Math.max(0, visibleCount - 1)) / visibleCount)),
        height: cardSize.height,
      }
    : cardSize;
  const productsJson = escapeHtml(JSON.stringify(activeProducts));
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
    `border-radius:${Number(style.borderRadius ?? 20)}px`,
    `background:${String(style.backgroundColor ?? '#f8fafc')}`,
    `color:${String(style.color ?? '#1f2937')}`,
    `display:flex`,
    `flex-direction:column`,
  ].join(';');

  const cards = activeProducts.map((product, index) => `<article data-shoppable-card="${index}" style="width:${effectiveCardSize.width}px;min-width:${effectiveCardSize.width}px;height:${effectiveCardSize.height}px;border-radius:18px;overflow:hidden;background:#ffffff;color:#1f2937;border:1px solid ${escapeHtml(accent)}22;box-shadow:0 10px 26px rgba(15,23,42,.12);display:flex;flex-direction:column;">
      <div style="position:relative;height:${cardShape === 'landscape' ? 62 : 82}px;background:${product.src ? '#111827' : '#f8fafc'};">
        ${product.src ? `<img src="${escapeHtml(product.src)}" alt="${escapeHtml(product.title)}" style="width:100%;height:100%;object-fit:cover;display:block;" />` : ''}
      </div>
      <div style="padding:10px 10px 12px;display:grid;gap:6px;">
        <div style="font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#64748b;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(product.subtitle || 'Featured item')}</div>
        <div style="font-size:13px;font-weight:800;line-height:1.2;display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;overflow:hidden;">${escapeHtml(product.title)}</div>
        <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;">
          <div style="font-size:12px;color:${escapeHtml(accent)};">${escapeHtml(renderRatingStars(product.rating))}</div>
          <div style="font-size:15px;font-weight:900;">${escapeHtml(product.price || '$0')}</div>
        </div>
        <button type="button" data-smx-action="shoppable-cta" data-widget-id="${node.id}" data-product-url="${escapeHtml(product.url)}" style="border:none;border-radius:10px;background:${escapeHtml(accent)};color:#111827;font-weight:800;padding:8px 10px;cursor:pointer;">${escapeHtml(product.ctaLabel || 'Shop now')}</button>
      </div>
    </article>`).join('');

  return `<div class="widget widget-shoppable-sidebar" data-widget-id="${node.id}" data-shoppable-products="${productsJson}" data-shoppable-index="0" data-shoppable-layout="${escapeHtml(orientation)}" data-shoppable-card-shape="${escapeHtml(cardShape)}" data-shoppable-autoscroll="${String(autoscroll)}" data-shoppable-interval="${intervalMs}" data-shoppable-card-width="${effectiveCardSize.width}" data-shoppable-card-height="${effectiveCardSize.height}" style="${base}">
    <div style="padding:10px 12px 0;font-size:12px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;color:${escapeHtml(accent)};">${escapeHtml(String(node.props.title ?? node.name))}</div>
    <div style="padding:8px 12px 12px;display:flex;flex:1;flex-direction:column;gap:10px;min-height:0;">
      <div style="position:relative;flex:1;overflow:hidden;">
        <div data-shoppable-track style="display:flex;${orientation === 'vertical' ? 'flex-direction:column;' : ''}gap:12px;transition:transform .28s ease;">${cards}</div>
        ${activeProducts.length > 1 ? `<button type="button" data-smx-action="shoppable-prev" data-widget-id="${node.id}" style="position:absolute;left:6px;top:50%;transform:translateY(-50%);width:28px;height:28px;border-radius:999px;border:none;background:rgba(255,255,255,.86);color:#111827;font-weight:900;cursor:pointer;">‹</button>
        <button type="button" data-smx-action="shoppable-next" data-widget-id="${node.id}" style="position:absolute;right:6px;top:50%;transform:translateY(-50%);width:28px;height:28px;border-radius:999px;border:none;background:rgba(255,255,255,.86);color:#111827;font-weight:900;cursor:pointer;">›</button>` : ''}
      </div>
    </div>
  </div>`;
}

function renderWeatherConditionsWidget(node: WidgetNode): string {
  const frame = node.frame;
  const style = node.style ?? {};
  const accent = String(style.accentColor ?? '#60a5fa');
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
    `position:absolute`,
    `left:${frame.x}px`,
    `top:${frame.y}px`,
    `width:${frame.width}px`,
    `height:${frame.height}px`,
    `transform:rotate(${frame.rotation}deg)`,
    `opacity:${Number(style.opacity ?? 1)}`,
    `overflow:hidden`,
    `box-sizing:border-box`,
    `border-radius:${Number(style.borderRadius ?? 14)}px`,
    `background:${String(style.backgroundColor ?? '#f8fafc')}`,
    `color:${String(style.color ?? '#0f172a')}`,
    `display:flex`,
    `flex-direction:column`,
  ].join(';');

  return `<div class="widget widget-weather-conditions" data-widget-id="${node.id}" data-weather-location="${escapeHtml(location)}" data-weather-temperature="${temperature}" data-weather-condition="${escapeHtml(condition)}" data-weather-latitude="${latitude}" data-weather-longitude="${longitude}" data-weather-provider="${escapeHtml(provider)}" data-weather-fetch-policy="${escapeHtml(fetchPolicy)}" data-weather-cache-ttl="${cacheTtlMs}" data-weather-live="${String(liveWeather)}" style="${base}">
    <div style="padding:10px 12px 0;font-size:12px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;color:${escapeHtml(accent)};">${escapeHtml(String(node.props.title ?? node.name))}</div>
    <div style="padding:8px 12px 12px;display:flex;flex:1;flex-direction:column;gap:10px;">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;">
        <div>
          <div data-weather-temperature-display style="font-size:28px;font-weight:900;">${temperature}°</div>
          <div data-weather-location-display style="font-size:12px;opacity:.78;">${escapeHtml(location)}</div>
        </div>
        <div data-weather-icon style="font-size:34px;">${icon}</div>
      </div>
      <div style="padding:8px 10px;border-radius:10px;background:${escapeHtml(accent)}22;font-size:12px;display:flex;justify-content:space-between;gap:8px;">
        <span data-weather-condition-display>${escapeHtml(condition)}</span>
        <span data-weather-status style="opacity:.74;">${liveWeather && provider === 'open-meteo' ? 'Fetching live weather' : 'Static preview'}</span>
      </div>
    </div>
  </div>`;
}

function widgetHtml(node: PortableExportWidget, state: StudioState, assetPathMap: Record<string, string>): string {
  if (node.type === 'image') return renderImageWidget(node, assetPathMap, 'image');
  if (node.type === 'hero-image') return renderImageWidget(node, assetPathMap, 'hero-image');
  if (node.type === 'video-hero') return renderVideoWidget(node, assetPathMap);
  if (node.type === 'buttons') return renderButtonsWidget(node);
  if (node.type === 'interactive-gallery') return renderInteractiveGalleryWidget(node);
  if (node.type === 'shoppable-sidebar') return renderShoppableSidebarWidget(node, assetPathMap);
  if (node.type === 'image-carousel') return renderCarouselWidget(node, assetPathMap);
  if (node.type === 'qr-code') return renderQrCodeWidget(node);
  if (node.type === 'dynamic-map') return renderDynamicMapWidget(node);
  if (node.type === 'speed-test') return renderSpeedTestWidget(node);
  if (node.type === 'weather-conditions') return renderWeatherConditionsWidget(node);
  if (node.type === 'interactive-hotspot') return renderHotspotWidget(node);
  if (node.type === 'countdown') return renderCountdownWidget(node);
  if (node.type === 'range-slider') return renderRangeLikeWidget(node, 'Range');
  if (node.type === 'slider') return renderRangeLikeWidget(node, 'Slider');
  if (node.type === 'scratch-reveal') return renderScratchRevealWidget(node);
  const definition = getWidgetDefinition(node.type);
  if (definition.renderExport) {
    return definition.renderExport(node as unknown as WidgetNode, state);
  }
  const frame = node.frame;
  const style = node.style ?? {};
  const base = [
    `position:absolute`,
    `left:${frame.x}px`,
    `top:${frame.y}px`,
    `width:${frame.width}px`,
    `height:${frame.height}px`,
    `transform:rotate(${frame.rotation}deg)`,
    `opacity:${Number(style.opacity ?? 1)}`,
    `display:flex`,
    `align-items:center`,
    `justify-content:center`,
    `overflow:hidden`,
    `box-sizing:border-box`,
    `border-radius:${Number(style.borderRadius ?? 12)}px`,
    `background:${String(style.backgroundColor ?? 'transparent')}`,
    `color:${String(style.color ?? '#ffffff')}`,
    `font-size:${Number(style.fontSize ?? 18)}px`,
    `font-weight:${Number(style.fontWeight ?? 700)}`,
    `border:1px solid ${String(style.borderColor ?? 'rgba(255,255,255,0.14)')}`,
    `padding:8px`,
    `text-align:center`,
  ].join(';');
  return `<div class="widget widget-module" data-widget-id="${node.id}" style="${base};flex-direction:column;gap:6px;"><strong>${String(node.name)}</strong><span style="font-size:12px;opacity:.8;">${String(node.type)}</span></div>`;
}

function sceneHtml(
  scene: PortableExportScene,
  canvas: { width: number; height: number; backgroundColor: string },
  state: StudioState,
  assetPathMap: Record<string, string>,
  visibleByDefault = false,
): string {
  const widgets = scene.widgets
    .filter((widget) => !widget.hidden)
    .sort((a, b) => a.zIndex - b.zIndex);
  return `
    <section class="scene" data-scene-id="${scene.id}" data-scene-order="${scene.order}" style="position:absolute;inset:0;width:${canvas.width}px;height:${canvas.height}px;background:${escapeHtml(canvas.backgroundColor)};overflow:hidden;display:${visibleByDefault ? 'block' : 'none'};">
      ${widgets.map((widget) => widgetHtml(widget, state, assetPathMap)).join('\n')}
    </section>
  `;
}

export function buildStandaloneHtml(state: StudioState): string {
  const manifest = buildExportManifest(state);
  const activeRecord = getActiveFeedRecord(state);
  const portableProject = buildPortableProjectExport(state);
  const assetPathMap = buildExportAssetPathMap(buildExportAssetPlan(portableProject));
  const orderedScenes = [...portableProject.scenes].sort((a, b) => a.order - b.order);
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(state.document.name || 'SMX Export')}</title>
  <style>
    :root { color-scheme: dark; }
    * { box-sizing: border-box; }
    body { margin: 0; font-family: Inter, Arial, sans-serif; background: #0b1120; color: #e5e7eb; }
    .shell { min-height: 100vh; display: grid; place-items: center; padding: 32px; gap: 18px; }
    .meta { width: min(100%, 980px); display:flex; flex-wrap:wrap; gap:10px; }
    .pill { padding: 8px 12px; border-radius: 999px; background: rgba(255,255,255,.06); border: 1px solid rgba(255,255,255,.08); font-size: 12px; }
    .deck { display:grid; gap: 24px; }
    .scene-card { display:grid; gap:10px; }
    .scene-title { font-weight:800; font-size:14px; letter-spacing:.04em; text-transform:uppercase; opacity:.8; }
    button.widget-cta:hover { filter: brightness(1.05); }
    [data-map-cards]::-webkit-scrollbar { width: 10px; }
    [data-map-cards]::-webkit-scrollbar-track { background: rgba(255,255,255,.18); border-radius: 999px; }
    [data-map-cards]::-webkit-scrollbar-thumb { background: rgba(255,255,255,.92); border-radius: 999px; border: 2px solid rgba(0,0,0,0); }
  </style>
</head>
<body>
  <div class="shell">
    <div class="meta">
      <div class="pill">${escapeHtml(state.document.name)}</div>
      <div class="pill">Variant ${escapeHtml(state.ui.activeVariant)}</div>
      <div class="pill">Feed ${escapeHtml(state.ui.activeFeedSource)} / ${escapeHtml(activeRecord?.label ?? state.ui.activeFeedRecordId)}</div>
      <div class="pill">Scenes ${orderedScenes.length}</div>
      <div class="pill">Widgets ${Object.keys(state.document.widgets).length}</div>
    </div>
    <div class="deck">
      ${orderedScenes.map((scene, index) => `<div class="scene-card"><div class="scene-title">${escapeHtml(scene.name)}</div>${sceneHtml(scene, portableProject.canvas, state, assetPathMap, index === 0)}</div>`).join('\n')}
    </div>
  </div>
  <script type="application/json" id="smx-export-manifest">${escapeHtml(JSON.stringify(manifest, null, 2))}</script>
</body>
</html>`;
}

export type ExportHtmlAdapter =
  | GenericHtml5AdapterResult
  | GoogleDisplayAdapterResult
  | GamHtml5AdapterResult
  | PlayableExportAdapterResult;

function getPrimaryClickthroughUrl(adapter: ExportHtmlAdapter): string {
  if (adapter.adapter === 'playable-ad') {
    return adapter.bootstrap.clickthroughs[0]?.url ?? 'https://example.com';
  }
  return adapter.portableProject.interactions.find((interaction) => interaction.type === 'open-url')?.url ?? 'https://example.com';
}

function buildExitBootstrap(adapter: ExportHtmlAdapter): string {
  const fallbackUrl = JSON.stringify(getPrimaryClickthroughUrl(adapter));
  switch (adapter.adapter) {
    case 'gam-html5':
      return `
    window.clickTag = window.clickTag || ${fallbackUrl};
    window.smxExit = function smxExit(url) {
      var target = url || window.clickTag || ${fallbackUrl};
      if (!target) return;
      if (typeof window.open === 'function') window.open(target, '_blank');
    };`;
    case 'google-display':
      return `
    window.clickTag = window.clickTag || ${fallbackUrl};
    window.smxExit = function smxExit(url) {
      var target = url || window.clickTag || ${fallbackUrl};
      if (!target) return;
      if (typeof window.open === 'function') window.open(target, '_blank');
    };`;
    case 'generic-html5':
      return `
    window.smxExit = function smxExit(url) {
      var target = url || ${fallbackUrl};
      if (!target) return;
      if (typeof window.open === 'function') window.open(target, '_blank');
    };`;
    case 'playable-ad':
      return `
    window.smxPlayableExit = function smxPlayableExit(url) {
      var target = url || ${fallbackUrl};
      if (!target) return;
      if (typeof window.open === 'function') window.open(target, '_blank');
    };`;
    default:
      return '';
  }
}

export function buildChannelHtml(state: StudioState, adapter: ExportHtmlAdapter): string {
  const manifest = buildExportManifest(state);
  const runtimeModel = buildExportRuntimeModelFromPortable(adapter.portableProject);
  const exitConfig = buildExportExitConfig(adapter);
  const activeRecord = getActiveFeedRecord(state);
  const assetPathMap = buildExportAssetPathMap(buildExportAssetPlan(adapter.portableProject));
  const orderedScenes = [...adapter.portableProject.scenes].sort((a, b) => a.order - b.order);
  const exitBootstrap = buildExitBootstrap(adapter);
  const canvas = adapter.portableProject.canvas;
  const documentName = adapter.portableProject.name || state.document.name || 'SMX Export';

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(documentName)}</title>
  <style>
    :root { color-scheme: dark; }
    * { box-sizing: border-box; }
    body { margin: 0; font-family: Inter, Arial, sans-serif; background: transparent; color: #e5e7eb; }
    .banner-shell { width: ${canvas.width}px; height: ${canvas.height}px; position: relative; overflow: hidden; background: ${escapeHtml(canvas.backgroundColor)}; }
    .banner-stage { width: 100%; height: 100%; position: relative; overflow: hidden; }
    .scene { display: none; }
    button.widget-cta:hover { filter: brightness(1.05); }
  </style>
</head>
<body>
  <div class="banner-shell" data-document-name="${escapeHtml(documentName)}" data-active-variant="${escapeHtml(adapter.portableProject.activeVariant)}" data-active-feed="${escapeHtml(adapter.portableProject.activeFeedSource)}" data-active-record="${escapeHtml(activeRecord?.label ?? adapter.portableProject.activeFeedRecordId)}" data-adapter="${escapeHtml(adapter.adapter)}">
    <div class="banner-stage">
      ${orderedScenes.map((scene, index) => sceneHtml(scene, canvas, state, assetPathMap, index === 0)).join('\n')}
    </div>
  </div>
  <script>
  (function() {${exitBootstrap}
  })();
  </script>
  <script type="application/json" id="smx-export-manifest">${escapeHtml(JSON.stringify(manifest, null, 2))}</script>
  <script type="application/json" id="smx-runtime-model">${escapeHtml(JSON.stringify(runtimeModel, null, 2))}</script>
  <script type="application/json" id="smx-exit-config">${escapeHtml(JSON.stringify(exitConfig, null, 2))}</script>
  <script src="./runtime.js"></script>
</body>
</html>`;
}
