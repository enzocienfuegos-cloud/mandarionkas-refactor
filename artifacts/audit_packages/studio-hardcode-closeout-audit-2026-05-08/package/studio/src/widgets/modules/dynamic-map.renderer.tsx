import { useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import 'leaflet/dist/leaflet.css';
import type { WidgetNode } from '../../domain/document/types';
import type { RenderContext } from '../../canvas/stage/render-context';
import { getAccent, moduleBody, moduleHeader, moduleShell, renderCollapsedIfNeeded } from './shared-styles';
import {
  buildPlaceCtaUrl,
  DYNAMIC_MAP_ACTION_LABELS,
  DYNAMIC_MAP_DEFAULT_CACHE_TTL_MS,
  DYNAMIC_MAP_DEFAULT_CTA_LABEL,
  DYNAMIC_MAP_DEFAULT_CTA_TYPE,
  DYNAMIC_MAP_DEFAULT_FETCH_POLICY,
  DYNAMIC_MAP_DEFAULT_LATITUDE,
  DYNAMIC_MAP_DEFAULT_LONGITUDE,
  DYNAMIC_MAP_DEFAULT_PROVIDER,
  DYNAMIC_MAP_DEFAULT_RADIUS_KM,
  DYNAMIC_MAP_DEFAULT_RENDER_MODE,
  DYNAMIC_MAP_DEFAULT_RESULT_LIMIT,
  DYNAMIC_MAP_DEFAULT_SCROLLBAR_THUMB,
  DYNAMIC_MAP_DEFAULT_SCROLLBAR_TRACK,
  DYNAMIC_MAP_DEFAULT_ZOOM,
  DYNAMIC_MAP_TILE_URL,
  haversineKm,
  loadNearbyPlacesSnapshot,
  parseNearbyPlaces,
  type NearbyPlace,
} from './dynamic-map.shared';

type PlaceWithDistance = NearbyPlace & { distanceKm?: number };

type LeafletRuntime = {
  map: any;
  markers: any[];
};

const dynamicMapPalette = {
  black: '#000',
  white: '#fff',
  ink: '#111',
  ink900: '#111827',
  slate900: '#0f172a',
  blue600: '#2563eb',
  muted: '#555',
  mutedSecondary: '#666',
  borderSoft: 'rgba(0,0,0,.08)',
  whiteBorder18: 'rgba(255,255,255,.18)',
  whitePanel78: 'rgba(255,255,255,.78)',
  shadow20: '0 3px 14px rgba(0,0,0,.2)',
  transparent: 'rgba(0,0,0,0)',
  heroOverlayStart: 'rgba(0,0,0,.18)',
  heroGradient: 'linear-gradient(160deg,#0f172a,#1d4ed8)',
  darkGradient: 'linear-gradient(135deg,#0f172a,#1e293b)',
  satelliteGradient: 'linear-gradient(135deg,#14532d,#365314)',
  lightGradient: 'linear-gradient(135deg,#dbeafe,#bfdbfe)',
  wazeBlue: '#08d4ff',
  mapsBlue: '#4285f4',
} as const;

const mapTooltipStyles = `.smx-map-label,.smx-map-label.leaflet-tooltip{background:${dynamicMapPalette.ink900}!important;border:none!important;border-radius:999px!important;color:${dynamicMapPalette.white}!important;padding:4px 8px!important;font-size:10px!important;font-weight:700!important;box-shadow:none!important;opacity:1!important}.smx-map-label:before,.smx-map-label.leaflet-tooltip:before{display:none!important}.smx-locator-scroll::-webkit-scrollbar{width:10px}.smx-locator-scroll::-webkit-scrollbar-track{background:var(--map-scrollbar-track,${dynamicMapPalette.whiteBorder18});border-radius:999px}.smx-locator-scroll::-webkit-scrollbar-thumb{background:var(--map-scrollbar-thumb,${dynamicMapPalette.white});border-radius:999px;border:2px solid ${dynamicMapPalette.transparent}}`;

const searchBarShellStyle = {
  position: 'relative',
} as const;

const mediaFillStyle = {
  width: '100%',
  height: '100%',
  objectFit: 'cover',
  display: 'block',
} as const;

const fillAbsoluteStyle = {
  position: 'absolute',
  inset: 0,
} as const;

const searchBarBaseLayerStyle = {
  ...fillAbsoluteStyle,
  background: dynamicMapPalette.black,
} as const;

const searchBarHeadlineWrapStyle = {
  position: 'absolute',
  left: 16,
  right: 16,
  bottom: 16,
  color: dynamicMapPalette.white,
} as const;

const searchBarHeadlineStyle = {
  fontSize: 24,
  fontWeight: 900,
  lineHeight: 1.05,
  textTransform: 'uppercase',
} as const;

const searchBarSubheadlineStyle = {
  fontSize: 12,
  marginTop: 6,
  opacity: 0.92,
} as const;

const searchBarBottomPanelBaseStyle = {
  position: 'absolute',
  left: 0,
  right: 0,
  bottom: 0,
  padding: 14,
  display: 'flex',
  flexDirection: 'column',
  gap: 10,
} as const;

const searchBarInfoRowStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
} as const;

const searchBarSearchPillBaseStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  border: `1px solid ${dynamicMapPalette.borderSoft}`,
  borderRadius: 999,
  padding: '9px 12px',
} as const;

const searchBarSearchIconStyle = {
  fontSize: 14,
  opacity: 0.6,
} as const;

const searchBarSearchLabelStyle = {
  fontSize: 11,
} as const;

const searchBarLocationRowStyle = {
  display: 'flex',
  alignItems: 'flex-start',
  gap: 10,
} as const;

const searchBarPinBaseStyle = {
  width: 34,
  height: 34,
  borderRadius: '50%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: 18,
  fontWeight: 900,
  flex: '0 0 34px',
} as const;

