import type { WidgetNode } from '../../domain/document/types';
import { buildExportLeafletMapSrcdoc } from '../../export/leaflet-map-srcdoc';
import { exportTokens as exportPalette, exportZIndex } from '../../export/export-tokens';
import { escapeHtml } from '../registry/export-helpers';
import type { ExportRendererManifestEntry } from './export-registry';
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

function locateIconMarkup(color: string): string {
  return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="3.2" stroke="${escapeHtml(color)}" stroke-width="2"></circle><path d="M12 2.5v3.2M12 18.3v3.2M2.5 12h3.2M18.3 12h3.2" stroke="${escapeHtml(color)}" stroke-width="2" stroke-linecap="round"></path></svg>`;
}

export function renderDynamicMapExport(node: WidgetNode): string {
  const frame = node.frame;
  const style = node.style ?? {};
  const accent = String(style.accentColor ?? exportPalette.red);
  const latitude = Number(node.props.latitude ?? DYNAMIC_MAP_DEFAULT_LATITUDE);
  const longitude = Number(node.props.longitude ?? DYNAMIC_MAP_DEFAULT_LONGITUDE);
  const zoom = Number(node.props.zoom ?? DYNAMIC_MAP_DEFAULT_ZOOM);
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
    flag: '',
    lat: latitude,
    lng: longitude,
    address: '',
    badge: String(node.props.pinLabel ?? 'Store'),
    openNow: null,
    ctaLabel: defaultCtaLabel,
    ctaType: defaultCtaType as never,
    ctaUrl: '',
  }]).slice(0, 5);
  const mapFramePlaces = places.map((place) => ({
    name: place.name,
    lat: place.lat,
    lng: place.lng,
    address: place.address,
    badge: place.badge,
    mapsUrl: buildPlaceCtaUrl(place, 'maps'),
    wazeUrl: buildPlaceCtaUrl(place, 'waze'),
  }));
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
    resolvedUrl: buildPlaceCtaUrl(place, (place.ctaType || defaultCtaType) as never),
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
  const gridTemplateColumns = cardsOnly || stackedLayout ? '1fr' : mapFirst ? `${mapShare} ${cardsShare}` : `${cardsShare} ${mapShare}`;
  const gridTemplateRows = stackedLayout ? (mapFirst ? `${mapShare} ${cardsShare}` : `${cardsShare} ${mapShare}`) : 'none';
  const mapBackground = mode === 'dark'
    ? exportPalette.slateGradient
    : mode === 'satellite'
      ? exportPalette.forestGradient
      : exportPalette.skyGradient;
  const base = [
    'position:absolute',
    `left:${frame.x}px`,
    `top:${frame.y}px`,
    `width:${frame.width}px`,
    `height:${frame.height}px`,
    `transform:rotate(${frame.rotation}deg)`,
    `opacity:${Number(style.opacity ?? 1)}`,
    'overflow:hidden',
    'box-sizing:border-box',
    `border-radius:${Number(style.borderRadius ?? 14)}px`,
    `background:${String(style.backgroundColor ?? exportPalette.darkSurface)}`,
    `color:${String(style.color ?? exportPalette.white)}`,
    'display:flex',
    'flex-direction:column',
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
            <div style="position:relative;height:122px;background:${mapBackground};overflow:hidden;"><iframe title="Nearby locations map" srcdoc="${exportMapSrcdoc}" style="position:absolute;inset:0;width:100%;height:100%;border:0;background:${mapBackground};" loading="lazy"></iframe><button type="button" aria-label="${escapeHtml(locateMeLabel)}" title="${escapeHtml(locateMeLabel)}" data-smx-action="map-request-location" style="position:absolute;right:10px;top:10px;width:40px;height:40px;border-radius:999px;border:none;background:${exportPalette.white};color:${escapeHtml(accent)};box-shadow:0 3px 14px ${exportPalette.blackShadow20};cursor:pointer;padding:0;display:inline-flex;align-items:center;justify-content:center;z-index:${exportZIndex.local2};touch-action:manipulation;">${locateIconMarkup(accent)}</button></div>
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
      ${cardsOnly ? '' : `<div style="position:relative;min-height:${stackedLayout ? 150 : 110}px;border-radius:12px;overflow:hidden;background:${mapBackground};"><iframe title="Nearby locations map" srcdoc="${exportMapSrcdoc}" style="position:absolute;inset:0;width:100%;height:100%;border:0;background:${mapBackground};"></iframe>${requestUserLocation ? `<button type="button" aria-label="${escapeHtml(locateMeLabel)}" title="${escapeHtml(locateMeLabel)}" data-smx-action="map-request-location-inline" style="position:absolute;right:10px;top:10px;width:40px;height:40px;border-radius:999px;border:none;background:${exportPalette.white};color:${escapeHtml(accent)};box-shadow:0 3px 14px ${exportPalette.blackShadow20};cursor:pointer;padding:0;display:inline-flex;align-items:center;justify-content:center;z-index:${exportZIndex.local2};touch-action:manipulation;">${locateIconMarkup(accent)}</button>` : ''}<div style="position:absolute;left:10px;right:10px;bottom:8px;display:flex;justify-content:space-between;font-size:10px;color:${exportPalette.slate};opacity:.82;pointer-events:none;"><span>${places.length} locations · zoom ${zoom}</span><span>${requestUserLocation ? 'Location ready on tap' : 'Location fixed'}</span></div></div>`}
      <div data-map-cards data-map-scroll-region style="display:grid;gap:4px;overflow:auto;min-height:0;padding-right:2px;align-content:start;scrollbar-color:${escapeHtml(scrollbarThumbColor)} ${escapeHtml(scrollbarTrackColor)};scrollbar-width:thin;--map-scrollbar-thumb:${escapeHtml(scrollbarThumbColor)};--map-scrollbar-track:${escapeHtml(scrollbarTrackColor)};">${places.map((place) => `<div data-map-card data-place-name="${escapeHtml(place.name)}" style="border-radius:10px;background:${exportPalette.whitePanel};border:1px solid ${escapeHtml(accent)}22;padding:7px 8px;display:grid;gap:3px;"><div style="display:flex;align-items:center;justify-content:space-between;gap:8px;"><strong style="font-size:11px;line-height:1.1;">${escapeHtml(place.name)}</strong><span data-place-badge style="font-size:8px;border-radius:999px;padding:2px 5px;background:${escapeHtml(accent)}22;color:${exportPalette.slate};white-space:nowrap;">${escapeHtml(place.badge || (place.openNow ? 'Open now' : 'Store'))}</span></div><div style="font-size:9px;opacity:.78;line-height:1.15;">${escapeHtml(place.address || `${place.lat.toFixed(3)}, ${place.lng.toFixed(3)}`)}</div><div data-place-meta style="display:flex;gap:5px;flex-wrap:wrap;font-size:9px;">${showOpenNow && place.openNow != null ? `<span data-place-open-now>${place.openNow ? 'Open now' : 'Closed'}</span>` : ''}</div><div style="display:flex;gap:6px;flex-wrap:wrap;"><a href="${escapeHtml(buildPlaceCtaUrl(place, 'waze'))}" target="_blank" rel="noopener noreferrer" data-smx-action="map-place-cta" data-place-url="${escapeHtml(buildPlaceCtaUrl(place, 'waze'))}" style="display:inline-flex;flex:1;align-items:center;justify-content:center;height:30px;border-radius:12px;padding:0 10px;color:${exportPalette.white};font-size:9px;font-weight:800;text-decoration:none;border:none;background:${exportPalette.wazeBlue};cursor:pointer;">${DYNAMIC_MAP_ACTION_LABELS.waze}</a><a href="${escapeHtml(buildPlaceCtaUrl(place, 'maps'))}" target="_blank" rel="noopener noreferrer" data-smx-action="map-place-cta" data-place-url="${escapeHtml(buildPlaceCtaUrl(place, 'maps'))}" style="display:inline-flex;flex:1;align-items:center;justify-content:center;height:30px;border-radius:12px;padding:0 10px;color:${exportPalette.white};font-size:9px;font-weight:800;text-decoration:none;border:none;background:${exportPalette.mapsBlue};cursor:pointer;">${DYNAMIC_MAP_ACTION_LABELS.maps}</a></div></div>`).join('')}</div>
    </div>
  </div>`;
}

export const dynamicMapExportRenderer: ExportRendererManifestEntry = {
  type: 'dynamic-map',
  render: ({ node }) => renderDynamicMapExport(node as unknown as WidgetNode),
};
