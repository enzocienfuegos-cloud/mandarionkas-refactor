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
  const liveEmbed = ctx.previewMode && provider === 'osm-embed';
  const embedSrc = `https://www.openstreetmap.org/export/embed.html?bbox=${longitude - 0.03}%2C${latitude - 0.02}%2C${longitude + 0.03}%2C${latitude + 0.02}&layer=mapnik&marker=${latitude}%2C${longitude}`;
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
          <div style={{ display: 'grid', gap: 8, overflow: 'hidden' }}>
            {places.slice(0, 3).map((place, index) => {
              const ctaType = place.ctaType || defaultCtaType;
              const ctaLabel = place.ctaLabel || defaultCtaLabel;
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
                  <button type="button" onClick={(event) => { event.stopPropagation(); ctx.triggerWidgetAction('click'); if (ctx.previewMode) window.open(buildPlaceCtaUrl(place, ctaType), '_blank'); }} style={{ border: 'none', borderRadius: 10, background: accent, color: '#111827', fontWeight: 800, padding: '8px 10px', cursor: 'pointer' }}>
                    {ctaLabel}
                  </button>
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