const searchBarPrimaryMetaStyle = {
  flex: 1,
  minWidth: 0,
} as const;

const searchBarBrandStyle = {
  fontSize: 11,
  textTransform: 'uppercase',
  letterSpacing: '.6px',
  opacity: 0.6,
} as const;

const searchBarPrimaryAddressStyle = {
  fontSize: 13,
  fontWeight: 800,
  lineHeight: 1.25,
} as const;

const searchBarPrimaryHoursStyle = {
  fontSize: 11,
  opacity: 0.72,
  lineHeight: 1.3,
} as const;

const actionRowStyle = {
  display: 'flex',
  gap: 8,
} as const;

const primaryActionBaseStyle = {
  appearance: 'none',
  border: 'none',
  borderRadius: 12,
  padding: '10px 14px',
  fontWeight: 800,
  fontSize: 12,
  cursor: 'pointer',
} as const;

const searchPanelRootStyle = {
  ...fillAbsoluteStyle,
  background: dynamicMapPalette.white,
  display: 'flex',
  flexDirection: 'column',
  zIndex: 3,
} as const;

const searchPanelHeaderBaseStyle = {
  height: 46,
  color: dynamicMapPalette.white,
  display: 'flex',
  alignItems: 'center',
  padding: '0 14px',
  gap: 10,
} as const;

const searchPanelLogoStyle = {
  height: 22,
  maxWidth: 90,
  objectFit: 'contain',
} as const;

const searchPanelTitleStyle = {
  fontSize: 13,
  fontWeight: 900,
  letterSpacing: '.3px',
  textTransform: 'uppercase',
  flex: 1,
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
} as const;

const searchPanelCloseStyle = {
  appearance: 'none',
  border: 'none',
  width: 28,
  height: 28,
  borderRadius: '50%',
  background: dynamicMapPalette.whiteBorder18,
  color: dynamicMapPalette.white,
  fontSize: 18,
  cursor: 'pointer',
} as const;

const searchPanelMapBaseStyle = {
  position: 'relative',
  flex: 1,
  minHeight: 0,
} as const;

const locateButtonBaseStyle = {
  position: 'absolute',
  right: 10,
  top: 10,
  width: 40,
  height: 40,
  borderRadius: '50%',
  border: 'none',
  background: dynamicMapPalette.white,
  boxShadow: dynamicMapPalette.shadow20,
  cursor: 'pointer',
  zIndex: 500,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  touchAction: 'manipulation',
} as const;

const searchPanelFooterBaseStyle = {
  height: 150,
  background: dynamicMapPalette.white,
  borderTop: `1px solid ${dynamicMapPalette.borderSoft}`,
  padding: '10px 12px',
  display: 'flex',
  flexDirection: 'column',
  gap: 10,
  color: dynamicMapPalette.ink,
  minHeight: 0,
} as const;

const locatorStatusRowStyle = {
  display: 'flex',
  alignItems: 'flex-start',
  gap: 10,
} as const;

const locatorStatusDotBaseStyle = {
  width: 12,
  height: 12,
  borderRadius: '50%',
  marginTop: 4,
  flex: '0 0 12px',
} as const;

const locatorStatusBodyStyle = {
  flex: 1,
  minWidth: 0,
} as const;

const locatorStatusTitleStyle = {
  fontSize: 12,
  fontWeight: 900,
  lineHeight: 1.2,
} as const;

const locatorStatusDetailStyle = {
  fontSize: 11,
  color: dynamicMapPalette.muted,
  lineHeight: 1.25,
  marginTop: 2,
} as const;

const locatorListBaseStyle = {
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
  flex: 1,
  minHeight: 0,
  overflowY: 'auto',
  paddingRight: 2,
  scrollbarWidth: 'thin',
} as const;

const locatorListHeadingStyle = {
  fontSize: 11,
  fontWeight: 900,
  textTransform: 'uppercase',
  letterSpacing: '.5px',
  color: dynamicMapPalette.muted,
} as const;

const locatorListItemBaseStyle = {
  display: 'flex',
  alignItems: 'flex-start',
  gap: 8,
  padding: '8px 10px',
  borderRadius: 12,
  background: dynamicMapPalette.white,
  cursor: 'pointer',
} as const;

const locatorListIndexBaseStyle = {
  width: 20,
  height: 20,
  borderRadius: '50%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: 11,
  fontWeight: 900,
  flex: '0 0 20px',
} as const;

const locatorListTextWrapStyle = {
  flex: 1,
  minWidth: 0,
} as const;

const locatorListTitleStyle = {
  fontSize: 12,
  fontWeight: 800,
  lineHeight: 1.2,
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
} as const;

const locatorListMetaStyle = {
  fontSize: 10,
  color: dynamicMapPalette.mutedSecondary,
  lineHeight: 1.2,
  marginTop: 2,
  display: 'flex',
  gap: 6,
  flexWrap: 'wrap',
} as const;

const badgeBaseStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  padding: '2px 6px',
  borderRadius: 999,
  fontSize: 9,
  fontWeight: 800,
  color: dynamicMapPalette.white,
} as const;

const locatorActionGroupStyle = {
  display: 'flex',
  gap: 8,
  width: 116,
} as const;

const locatorExternalActionBaseStyle = {
  display: 'inline-flex',
  flex: 1,
  alignItems: 'center',
  justifyContent: 'center',
  height: 32,
  borderRadius: 12,
  color: dynamicMapPalette.white,
  fontSize: 10,
  fontWeight: 800,
  textDecoration: 'none',
  border: 'none',
  cursor: 'pointer',
} as const;

const moduleHeaderRowStyle = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
} as const;

