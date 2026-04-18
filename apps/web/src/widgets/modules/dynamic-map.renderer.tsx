import { useEffect, useMemo, useState } from 'react';
import type { WidgetNode } from '../../domain/document/types';
import type { RenderContext } from '../../canvas/stage/render-context';
import { getAccent, getFlagEmoji, moduleBody, moduleHeader, moduleShell, renderCollapsedIfNeeded } from './shared-styles';
import { buildPlaceCtaUrl, haversineKm, loadNearbyPlacesSnapshot, parseNearbyPlaces, type NearbyPlace } from './dynamic-map.shared';

type PlaceWithDistance = NearbyPlace & { distanceKm?: number };

function rankPlaces(places: NearbyPlace[], userPosition: { latitude: number; longitude: number } | null, sortByDistance: boolean): PlaceWithDistance[] {
  const next = places.map((place) => ({
    ...place,
    distanceKm: userPosition ? haversineKm(userPosition.latitude, userPosition.longitude, place.lat, place.lng) : undefined,
  }));
  if (!sortByDistance || !userPosition) return next;
  return [...next].sort((a, b) => (a.distanceKm ?? Number.MAX_SAFE_INTEGER) - (b.distanceKm ?? Number.MAX_SAFE_INTEGER));
}

function DynamicMapModuleRenderer({ node, ctx }: { node: WidgetNode; ctx: RenderContext }): JSX.Element {
  const accent = getAccent(node);
  const latitude = Number(node.props.latitude ?? 13.6929);
  const longitude = Number(node.props.longitude ?? -89.2182);
  const zoom = Number(node.props.zoom ?? 13);
  const provider = String(node.props.provider ?? 'manual');
  const mode = String(node.props.mode ?? 'street');
  const routeVisible = Boolean(node.props.showRoute ?? false);
  const renderMode = String(node.props.renderMode ?? 'cards-map');
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
    }, { enableHighAccuracy: false, timeout: 4000, maximumAge: 300000 });
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
  const mapCenterLat = userPosition?.latitude ?? latitude;
  const mapCenterLng = userPosition?.longitude ?? longitude;
  const liveEmbed = ctx.previewMode && !cardsOnly;
  const embedSrc = `https://www.openstreetmap.org/export/embed.html?bbox=${mapCenterLng - 0.03}%2C${mapCenterLat - 0.02}%2C${mapCenterLng + 0.03}%2C${mapCenterLat + 0.02}&layer=mapnik&marker=${mapCenterLat}%2C${mapCenterLng}`;
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
    }, { enableHighAccuracy: false, timeout: 4000, maximumAge: 300000 });
  };

  if (searchBarMode) {
    return (
      <div style={{ ...moduleShell(node, ctx), position: 'relative' }}>
        <div style={{ position: 'absolute', inset: 0, background: '#000' }}>
          <div style={{ position: 'absolute', inset: 0, height: '60%', overflow: 'hidden', background: heroImage ? '#111827' : 'linear-gradient(160deg,#0f172a,#1d4ed8)' }}>
            {heroImage ? <img src={heroImage} alt={headlineText} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} /> : null}
            <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(to bottom, rgba(0,0,0,.18), rgba(0,0,0,${heroOverlayOpacity}))` }} />
            {logoImage ? <img src={logoImage} alt={brandText} style={{ position: 'absolute', top: 12, left: 12, height: 28, maxWidth: 110, objectFit: 'contain' }} /> : null}
            <div style={{ position: 'absolute', left: 16, right: 16, bottom: 16, color: '#fff' }}>
              <div style={{ fontSize: 24, fontWeight: 900, lineHeight: 1.05, textTransform: 'uppercase' }}>{headlineText}</div>
              <div style={{ fontSize: 12, marginTop: 6, opacity: 0.92 }}>{subheadlineText}</div>
            </div>
          </div>
          <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: '40%', background: bottomBackgroundColor, color: '#111827', padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
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
                    {liveEmbed ? (
                      <iframe title="search map preview" src={embedSrc} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 'none' }} />
                    ) : (
                      <>
                        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 20% 20%, rgba(255,255,255,.55), transparent 32%), radial-gradient(circle at 74% 32%, rgba(255,255,255,.2), transparent 24%), linear-gradient(135deg, transparent 0%, rgba(255,255,255,.12) 100%)' }} />
                        {nearestPlaces.map((place, index) => (
                          <div key={`${place.name}-${index}-search`} style={{ position: 'absolute', left: `${20 + index * 22}%`, top: `${28 + (index % 2) * 20}%`, transform: 'translate(-50%,-100%)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                            <div style={{ minWidth: 30, maxWidth: 120, padding: '4px 6px', borderRadius: 999, background: 'rgba(15,23,42,.82)', color: '#fff', fontSize: 10, textAlign: 'center', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{place.name}</div>
                            <div style={{ width: 18, height: 18, borderRadius: '50%', background: accent, border: '2px solid rgba(255,255,255,.88)', boxShadow: `0 0 0 6px ${accent}22` }} />
                          </div>
                        ))}
                      </>
                    )}
                  </>
                ) : null}
                <button type="button" onClick={(event) => { event.stopPropagation(); requestUserPosition(); }} style={{ position: 'absolute', right: 10, top: 10, width: 40, height: 40, borderRadius: '50%', border: 'none', background: '#fff', color: accent, boxShadow: '0 3px 14px rgba(0,0,0,.2)', fontSize: 16, fontWeight: 900, cursor: 'pointer' }}>{locateMeLabel.slice(0, 1) || '◎'}</button>
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
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1, minHeight: 0, overflowY: 'auto', paddingRight: 2 }}>
                  <div style={{ fontSize: 11, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '.5px', color: '#555' }}>{nearbyTitleText}</div>
                  {listedPlaces.map((place, index) => (
                    <div key={`${place.name}-${index}-nearest`} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '8px 10px', border: '1px solid rgba(0,0,0,.08)', borderRadius: 12, background: '#fff' }}>
                      <div style={{ width: 20, height: 20, borderRadius: '50%', background: `${accent}22`, color: accent, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 900, flex: '0 0 20px' }}>{index + 1}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 800, lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{place.name}</div>
                        <div style={{ fontSize: 10, color: '#666', lineHeight: 1.2, marginTop: 2, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          <span>{place.address || primaryHoursText}</span>
                          {place.badge ? <span style={{ display: 'inline-flex', alignItems: 'center', padding: '2px 6px', borderRadius: 999, fontSize: 9, fontWeight: 800, color: '#fff', background: accent }}>{place.badge}</span> : null}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button type="button" onClick={(event) => { event.stopPropagation(); window.open(buildPlaceCtaUrl(place, 'waze'), '_blank'); }} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: 46, height: 28, borderRadius: 999, padding: '0 10px', color: '#fff', fontSize: 10, fontWeight: 800, textDecoration: 'none', border: 'none', background: '#08d4ff', cursor: 'pointer' }}>Waze</button>
                        <button type="button" onClick={(event) => { event.stopPropagation(); window.open(buildPlaceCtaUrl(place, 'maps'), '_blank'); }} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: 46, height: 28, borderRadius: 999, padding: '0 10px', color: '#fff', fontSize: 10, fontWeight: 800, textDecoration: 'none', border: 'none', background: '#4285f4', cursor: 'pointer' }}>Maps</button>
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
      <div style={{ ...moduleHeader(node), display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span>{String(node.props.title ?? node.name)}</span>
        <span style={{ fontSize: 10, opacity: 0.78 }}>{provider}</span>
      </div>
      <div style={moduleBody}>
        <div style={{ display: 'grid', gap: 10, gridTemplateColumns: cardsOnly ? '1fr' : mapFirst ? '1.1fr .9fr' : '0.9fr 1.1fr', flex: 1, minHeight: 0 }}>
          {!cardsOnly ? (
            <div style={{ position: 'relative', borderRadius: 12, overflow: 'hidden', minHeight: 110, background: mapBackground }}>
              {liveEmbed ? <iframe title="map preview" src={embedSrc} style={{ width: '100%', height: '100%', border: 'none' }} /> : (
                <>
                  <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 20% 20%, rgba(255,255,255,.55), transparent 32%), radial-gradient(circle at 74% 32%, rgba(255,255,255,.2), transparent 24%), linear-gradient(135deg, transparent 0%, rgba(255,255,255,.12) 100%)' }} />
                  {routeVisible ? <svg viewBox="0 0 100 60" style={{ position: 'absolute', inset: '12% 10%', width: '80%', height: '76%' }}><path d="M8 50 C 24 18, 56 16, 88 42" fill="none" stroke={accent} strokeWidth="3" strokeDasharray="7 6" strokeLinecap="round" /></svg> : null}
                  {places.slice(0, 5).map((place, index) => (
                    <div key={`${place.name}-${index}`} style={{ position: 'absolute', left: `${18 + index * 16}%`, top: `${24 + (index % 2) * 20}%`, transform: 'translate(-50%,-100%)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                      <div style={{ minWidth: 30, maxWidth: 96, padding: '4px 6px', borderRadius: 999, background: 'rgba(15,23,42,.82)', color: '#fff', fontSize: 10, textAlign: 'center', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {place.flag ? `${getFlagEmoji(place.flag)} ` : ''}{place.name}
                      </div>
                      <div style={{ width: 18, height: 18, borderRadius: '50%', background: accent, border: '2px solid rgba(255,255,255,.88)', boxShadow: `0 0 0 6px ${accent}22` }} />
                    </div>
                  ))}
                </>
              )}
              <div style={{ position: 'absolute', left: 10, right: 10, bottom: 8, display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#0f172a', opacity: 0.82 }}>
                <span>{places.length} locations · zoom {zoom}</span>
                <span>{provider === 'google-places' ? (providerStatus === 'live' ? 'Places live' : providerStatus === 'loading' ? 'Loading places' : providerStatus === 'error' ? 'Places unavailable' : 'Places idle') : requestUserLocation ? 'User location on' : 'Location fixed'}</span>
              </div>
            </div>
          ) : null}
          <div style={{ display: 'grid', gap: 8, overflowY: 'auto', minHeight: 0, paddingRight: 2 }}>
            {places.map((place, index) => {
              return (
                <div key={`${place.name}-${index}-card`} style={{ borderRadius: 12, background: 'rgba(255,255,255,.78)', border: `1px solid ${accent}22`, padding: 10, display: 'grid', gap: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <strong style={{ fontSize: 13 }}>{place.name}</strong>
                    <span style={{ fontSize: 10, borderRadius: 999, padding: '4px 6px', background: `${accent}22`, color: '#0f172a' }}>{place.badge || (place.openNow ? 'Open now' : 'Store')}</span>
                  </div>
                  <div style={{ fontSize: 11, opacity: 0.78 }}>{place.address || `${place.lat.toFixed(3)}, ${place.lng.toFixed(3)}`}</div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', fontSize: 11 }}>
                    {showOpenNow && place.openNow != null ? <span>{place.openNow ? 'Open now' : 'Closed'}</span> : null}
                    {showDistance && place.distanceKm != null ? <span>{place.distanceKm.toFixed(1)} km</span> : null}
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <button type="button" onClick={(event) => { event.stopPropagation(); ctx.triggerWidgetAction('click'); if (ctx.previewMode) window.open(buildPlaceCtaUrl(place, 'waze'), '_blank'); }} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: 46, height: 32, borderRadius: 999, padding: '0 12px', color: '#fff', fontSize: 10, fontWeight: 800, textDecoration: 'none', border: 'none', background: '#08d4ff', cursor: 'pointer' }}>
                      Waze
                    </button>
                    <button type="button" onClick={(event) => { event.stopPropagation(); ctx.triggerWidgetAction('click'); if (ctx.previewMode) window.open(buildPlaceCtaUrl(place, 'maps'), '_blank'); }} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: 46, height: 32, borderRadius: 999, padding: '0 12px', color: '#fff', fontSize: 10, fontWeight: 800, textDecoration: 'none', border: 'none', background: '#4285f4', cursor: 'pointer' }}>
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
