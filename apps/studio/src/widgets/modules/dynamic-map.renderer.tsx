import { useEffect, useMemo, useRef, useState } from 'react';
import 'leaflet/dist/leaflet.css';
import type { WidgetNode } from '../../domain/document/types';
import type { RenderContext } from '../../canvas/stage/render-context';
import { getAccent, moduleBody, moduleHeader, moduleShell, renderCollapsedIfNeeded } from './shared-styles';
import { buildPlaceCtaUrl, haversineKm, loadNearbyPlacesSnapshot, parseNearbyPlaces, type NearbyPlace } from './dynamic-map.shared';

type PlaceWithDistance = NearbyPlace & { distanceKm?: number };

type LeafletRuntime = {
  map: any;
  markers: any[];
};

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
    ? `<span style="display:inline-flex;align-items:center;padding:2px 6px;border-radius:999px;font-size:9px;font-weight:800;color:#fff;background:${accent};">${place.badge}</span>`
    : '';
  return `
    <div style="min-width:190px;color:#111827;">
      <div style="font-size:14px;font-weight:900;line-height:1.2;">${place.name}</div>
      <div style="font-size:11px;color:#555;margin-top:4px;line-height:1.3;">${place.address || ''}</div>
      <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:8px;">${badge}</div>
      <div style="display:flex;gap:8px;margin-top:10px;">
        <a href="${buildPlaceCtaUrl(place, 'waze')}" target="_blank" rel="noreferrer" style="display:inline-flex;flex:1;align-items:center;justify-content:center;height:32px;border-radius:12px;color:#fff;font-size:10px;font-weight:800;text-decoration:none;background:#08d4ff;">Waze</a>
        <a href="${buildPlaceCtaUrl(place, 'maps')}" target="_blank" rel="noreferrer" style="display:inline-flex;flex:1;align-items:center;justify-content:center;height:32px;border-radius:12px;color:#fff;font-size:10px;font-weight:800;text-decoration:none;background:#4285f4;">Maps</a>
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
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', { maxZoom: 19, attribution: '' }).addTo(map);
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
      fillColor: '#111827',
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
      color: '#2563eb',
      weight: 3,
      fillColor: '#ffffff',
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
  const latitude = Number(node.props.latitude ?? 13.6929);
  const longitude = Number(node.props.longitude ?? -89.2182);
  const zoom = Number(node.props.zoom ?? 13);
  const provider = String(node.props.provider ?? 'manual');
  const mode = String(node.props.mode ?? 'street');
  const renderMode = String(node.props.renderMode ?? 'cards-map');
  const mapPaneRatio = Math.max(35, Math.min(85, Number(node.props.mapPaneRatio ?? 72)));
  const requestUserLocation = Boolean(node.props.requestUserLocation ?? false);
  const sortByDistance = Boolean(node.props.sortByDistance ?? true);
  const showOpenNow = Boolean(node.props.showOpenNow ?? true);
  const showDistance = Boolean(node.props.showDistance ?? true);
  const defaultCtaType = String(node.props.ctaType ?? 'maps') as any;
  const defaultCtaLabel = String(node.props.ctaLabel ?? 'Open in Maps');
  const providerApiKey = String(node.props.providerApiKey ?? '');
  const providerPlaceQuery = String(node.props.providerPlaceQuery ?? '');
  const fetchPolicy = String(node.props.fetchPolicy ?? 'network-first') as 'cache-first' | 'network-first' | 'cache-only';
  const cacheTtlMs = Math.max(1000, Number(node.props.cacheTtlMs ?? 300000));
  const providerResultLimit = Math.max(1, Math.min(10, Number(node.props.providerResultLimit ?? 5)));
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
      radiusKm: Math.max(1, Number(node.props.radiusKm ?? 5)),
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
    ? 'linear-gradient(135deg,#0f172a,#1e293b)'
    : mode === 'satellite'
      ? 'linear-gradient(135deg,#14532d,#365314)'
      : 'linear-gradient(135deg,#dbeafe,#bfdbfe)';

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
  const bottomBackgroundColor = String(node.props.bottomBackgroundColor ?? '#ffffff');
  const searchBackgroundColor = String(node.props.searchBackgroundColor ?? '#ffffff');
  const heroOverlayOpacity = Math.max(0, Math.min(1, Number(node.props.heroOverlayOpacity ?? 0.45)));

  const nearestPlaces = places.slice(0, 3);
  const listedPlaces = places;
  const cardsListRef = useRef<HTMLDivElement | null>(null);
  const searchListScrollRef = useRef<HTMLDivElement | null>(null);
  const cardsAutoscroll = Boolean(node.props.cardsAutoscroll ?? false);
  const cardsAutoscrollIntervalMs = Math.max(800, Number(node.props.cardsAutoscrollIntervalMs ?? 2200));
  const scrollbarThumbColor = String(node.props.scrollbarThumbColor ?? '#ffffff');
  const scrollbarTrackColor = String(node.props.scrollbarTrackColor ?? 'rgba(255,255,255,0.18)');
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
    return (
      <div style={{ ...moduleShell(node, ctx), position: 'relative' }}>
        <style>{`.smx-map-label,.smx-map-label.leaflet-tooltip{background:#111827!important;border:none!important;border-radius:999px!important;color:#fff!important;padding:4px 8px!important;font-size:10px!important;font-weight:700!important;box-shadow:none!important;opacity:1!important}.smx-map-label:before,.smx-map-label.leaflet-tooltip:before{display:none!important}.smx-locator-scroll::-webkit-scrollbar{width:10px}.smx-locator-scroll::-webkit-scrollbar-track{background:var(--map-scrollbar-track,rgba(255,255,255,.18));border-radius:999px}.smx-locator-scroll::-webkit-scrollbar-thumb{background:var(--map-scrollbar-thumb,#fff);border-radius:999px;border:2px solid rgba(0,0,0,0)}`}</style>
        <div style={{ position: 'absolute', inset: 0, background: '#000' }}>
          <div style={{ position: 'absolute', inset: 0, height: heroHeight, overflow: 'hidden', background: heroImage ? '#111827' : 'linear-gradient(160deg,#0f172a,#1d4ed8)' }}>
            {heroImage ? <img src={heroImage} alt={headlineText} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} /> : null}
            <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(to bottom, rgba(0,0,0,.18), rgba(0,0,0,${heroOverlayOpacity}))` }} />
            {logoImage ? <img src={logoImage} alt={brandText} style={{ position: 'absolute', top: 12, left: 12, height: 28, maxWidth: 110, objectFit: 'contain' }} /> : null}
            <div style={{ position: 'absolute', left: 16, right: 16, bottom: 16, color: '#fff' }}>
              <div style={{ fontSize: 24, fontWeight: 900, lineHeight: 1.05, textTransform: 'uppercase' }}>{headlineText}</div>
              <div style={{ fontSize: 12, marginTop: 6, opacity: 0.92 }}>{subheadlineText}</div>
            </div>
          </div>
          <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: bottomHeight, background: bottomBackgroundColor, color: '#111827', padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: searchBackgroundColor, border: '1px solid rgba(0,0,0,.08)', borderRadius: 999, padding: '9px 12px' }}>
                <span style={{ fontSize: 14, opacity: 0.6 }}>⌕</span>
                <span style={{ fontSize: 11 }}>{infoLabelText}</span>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
              <div style={{ width: 34, height: 34, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: `${accent}22`, color: accent, fontSize: 18, fontWeight: 900, flex: '0 0 34px' }}>⌖</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.6px', opacity: 0.6 }}>{brandText}</div>
                <div style={{ fontSize: 13, fontWeight: 800, lineHeight: 1.25 }}>{primaryAddressText}</div>
                <div style={{ fontSize: 11, opacity: 0.72, lineHeight: 1.3 }}>{primaryHoursText}</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" onClick={(event) => { event.stopPropagation(); openPrimaryCta(); }} style={{ appearance: 'none', border: 'none', borderRadius: 12, padding: '10px 14px', fontWeight: 800, fontSize: 12, cursor: 'pointer', background: accent, color: '#fff', flex: 1 }}>{defaultCtaLabel}</button>
            </div>
          </div>

          {panelOpen ? (
            <div style={{ position: 'absolute', inset: 0, background: '#fff', display: 'flex', flexDirection: 'column', zIndex: 3 }}>
              <div style={{ height: 46, background: accent, color: '#fff', display: 'flex', alignItems: 'center', padding: '0 14px', gap: 10 }}>
                {logoImage ? <img src={logoImage} alt={brandText} style={{ height: 22, maxWidth: 90, objectFit: 'contain' }} /> : null}
                <div style={{ fontSize: 13, fontWeight: 900, letterSpacing: '.3px', textTransform: 'uppercase', flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{brandText}</div>
                <button type="button" onClick={(event) => { event.stopPropagation(); setPanelOpen(false); }} style={{ appearance: 'none', border: 'none', width: 28, height: 28, borderRadius: '50%', background: 'rgba(255,255,255,.18)', color: '#fff', fontSize: 18, cursor: 'pointer' }}>×</button>
              </div>
              <div style={{ position: 'relative', flex: 1, minHeight: 0, background: mapBackground }}>
                {!cardsOnly ? (
                  <>
                    <div ref={panelMapCanvasRef} style={{ position: 'absolute', inset: 0 }} />
                  </>
                ) : null}
                <button type="button" aria-label={locateMeLabel} title={locateMeLabel} onClick={(event) => { event.stopPropagation(); requestUserPosition(); }} style={{ position: 'absolute', right: 10, top: 10, width: 40, height: 40, borderRadius: '50%', border: 'none', background: '#fff', color: accent, boxShadow: '0 3px 14px rgba(0,0,0,.2)', cursor: 'pointer', zIndex: 500, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', touchAction: 'manipulation' }}><LocateIcon size={18} color={accent} /></button>
              </div>
              <div style={{ height: 150, background: '#fff', borderTop: '1px solid rgba(0,0,0,.08)', padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 10, color: '#111', minHeight: 0 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <div style={{ width: 12, height: 12, borderRadius: '50%', background: accent, marginTop: 4, flex: '0 0 12px' }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 900, lineHeight: 1.2 }}>
                      {panelState === 'locating' ? locatingText : panelState === 'located' ? locationFoundText : infoLabelText}
                    </div>
                    <div style={{ fontSize: 11, color: '#555', lineHeight: 1.25, marginTop: 2 }}>
                      {panelState === 'located' ? nearbyTitleText : <><b>{primaryAddressText}</b><br />{primaryHoursText}</>}
                    </div>
                  </div>
                  <button type="button" onClick={(event) => { event.stopPropagation(); if (nearestPlaces[0]) window.open(buildPlaceCtaUrl(nearestPlaces[0], 'maps'), '_blank'); }} style={{ appearance: 'none', border: 'none', borderRadius: 12, padding: '10px 14px', background: accent, color: '#fff', fontWeight: 800, fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap' }}>{directionsCtaLabel}</button>
                </div>
                <div ref={searchListScrollRef} className="smx-locator-scroll" style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1, minHeight: 0, overflowY: 'auto', paddingRight: 2, scrollbarColor: `${scrollbarThumbColor} ${scrollbarTrackColor}`, scrollbarWidth: 'thin' as const, ['--map-scrollbar-thumb' as any]: scrollbarThumbColor, ['--map-scrollbar-track' as any]: scrollbarTrackColor }}>
                  <div style={{ fontSize: 11, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '.5px', color: '#555' }}>{nearbyTitleText}</div>
                  {listedPlaces.map((place, index) => (
                    <div key={`${place.name}-${index}-nearest`} onClick={() => setSelectedPlace(place)} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '8px 10px', border: selectedPlace?.name === place.name && selectedPlace?.lat === place.lat && selectedPlace?.lng === place.lng ? `1px solid ${accent}` : '1px solid rgba(0,0,0,.08)', borderRadius: 12, background: '#fff', cursor: 'pointer' }}>
                      <div style={{ width: 20, height: 20, borderRadius: '50%', background: `${accent}22`, color: accent, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 900, flex: '0 0 20px' }}>{index + 1}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 800, lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{place.name}</div>
                        <div style={{ fontSize: 10, color: '#666', lineHeight: 1.2, marginTop: 2, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          <span>{place.address || primaryHoursText}</span>
                          {place.badge ? <span style={{ display: 'inline-flex', alignItems: 'center', padding: '2px 6px', borderRadius: 999, fontSize: 9, fontWeight: 800, color: '#fff', background: accent }}>{place.badge}</span> : null}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 8, width: 116 }}>
                        <button type="button" onClick={(event) => { event.stopPropagation(); window.open(buildPlaceCtaUrl(place, 'waze'), '_blank'); }} style={{ display: 'inline-flex', flex: 1, alignItems: 'center', justifyContent: 'center', height: 32, borderRadius: 12, color: '#fff', fontSize: 10, fontWeight: 800, textDecoration: 'none', border: 'none', background: '#08d4ff', cursor: 'pointer' }}>Waze</button>
                        <button type="button" onClick={(event) => { event.stopPropagation(); window.open(buildPlaceCtaUrl(place, 'maps'), '_blank'); }} style={{ display: 'inline-flex', flex: 1, alignItems: 'center', justifyContent: 'center', height: 32, borderRadius: 12, color: '#fff', fontSize: 10, fontWeight: 800, textDecoration: 'none', border: 'none', background: '#4285f4', cursor: 'pointer' }}>Maps</button>
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

  return (
    <div style={moduleShell(node, ctx)}>
      <style>{`.smx-map-label,.smx-map-label.leaflet-tooltip{background:#111827!important;border:none!important;border-radius:999px!important;color:#fff!important;padding:4px 8px!important;font-size:10px!important;font-weight:700!important;box-shadow:none!important;opacity:1!important}.smx-map-label:before,.smx-map-label.leaflet-tooltip:before{display:none!important}.smx-locator-scroll::-webkit-scrollbar{width:10px}.smx-locator-scroll::-webkit-scrollbar-track{background:var(--map-scrollbar-track,rgba(255,255,255,.18));border-radius:999px}.smx-locator-scroll::-webkit-scrollbar-thumb{background:var(--map-scrollbar-thumb,#fff);border-radius:999px;border:2px solid rgba(0,0,0,0)}`}</style>
      <div style={{ ...moduleHeader(node), display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span>{String(node.props.title ?? node.name)}</span>
      </div>
      <div style={moduleBody}>
        <div style={{ display: 'grid', gap: 10, gridTemplateColumns: gridTemplateColumns, gridTemplateRows: gridTemplateRows, flex: 1, minHeight: 0 }}>
          {!cardsOnly ? (
            <div style={{ position: 'relative', borderRadius: 12, overflow: 'hidden', minHeight: stackedLayout ? 150 : 110, background: mapBackground }}>
              <div ref={mapCanvasRef} style={{ position: 'absolute', inset: 0 }} />
              {requestUserLocation ? (
                <button
                  type="button"
                  aria-label={locateMeLabel}
                  title={locateMeLabel}
                  onClick={(event) => {
                    event.stopPropagation();
                    requestUserPosition();
                  }}
                  style={{ position: 'absolute', right: 10, top: 10, width: 40, height: 40, borderRadius: 999, border: 'none', background: '#fff', color: accent, boxShadow: '0 3px 14px rgba(0,0,0,.2)', cursor: 'pointer', padding: 0, zIndex: 500, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', touchAction: 'manipulation' }}
                >
                  <LocateIcon size={18} color={accent} />
                </button>
              ) : null}
              <div style={{ position: 'absolute', left: 10, right: 10, bottom: 8, display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#0f172a', opacity: 0.82 }}>
                <span>{places.length} locations · zoom {zoom}</span>
                <span>{providerStatus === 'loading' ? 'Syncing locations' : providerStatus === 'error' ? 'Places unavailable' : userPosition ? 'Location ready' : requestUserLocation ? 'Tap to locate' : 'Location fixed'}</span>
              </div>
            </div>
          ) : null}
          <div ref={cardsListRef} className="smx-locator-scroll" style={{ display: 'grid', gap: 4, overflowY: 'auto', minHeight: 0, paddingRight: 2, alignContent: 'start', scrollbarColor: `${scrollbarThumbColor} ${scrollbarTrackColor}`, scrollbarWidth: 'thin' as const, ['--map-scrollbar-thumb' as any]: scrollbarThumbColor, ['--map-scrollbar-track' as any]: scrollbarTrackColor }}>
            {places.map((place, index) => {
              return (
                <div key={`${place.name}-${index}-card`} onClick={() => setSelectedPlace(place)} style={{ borderRadius: 10, background: 'rgba(255,255,255,.78)', border: selectedPlace?.name === place.name && selectedPlace?.lat === place.lat && selectedPlace?.lng === place.lng ? `1px solid ${accent}` : `1px solid ${accent}22`, padding: '7px 8px', display: 'grid', gap: 3, cursor: 'pointer' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <strong style={{ fontSize: 11, lineHeight: 1.1 }}>{place.name}</strong>
                    <span style={{ fontSize: 8, borderRadius: 999, padding: '2px 5px', background: `${accent}22`, color: '#0f172a', whiteSpace: 'nowrap' }}>{place.badge || (place.openNow ? 'Open now' : 'Store')}</span>
                  </div>
                  <div style={{ fontSize: 9, opacity: 0.78, lineHeight: 1.15 }}>{place.address || `${place.lat.toFixed(3)}, ${place.lng.toFixed(3)}`}</div>
                  <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', fontSize: 9 }}>
                    {showOpenNow && place.openNow != null ? <span>{place.openNow ? 'Open now' : 'Closed'}</span> : null}
                    {showDistance && place.distanceKm != null ? <span>{place.distanceKm.toFixed(1)} km</span> : null}
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button type="button" onClick={(event) => { event.stopPropagation(); ctx.triggerWidgetAction('click'); if (ctx.previewMode) window.open(buildPlaceCtaUrl(place, 'waze'), '_blank'); }} style={{ display: 'inline-flex', flex: 1, alignItems: 'center', justifyContent: 'center', height: 30, borderRadius: 12, padding: '0 9px', color: '#fff', fontSize: 9, fontWeight: 800, textDecoration: 'none', border: 'none', background: '#08d4ff', cursor: 'pointer' }}>
                      Waze
                    </button>
                    <button type="button" onClick={(event) => { event.stopPropagation(); ctx.triggerWidgetAction('click'); if (ctx.previewMode) window.open(buildPlaceCtaUrl(place, 'maps'), '_blank'); }} style={{ display: 'inline-flex', flex: 1, alignItems: 'center', justifyContent: 'center', height: 30, borderRadius: 12, padding: '0 9px', color: '#fff', fontSize: 9, fontWeight: 800, textDecoration: 'none', border: 'none', background: '#4285f4', cursor: 'pointer' }}>
                      Maps
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