const moduleGridBaseStyle = {
  display: 'grid',
  gap: 10,
  flex: 1,
  minHeight: 0,
} as const;

const mapCardBaseStyle = {
  position: 'relative',
  borderRadius: 12,
  overflow: 'hidden',
} as const;

const mapStatusPillRowStyle = {
  position: 'absolute',
  left: 10,
  right: 10,
  bottom: 8,
  display: 'flex',
  justifyContent: 'space-between',
  fontSize: 10,
  color: dynamicMapPalette.slate900,
  opacity: 0.82,
} as const;

const cardsListBaseStyle = {
  display: 'grid',
  gap: 4,
  overflowY: 'auto',
  minHeight: 0,
  paddingRight: 2,
  alignContent: 'start',
  scrollbarWidth: 'thin',
} as const;

const compactCardBaseStyle = {
  borderRadius: 10,
  background: dynamicMapPalette.whitePanel78,
  padding: '7px 8px',
  display: 'grid',
  gap: 3,
  cursor: 'pointer',
} as const;

const compactCardHeaderStyle = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 8,
} as const;

const compactCardTitleStyle = {
  fontSize: 11,
  lineHeight: 1.1,
} as const;

const compactCardBadgeBaseStyle = {
  fontSize: 8,
  borderRadius: 999,
  padding: '2px 5px',
  color: dynamicMapPalette.slate900,
  whiteSpace: 'nowrap',
} as const;

const compactCardAddressStyle = {
  fontSize: 9,
  opacity: 0.78,
  lineHeight: 1.15,
} as const;

const compactCardMetaRowStyle = {
  display: 'flex',
  gap: 5,
  flexWrap: 'wrap',
  fontSize: 9,
} as const;

const compactCardActionsStyle = {
  display: 'flex',
  gap: 8,
} as const;

const compactExternalActionBaseStyle = {
  display: 'inline-flex',
  flex: 1,
  alignItems: 'center',
  justifyContent: 'center',
  height: 30,
  borderRadius: 12,
  padding: '0 9px',
  color: dynamicMapPalette.white,
  fontSize: 9,
  fontWeight: 800,
  textDecoration: 'none',
  border: 'none',
  cursor: 'pointer',
} as const;

function buildScrollbarStyle(scrollbarThumbColor: string, scrollbarTrackColor: string): CSSProperties {
  return {
    scrollbarColor: `${scrollbarThumbColor} ${scrollbarTrackColor}`,
    ['--map-scrollbar-thumb' as any]: scrollbarThumbColor,
    ['--map-scrollbar-track' as any]: scrollbarTrackColor,
  } as CSSProperties;
}

function buildHeroImageWrapStyle(heroHeight: string, heroImage: string): CSSProperties {
  return {
    ...fillAbsoluteStyle,
    height: heroHeight,
    overflow: 'hidden',
    background: heroImage ? dynamicMapPalette.ink900 : dynamicMapPalette.heroGradient,
  };
}

function buildHeroOverlayStyle(heroOverlayOpacity: number): CSSProperties {
  return {
    ...fillAbsoluteStyle,
    background: `linear-gradient(to bottom, ${dynamicMapPalette.heroOverlayStart}, rgba(0,0,0,${heroOverlayOpacity}))`,
  };
}

function buildHeroLogoStyle(): CSSProperties {
  return {
    position: 'absolute',
    top: 12,
    left: 12,
    height: 28,
    maxWidth: 110,
    objectFit: 'contain',
  };
}

function buildSearchBarBottomPanelStyle(bottomHeight: string, bottomBackgroundColor: string): CSSProperties {
  return {
    ...searchBarBottomPanelBaseStyle,
    height: bottomHeight,
    background: bottomBackgroundColor,
    color: dynamicMapPalette.ink900,
  };
}

function buildSearchPillStyle(searchBackgroundColor: string): CSSProperties {
  return {
    ...searchBarSearchPillBaseStyle,
    background: searchBackgroundColor,
  };
}

function buildPrimaryPinStyle(accent: string): CSSProperties {
  return {
    ...searchBarPinBaseStyle,
    background: `${accent}22`,
    color: accent,
  };
}

function buildPrimaryActionStyle(accent: string): CSSProperties {
  return {
    ...primaryActionBaseStyle,
    background: accent,
    color: dynamicMapPalette.white,
    flex: 1,
  };
}

function buildSearchPanelHeaderStyle(accent: string): CSSProperties {
  return {
    ...searchPanelHeaderBaseStyle,
    background: accent,
  };
}

function buildLocateButtonStyle(accent: string): CSSProperties {
  return {
    ...locateButtonBaseStyle,
    color: accent,
  };
}

function buildSearchBarShellStyle(node: WidgetNode, ctx: RenderContext): CSSProperties {
  return {
    ...moduleShell(node, ctx),
    ...searchBarShellStyle,
  };
}

function buildSearchPanelMapStyle(mapBackground: string): CSSProperties {
  return {
    ...searchPanelMapBaseStyle,
    background: mapBackground,
  };
}

function buildModuleHeaderRowStyle(node: WidgetNode): CSSProperties {
  return {
    ...moduleHeader(node),
    ...moduleHeaderRowStyle,
  };
}

function buildLocateButtonInlineStyle(locateButtonStyle: CSSProperties): CSSProperties {
  return {
    ...locateButtonStyle,
    padding: 0,
    borderRadius: 999,
  };
}

function buildLocatorStatusDotStyle(accent: string): CSSProperties {
  return {
    ...locatorStatusDotBaseStyle,
    background: accent,
  };
}

function buildDirectionsButtonStyle(accent: string): CSSProperties {
  return {
    ...primaryActionBaseStyle,
    background: accent,
    color: dynamicMapPalette.white,
    whiteSpace: 'nowrap',
  };
}

function buildLocatorListStyle(scrollbarThumbColor: string, scrollbarTrackColor: string): CSSProperties {
  return {
    ...locatorListBaseStyle,
    ...buildScrollbarStyle(scrollbarThumbColor, scrollbarTrackColor),
  };
}

function buildLocatorListItemStyle(selected: boolean, accent: string): CSSProperties {
  return {
    ...locatorListItemBaseStyle,
    border: selected ? `1px solid ${accent}` : `1px solid ${dynamicMapPalette.borderSoft}`,
  };
}

function buildLocatorIndexStyle(accent: string): CSSProperties {
  return {
    ...locatorListIndexBaseStyle,
    background: `${accent}22`,
    color: accent,
  };
}

function buildBadgeStyle(accent: string): CSSProperties {
  return {
    ...badgeBaseStyle,
    background: accent,
  };
}

function buildLocatorExternalActionStyle(background: string): CSSProperties {
  return {
    ...locatorExternalActionBaseStyle,
    background,
  };
}

function buildModuleGridStyle(gridTemplateColumns: string, gridTemplateRows: string | undefined): CSSProperties {
  return {
    ...moduleGridBaseStyle,
    gridTemplateColumns,
    gridTemplateRows,
  };
}

function buildMapCardStyle(stackedLayout: boolean, mapBackground: string): CSSProperties {
  return {
    ...mapCardBaseStyle,
    minHeight: stackedLayout ? 150 : 110,
    background: mapBackground,
  };
}

function buildCardsListStyle(scrollbarThumbColor: string, scrollbarTrackColor: string): CSSProperties {
  return {
    ...cardsListBaseStyle,
    ...buildScrollbarStyle(scrollbarThumbColor, scrollbarTrackColor),
  };
}

function buildCompactCardStyle(selected: boolean, accent: string): CSSProperties {
  return {
    ...compactCardBaseStyle,
    border: selected ? `1px solid ${accent}` : `1px solid ${accent}22`,
  };
}

function buildCompactCardBadgeStyle(accent: string): CSSProperties {
  return {
    ...compactCardBadgeBaseStyle,
    background: `${accent}22`,
  };
}

function buildCompactExternalActionStyle(background: string): CSSProperties {
  return {
    ...compactExternalActionBaseStyle,
    background,
  };
}

function bindAutoScroll(container: HTMLDivElement | null, enabled: boolean, intervalMs: number): (() => void) | undefined {
  if (!container || !enabled) return undefined;
  let intervalId = 0;
  let frameId = 0;
  let direction = 1;
  const animateStep = (targetTop: number) => {
    const startTop = container.scrollTop;
    const distance = targetTop - startTop;
    const duration = 420;
    const startedAt = performance.now();
    const tick = (now: number) => {
      const progress = Math.min(1, (now - startedAt) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      container.scrollTop = startTop + distance * eased;
      if (progress < 1) frameId = window.requestAnimationFrame(tick);
    };
    frameId = window.requestAnimationFrame(tick);
  };
  const stepOnce = () => {
    if (!container.isConnected) return;
    const maxScroll = Math.max(0, container.scrollHeight - container.clientHeight);
    if (maxScroll <= 0) return;
    const stepSize = Math.max(48, Math.floor(container.clientHeight * 0.68));
    let targetTop = container.scrollTop + direction * stepSize;
    if (targetTop >= maxScroll - 1) {
      direction = -1;
      targetTop = maxScroll;
    } else if (targetTop <= 1) {
      direction = 1;
      targetTop = 0;
    }
    animateStep(Math.max(0, Math.min(maxScroll, targetTop)));
  };
  intervalId = window.setInterval(stepOnce, Math.max(900, intervalMs));
  return () => {
    if (intervalId) window.clearInterval(intervalId);
    if (frameId) window.cancelAnimationFrame(frameId);
  };
}

function LocateIcon({ size = 18, color = 'currentColor' }: { size?: number; color?: string }): JSX.Element {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="3.2" stroke={color} strokeWidth="2" />
      <path d="M12 2.5v3.2M12 18.3v3.2M2.5 12h3.2M18.3 12h3.2" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function rankPlaces(places: NearbyPlace[], userPosition: { latitude: number; longitude: number } | null, sortByDistance: boolean): PlaceWithDistance[] {
  const next = places.map((place) => ({
    ...place,
    distanceKm: userPosition ? haversineKm(userPosition.latitude, userPosition.longitude, place.lat, place.lng) : undefined,
  }));
  if (!sortByDistance || !userPosition) return next;
  return [...next].sort((a, b) => (a.distanceKm ?? Number.MAX_SAFE_INTEGER) - (b.distanceKm ?? Number.MAX_SAFE_INTEGER));
}

function popupHtml(place: NearbyPlace, accent: string): string {
  const badge = place.badge
    ? `<span style="display:inline-flex;align-items:center;padding:2px 6px;border-radius:999px;font-size:9px;font-weight:800;color:${dynamicMapPalette.white};background:${accent};">${place.badge}</span>`
    : '';
  return `
    <div style="min-width:190px;color:${dynamicMapPalette.ink900};">
      <div style="font-size:14px;font-weight:900;line-height:1.2;">${place.name}</div>
      <div style="font-size:11px;color:${dynamicMapPalette.muted};margin-top:4px;line-height:1.3;">${place.address || ''}</div>
      <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:8px;">${badge}</div>
      <div style="display:flex;gap:8px;margin-top:10px;">
        <a href="${buildPlaceCtaUrl(place, 'waze')}" target="_blank" rel="noreferrer" style="display:inline-flex;flex:1;align-items:center;justify-content:center;height:32px;border-radius:12px;color:${dynamicMapPalette.white};font-size:10px;font-weight:800;text-decoration:none;background:${dynamicMapPalette.wazeBlue};">Waze</a>
        <a href="${buildPlaceCtaUrl(place, 'maps')}" target="_blank" rel="noreferrer" style="display:inline-flex;flex:1;align-items:center;justify-content:center;height:32px;border-radius:12px;color:${dynamicMapPalette.white};font-size:10px;font-weight:800;text-decoration:none;background:${dynamicMapPalette.mapsBlue};">Maps</a>
      </div>
    </div>
  `;
}

async function mountLeafletMap(
  container: HTMLDivElement,
  runtimeRef: { current: LeafletRuntime | null },
  config: {
    latitude: number;
    longitude: number;
    zoom: number;
    accent: string;
    places: NearbyPlace[];
    selectedPlace?: NearbyPlace | null;
    userPosition?: { latitude: number; longitude: number } | null;
    userLocationLabel?: string;
  },
): Promise<void> {
  const L = await import('leaflet');
  if (!container.isConnected) return;

  if (!runtimeRef.current) {
    const map = L.map(container, { zoomControl: true, scrollWheelZoom: true }).setView([config.latitude, config.longitude], config.zoom);
    L.tileLayer(DYNAMIC_MAP_TILE_URL, { maxZoom: 19, attribution: '' }).addTo(map);
    runtimeRef.current = { map, markers: [] };
  }

  const runtime = runtimeRef.current;
  runtime.markers.forEach((marker) => marker.remove());
  runtime.markers = [];

  config.places.forEach((place) => {
    const marker = L.circleMarker([place.lat, place.lng], {
      radius: 7,
      color: place.badge ? config.accent : config.accent,
      weight: 3,
      fillColor: dynamicMapPalette.ink900,
      fillOpacity: 1,
    }).addTo(runtime.map);

    marker.bindTooltip(place.name, {
      permanent: true,
      direction: 'top',
      offset: [0, -10],
      className: 'smx-map-label',
    });
    marker.bindPopup(popupHtml(place, config.accent), { closeButton: true, autoPan: true });
    runtime.markers.push(marker);
  });

  if (config.userPosition) {
    const userMarker = L.circleMarker([config.userPosition.latitude, config.userPosition.longitude], {
      radius: 8,
      color: dynamicMapPalette.blue600,
      weight: 3,
      fillColor: dynamicMapPalette.white,
      fillOpacity: 1,
    }).addTo(runtime.map);
    userMarker.bindTooltip(config.userLocationLabel || '', {
      permanent: true,
      direction: 'top',
      offset: [0, -10],
      className: 'smx-map-label',
    });
    runtime.markers.push(userMarker);
    runtime.map.setView([config.userPosition.latitude, config.userPosition.longitude], Math.max(runtime.map.getZoom(), config.zoom));
  } else {
    const activePlace = config.selectedPlace ?? config.places[0];
    if (activePlace) runtime.map.setView([activePlace.lat, activePlace.lng], Math.max(runtime.map.getZoom(), config.zoom));
  }
  requestAnimationFrame(() => runtime.map.invalidateSize());
}

function DynamicMapModuleRenderer({ node, ctx }: { node: WidgetNode; ctx: RenderContext }): JSX.Element {
  const accent = getAccent(node);
  const latitude = Number(node.props.latitude ?? DYNAMIC_MAP_DEFAULT_LATITUDE);
  const longitude = Number(node.props.longitude ?? DYNAMIC_MAP_DEFAULT_LONGITUDE);
  const zoom = Number(node.props.zoom ?? DYNAMIC_MAP_DEFAULT_ZOOM);
  const provider = String(node.props.provider ?? DYNAMIC_MAP_DEFAULT_PROVIDER);
  const mode = String(node.props.mode ?? 'street');
  const renderMode = String(node.props.renderMode ?? DYNAMIC_MAP_DEFAULT_RENDER_MODE);
  const mapPaneRatio = Math.max(35, Math.min(85, Number(node.props.mapPaneRatio ?? 72)));
  const requestUserLocation = Boolean(node.props.requestUserLocation ?? false);
  const sortByDistance = Boolean(node.props.sortByDistance ?? true);
  const showOpenNow = Boolean(node.props.showOpenNow ?? true);
  const showDistance = Boolean(node.props.showDistance ?? true);
  const defaultCtaType = String(node.props.ctaType ?? DYNAMIC_MAP_DEFAULT_CTA_TYPE) as any;
  const defaultCtaLabel = String(node.props.ctaLabel ?? DYNAMIC_MAP_DEFAULT_CTA_LABEL);
  const providerApiKey = String(node.props.providerApiKey ?? '');
  const providerPlaceQuery = String(node.props.providerPlaceQuery ?? '');
  const fetchPolicy = String(node.props.fetchPolicy ?? DYNAMIC_MAP_DEFAULT_FETCH_POLICY) as 'cache-first' | 'network-first' | 'cache-only';
  const cacheTtlMs = Math.max(1000, Number(node.props.cacheTtlMs ?? DYNAMIC_MAP_DEFAULT_CACHE_TTL_MS));
  const providerResultLimit = Math.max(1, Math.min(10, Number(node.props.providerResultLimit ?? DYNAMIC_MAP_DEFAULT_RESULT_LIMIT)));
  const [userPosition, setUserPosition] = useState<{ latitude: number; longitude: number } | null>(null);
  const [providerPlaces, setProviderPlaces] = useState<NearbyPlace[]>([]);
  const [providerStatus, setProviderStatus] = useState<'idle' | 'loading' | 'live' | 'error'>('idle');
  const [selectedPlace, setSelectedPlace] = useState<NearbyPlace | null>(null);
  const mapCanvasRef = useRef<HTMLDivElement | null>(null);
  const panelMapCanvasRef = useRef<HTMLDivElement | null>(null);
  const mapRuntimeRef = useRef<LeafletRuntime | null>(null);
  const panelMapRuntimeRef = useRef<LeafletRuntime | null>(null);
  const places = useMemo(() => {
    const parsed = parseNearbyPlaces(String(node.props.markersCsv ?? ''));
    const source = providerPlaces.length ? providerPlaces : parsed;
    const fallback = source.length ? source : [{
      name: String(node.props.location ?? 'Main location'),
      flag: '',
      lat: latitude,
      lng: longitude,
      address: '',
      badge: String(node.props.pinLabel ?? 'Store'),
      openNow: null,
      ctaLabel: defaultCtaLabel,
      ctaType: defaultCtaType,
      ctaUrl: '',
    }];
    return rankPlaces(fallback, userPosition, sortByDistance);
  }, [node.props.markersCsv, node.props.location, node.props.pinLabel, latitude, longitude, defaultCtaLabel, defaultCtaType, userPosition, sortByDistance, providerPlaces]);

  useEffect(() => {
    if (provider !== 'google-places' || !providerApiKey.trim() || !providerPlaceQuery.trim()) {
      setProviderPlaces([]);
      setProviderStatus('idle');
      return;
    }
    let cancelled = false;
    setProviderStatus('loading');
    void loadNearbyPlacesSnapshot({
      provider: 'google-places',
      apiKey: providerApiKey,
      query: providerPlaceQuery,
      latitude,
      longitude,
      radiusKm: Math.max(1, Number(node.props.radiusKm ?? DYNAMIC_MAP_DEFAULT_RADIUS_KM)),
      resultLimit: providerResultLimit,
      fetchPolicy,
      cacheTtlMs,
      defaultCtaType,
      defaultCtaLabel,
    }).then((snapshot) => {
      if (cancelled) return;
      if (snapshot?.places?.length) {
        setProviderPlaces(snapshot.places);
        setProviderStatus('live');
        return;
      }
      setProviderPlaces([]);
      setProviderStatus('error');
    });
    return () => {
      cancelled = true;
    };
  }, [provider, providerApiKey, providerPlaceQuery, latitude, longitude, node.props.radiusKm, providerResultLimit, fetchPolicy, cacheTtlMs, defaultCtaType, defaultCtaLabel]);

  useEffect(() => {
    if (!ctx.previewMode || !requestUserLocation || typeof navigator === 'undefined' || !navigator.geolocation) return;
    let cancelled = false;
    navigator.geolocation.getCurrentPosition((position) => {
      if (cancelled) return;
      setUserPosition({ latitude: position.coords.latitude, longitude: position.coords.longitude });
    }, () => {
      if (!cancelled) setUserPosition(null);
    }, { enableHighAccuracy: true, timeout: 8000, maximumAge: 120000 });
    return () => {
      cancelled = true;
    };
  }, [ctx.previewMode, requestUserLocation]);

  const mapBackground = mode === 'dark'
    ? dynamicMapPalette.darkGradient
    : mode === 'satellite'
      ? dynamicMapPalette.satelliteGradient
      : dynamicMapPalette.lightGradient;

  const cardsOnly = renderMode === 'cards-only';
  const mapFirst = renderMode === 'map-first';
  const searchBarMode = renderMode === 'search-bar';
  const isVertical = node.frame.height > node.frame.width;
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
    : undefined;
  const mapCenterLat = userPosition?.latitude ?? latitude;
  const mapCenterLng = userPosition?.longitude ?? longitude;
  const [panelOpen, setPanelOpen] = useState(false);
  const [panelState, setPanelState] = useState<'default' | 'locating' | 'located'>('default');
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
  const heroImage = String(node.props.heroImage ?? '');
  const logoImage = String(node.props.logoImage ?? '');
  const bottomBackgroundColor = String(node.props.bottomBackgroundColor ?? dynamicMapPalette.white);
  const searchBackgroundColor = String(node.props.searchBackgroundColor ?? dynamicMapPalette.white);
  const heroOverlayOpacity = Math.max(0, Math.min(1, Number(node.props.heroOverlayOpacity ?? 0.45)));

  const nearestPlaces = places.slice(0, 3);
  const listedPlaces = places;
  const cardsListRef = useRef<HTMLDivElement | null>(null);
  const searchListScrollRef = useRef<HTMLDivElement | null>(null);
  const cardsAutoscroll = Boolean(node.props.cardsAutoscroll ?? false);
  const cardsAutoscrollIntervalMs = Math.max(800, Number(node.props.cardsAutoscrollIntervalMs ?? 2200));
  const scrollbarThumbColor = String(node.props.scrollbarThumbColor ?? DYNAMIC_MAP_DEFAULT_SCROLLBAR_THUMB);
  const scrollbarTrackColor = String(node.props.scrollbarTrackColor ?? DYNAMIC_MAP_DEFAULT_SCROLLBAR_TRACK);
  const openPrimaryCta = () => {
    setPanelOpen(true);
    ctx.triggerWidgetAction('click');
  };
  const requestUserPosition = () => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return;
    setPanelState('locating');
    navigator.geolocation.getCurrentPosition((position) => {
      setUserPosition({ latitude: position.coords.latitude, longitude: position.coords.longitude });
      setPanelState('located');
    }, () => {
      setPanelState('default');
    }, { enableHighAccuracy: true, timeout: 8000, maximumAge: 120000 });
  };

  useEffect(() => {
    setSelectedPlace((current) => current && places.some((place) => place.name === current.name && place.lat === current.lat && place.lng === current.lng) ? current : (places[0] ?? null));
  }, [places]);

  useEffect(() => {
    if (!mapCanvasRef.current || cardsOnly) return;
    void mountLeafletMap(mapCanvasRef.current, mapRuntimeRef, {
      latitude: mapCenterLat,
      longitude: mapCenterLng,
      zoom,
      accent,
      places,
      selectedPlace,
      userPosition,
      userLocationLabel: locateMeLabel,
    });
  }, [cardsOnly, mapCenterLat, mapCenterLng, zoom, accent, places, selectedPlace, userPosition]);

  useEffect(() => {
    if (!panelOpen || !panelMapCanvasRef.current || cardsOnly) return;
    void mountLeafletMap(panelMapCanvasRef.current, panelMapRuntimeRef, {
      latitude: mapCenterLat,
      longitude: mapCenterLng,
      zoom,
      accent,
      places,
      selectedPlace,
      userPosition,
      userLocationLabel: locateMeLabel,
    });
  }, [panelOpen, cardsOnly, mapCenterLat, mapCenterLng, zoom, accent, places, selectedPlace, userPosition]);

  useEffect(() => bindAutoScroll(cardsListRef.current, cardsAutoscroll, cardsAutoscrollIntervalMs), [cardsAutoscroll, cardsAutoscrollIntervalMs, places.length, renderMode]);
  useEffect(() => bindAutoScroll(searchListScrollRef.current, cardsAutoscroll, cardsAutoscrollIntervalMs), [cardsAutoscroll, cardsAutoscrollIntervalMs, listedPlaces.length, panelOpen, renderMode]);

  if (searchBarMode) {
    const heroHeight = isVertical ? '46%' : '60%';
    const bottomHeight = isVertical ? '54%' : '40%';
    const heroWrapStyle = buildHeroImageWrapStyle(heroHeight, heroImage);
    const heroOverlayStyle = buildHeroOverlayStyle(heroOverlayOpacity);
    const heroLogoStyle = buildHeroLogoStyle();
    const searchBarBottomPanelStyle = buildSearchBarBottomPanelStyle(bottomHeight, bottomBackgroundColor);
    const searchPillStyle = buildSearchPillStyle(searchBackgroundColor);
    const primaryPinStyle = buildPrimaryPinStyle(accent);
    const primaryActionStyle = buildPrimaryActionStyle(accent);
    const searchPanelHeaderStyle = buildSearchPanelHeaderStyle(accent);
    const locateButtonStyle = buildLocateButtonStyle(accent);
    const locatorStatusDotStyle = buildLocatorStatusDotStyle(accent);
    const directionsButtonStyle = buildDirectionsButtonStyle(accent);
    const locatorListStyle = buildLocatorListStyle(scrollbarThumbColor, scrollbarTrackColor);
    return (
      <div style={buildSearchBarShellStyle(node, ctx)}>
        <style>{mapTooltipStyles}</style>
        <div style={searchBarBaseLayerStyle}>
          <div style={heroWrapStyle}>
            {heroImage ? <img src={heroImage} alt={headlineText} style={mediaFillStyle} /> : null}
            <div style={heroOverlayStyle} />
            {logoImage ? <img src={logoImage} alt={brandText} style={heroLogoStyle} /> : null}
            <div style={searchBarHeadlineWrapStyle}>
              <div style={searchBarHeadlineStyle}>{headlineText}</div>
              <div style={searchBarSubheadlineStyle}>{subheadlineText}</div>
            </div>
          </div>
          <div style={searchBarBottomPanelStyle}>
            <div style={searchBarInfoRowStyle}>
              <div style={searchPillStyle}>
                <span style={searchBarSearchIconStyle}>⌕</span>
                <span style={searchBarSearchLabelStyle}>{infoLabelText}</span>
              </div>
            </div>
            <div style={searchBarLocationRowStyle}>
              <div style={primaryPinStyle}>⌖</div>
              <div style={searchBarPrimaryMetaStyle}>
                <div style={searchBarBrandStyle}>{brandText}</div>
                <div style={searchBarPrimaryAddressStyle}>{primaryAddressText}</div>
                <div style={searchBarPrimaryHoursStyle}>{primaryHoursText}</div>
              </div>
            </div>
            <div style={actionRowStyle}>
              <button type="button" onClick={(event) => { event.stopPropagation(); openPrimaryCta(); }} style={primaryActionStyle}>{defaultCtaLabel}</button>
            </div>
          </div>

          {panelOpen ? (
            <div style={searchPanelRootStyle}>
              <div style={searchPanelHeaderStyle}>
                {logoImage ? <img src={logoImage} alt={brandText} style={searchPanelLogoStyle} /> : null}
                <div style={searchPanelTitleStyle}>{brandText}</div>
                <button type="button" onClick={(event) => { event.stopPropagation(); setPanelOpen(false); }} style={searchPanelCloseStyle}>×</button>
              </div>
              <div style={buildSearchPanelMapStyle(mapBackground)}>
                {!cardsOnly ? (
                  <>
                    <div ref={panelMapCanvasRef} style={fillAbsoluteStyle} />
                  </>
                ) : null}
                <button type="button" aria-label={locateMeLabel} title={locateMeLabel} onClick={(event) => { event.stopPropagation(); requestUserPosition(); }} style={locateButtonStyle}><LocateIcon size={18} color={accent} /></button>
              </div>
              <div style={searchPanelFooterBaseStyle}>
                <div style={locatorStatusRowStyle}>
                  <div style={locatorStatusDotStyle} />
                  <div style={locatorStatusBodyStyle}>
                    <div style={locatorStatusTitleStyle}>
                      {panelState === 'locating' ? locatingText : panelState === 'located' ? locationFoundText : infoLabelText}
                    </div>
                    <div style={locatorStatusDetailStyle}>
                      {panelState === 'located' ? nearbyTitleText : <><b>{primaryAddressText}</b><br />{primaryHoursText}</>}
                    </div>
                  </div>
                  <button type="button" onClick={(event) => { event.stopPropagation(); if (nearestPlaces[0]) window.open(buildPlaceCtaUrl(nearestPlaces[0], 'maps'), '_blank'); }} style={directionsButtonStyle}>{directionsCtaLabel}</button>
                </div>
                <div ref={searchListScrollRef} className="smx-locator-scroll" style={locatorListStyle}>
                  <div style={locatorListHeadingStyle}>{nearbyTitleText}</div>
                  {listedPlaces.map((place, index) => (
                    <div key={`${place.name}-${index}-nearest`} onClick={() => setSelectedPlace(place)} style={buildLocatorListItemStyle(Boolean(selectedPlace?.name === place.name && selectedPlace?.lat === place.lat && selectedPlace?.lng === place.lng), accent)}>
                      <div style={buildLocatorIndexStyle(accent)}>{index + 1}</div>
                      <div style={locatorListTextWrapStyle}>
                        <div style={locatorListTitleStyle}>{place.name}</div>
                        <div style={locatorListMetaStyle}>
                          <span>{place.address || primaryHoursText}</span>
                          {place.badge ? <span style={buildBadgeStyle(accent)}>{place.badge}</span> : null}
                        </div>
                      </div>
                      <div style={locatorActionGroupStyle}>
                        <button type="button" onClick={(event) => { event.stopPropagation(); window.open(buildPlaceCtaUrl(place, 'waze'), '_blank'); }} style={buildLocatorExternalActionStyle(dynamicMapPalette.wazeBlue)}>{DYNAMIC_MAP_ACTION_LABELS.waze}</button>
                        <button type="button" onClick={(event) => { event.stopPropagation(); window.open(buildPlaceCtaUrl(place, 'maps'), '_blank'); }} style={buildLocatorExternalActionStyle(dynamicMapPalette.mapsBlue)}>{DYNAMIC_MAP_ACTION_LABELS.maps}</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  const moduleGridStyle = buildModuleGridStyle(gridTemplateColumns, gridTemplateRows);
  const mapCardStyle = buildMapCardStyle(stackedLayout, mapBackground);
  const locateButtonStyle = buildLocateButtonStyle(accent);
  const cardsListStyle = buildCardsListStyle(scrollbarThumbColor, scrollbarTrackColor);
  return (
    <div style={moduleShell(node, ctx)}>
      <style>{mapTooltipStyles}</style>
      <div style={buildModuleHeaderRowStyle(node)}>
        <span>{String(node.props.title ?? node.name)}</span>
      </div>
      <div style={moduleBody}>
        <div style={moduleGridStyle}>
          {!cardsOnly ? (
            <div style={mapCardStyle}>
              <div ref={mapCanvasRef} style={fillAbsoluteStyle} />
              {requestUserLocation ? (
                <button
                  type="button"
                  aria-label={locateMeLabel}
                  title={locateMeLabel}
                  onClick={(event) => {
                    event.stopPropagation();
                    requestUserPosition();
                  }}
                  style={buildLocateButtonInlineStyle(locateButtonStyle)}
                >
                  <LocateIcon size={18} color={accent} />
                </button>
              ) : null}
              <div style={mapStatusPillRowStyle}>
                <span>{places.length} locations · zoom {zoom}</span>
                <span>{providerStatus === 'loading' ? 'Syncing locations' : providerStatus === 'error' ? 'Places unavailable' : userPosition ? 'Location ready' : requestUserLocation ? 'Tap to locate' : 'Location fixed'}</span>
              </div>
            </div>
          ) : null}
          <div ref={cardsListRef} className="smx-locator-scroll" style={cardsListStyle}>
            {places.map((place, index) => {
              const selected = Boolean(selectedPlace?.name === place.name && selectedPlace?.lat === place.lat && selectedPlace?.lng === place.lng);
              return (
                <div key={`${place.name}-${index}-card`} onClick={() => setSelectedPlace(place)} style={buildCompactCardStyle(selected, accent)}>
                  <div style={compactCardHeaderStyle}>
                    <strong style={compactCardTitleStyle}>{place.name}</strong>
                    <span style={buildCompactCardBadgeStyle(accent)}>{place.badge || (place.openNow ? 'Open now' : 'Store')}</span>
                  </div>
                  <div style={compactCardAddressStyle}>{place.address || `${place.lat.toFixed(3)}, ${place.lng.toFixed(3)}`}</div>
                  <div style={compactCardMetaRowStyle}>
                    {showOpenNow && place.openNow != null ? <span>{place.openNow ? 'Open now' : 'Closed'}</span> : null}
                    {showDistance && place.distanceKm != null ? <span>{place.distanceKm.toFixed(1)} km</span> : null}
                  </div>
                  <div style={compactCardActionsStyle}>
                    <button type="button" onClick={(event) => { event.stopPropagation(); ctx.triggerWidgetAction('click'); if (ctx.previewMode) window.open(buildPlaceCtaUrl(place, 'waze'), '_blank'); }} style={buildCompactExternalActionStyle(dynamicMapPalette.wazeBlue)}>
                      {DYNAMIC_MAP_ACTION_LABELS.waze}
                    </button>
                    <button type="button" onClick={(event) => { event.stopPropagation(); ctx.triggerWidgetAction('click'); if (ctx.previewMode) window.open(buildPlaceCtaUrl(place, 'maps'), '_blank'); }} style={buildCompactExternalActionStyle(dynamicMapPalette.mapsBlue)}>
                      {DYNAMIC_MAP_ACTION_LABELS.maps}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

export function renderDynamicMapStage(node: WidgetNode, ctx: RenderContext): JSX.Element {
  const collapsed = renderCollapsedIfNeeded(node, ctx);
  if (collapsed) return collapsed;
  return <DynamicMapModuleRenderer node={node} ctx={ctx} />;
}
