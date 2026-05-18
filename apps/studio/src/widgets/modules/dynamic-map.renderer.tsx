// render-tokenized: brand/theme split enforced by lint-color-literals.mjs
import { useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import 'leaflet/dist/leaflet.css';
import type { WidgetNode } from '../../domain/document/types';
import type { RenderContext } from '../../canvas/stage/render-context';
import { getAccent, renderCollapsedIfNeeded } from './shared-styles';
import {
  DYNAMIC_MAP_TILE_URL,
  buildDynamicMapShellStyle,
  dynamicMapPalette,
  buildDynamicMapPopupHtml,
  bindAutoScroll,
  buildDynamicMapViewModel,
  loadNearbyPlacesSnapshot,
  type NearbyPlace,
  useDynamicMapGeolocation,
} from './dynamic-map';
import { DynamicMapSearchBarStage, DynamicMapStandardStage } from './dynamic-map/stage';
import { createModuleViewModel } from './view-model';

type LeafletRuntime = {
  map: any;
  markers: any[];
};

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
      color: config.accent,
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
    marker.bindPopup(buildDynamicMapPopupHtml(place, config.accent), { closeButton: true, autoPan: true });
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
  const previewMode = ctx.previewMode;
  const hovered = ctx.hovered;
  const active = ctx.active;
  const [providerPlaces, setProviderPlaces] = useState<NearbyPlace[]>([]);
  const [providerStatus, setProviderStatus] = useState<'idle' | 'loading' | 'live' | 'error'>('idle');
  const [selectedPlace, setSelectedPlace] = useState<NearbyPlace | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const mapCanvasRef = useRef<HTMLDivElement | null>(null);
  const panelMapCanvasRef = useRef<HTMLDivElement | null>(null);
  const cardsListRef = useRef<HTMLDivElement | null>(null);
  const searchListScrollRef = useRef<HTMLDivElement | null>(null);
  const mapRuntimeRef = useRef<LeafletRuntime | null>(null);
  const panelMapRuntimeRef = useRef<LeafletRuntime | null>(null);

  const geolocation = useDynamicMapGeolocation({
    previewMode,
    autoRequest: Boolean(node.props.requestUserLocation ?? false),
  });
  const skinVm = useMemo(
    () => createModuleViewModel({
      type: node.type,
      props: {},
      style: node.style as Record<string, unknown>,
      surface: 'stage',
    }, () => ({})),
    [node.type, node.style],
  );
  const shellStyle = useMemo(
    () => buildDynamicMapShellStyle(node, ctx, skinVm.cssVars as CSSProperties),
    [active, hovered, node, previewMode, skinVm.cssVars],
  );

  const viewModel = useMemo(
    () => buildDynamicMapViewModel(node, providerPlaces, geolocation.userPosition),
    [node, providerPlaces, geolocation.userPosition],
  );
  const { resolved, places, listedPlaces } = viewModel;

  useEffect(() => {
    if (resolved.provider !== 'google-places' || !resolved.providerApiKey.trim() || !resolved.providerPlaceQuery.trim()) {
      setProviderPlaces([]);
      setProviderStatus('idle');
      return;
    }
    let cancelled = false;
    setProviderStatus('loading');
    void loadNearbyPlacesSnapshot({
      provider: 'google-places',
      apiKey: resolved.providerApiKey,
      query: resolved.providerPlaceQuery,
      latitude: resolved.latitude,
      longitude: resolved.longitude,
      radiusKm: resolved.radiusKm,
      resultLimit: resolved.providerResultLimit,
      fetchPolicy: resolved.fetchPolicy,
      cacheTtlMs: resolved.cacheTtlMs,
      defaultCtaType: resolved.defaultCtaType,
      defaultCtaLabel: resolved.defaultCtaLabel,
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
  }, [
    resolved.provider,
    resolved.providerApiKey,
    resolved.providerPlaceQuery,
    resolved.latitude,
    resolved.longitude,
    resolved.radiusKm,
    resolved.providerResultLimit,
    resolved.fetchPolicy,
    resolved.cacheTtlMs,
    resolved.defaultCtaType,
    resolved.defaultCtaLabel,
  ]);

  useEffect(() => {
    setSelectedPlace((current) => (
      current && places.some((place) => place.name === current.name && place.lat === current.lat && place.lng === current.lng)
        ? current
        : (places[0] ?? null)
    ));
  }, [places]);

  useEffect(() => {
    if (!mapCanvasRef.current || viewModel.cardsOnly) return;
    void mountLeafletMap(mapCanvasRef.current, mapRuntimeRef, {
      latitude: viewModel.mapCenterLat,
      longitude: viewModel.mapCenterLng,
      zoom: resolved.zoom,
      accent,
      places,
      selectedPlace,
      userPosition: geolocation.userPosition,
      userLocationLabel: resolved.locateMeLabel,
    });
  }, [accent, geolocation.userPosition, places, resolved.locateMeLabel, resolved.zoom, selectedPlace, viewModel.cardsOnly, viewModel.mapCenterLat, viewModel.mapCenterLng]);

  useEffect(() => {
    if (!panelOpen || !panelMapCanvasRef.current || viewModel.cardsOnly) return;
    void mountLeafletMap(panelMapCanvasRef.current, panelMapRuntimeRef, {
      latitude: viewModel.mapCenterLat,
      longitude: viewModel.mapCenterLng,
      zoom: resolved.zoom,
      accent,
      places,
      selectedPlace,
      userPosition: geolocation.userPosition,
      userLocationLabel: resolved.locateMeLabel,
    });
  }, [accent, geolocation.userPosition, panelOpen, places, resolved.locateMeLabel, resolved.zoom, selectedPlace, viewModel.cardsOnly, viewModel.mapCenterLat, viewModel.mapCenterLng]);

  useEffect(() => bindAutoScroll(cardsListRef.current, resolved.cardsAutoscroll, resolved.cardsAutoscrollIntervalMs), [resolved.cardsAutoscroll, resolved.cardsAutoscrollIntervalMs, places.length, resolved.renderMode]);
  useEffect(() => bindAutoScroll(searchListScrollRef.current, resolved.cardsAutoscroll, resolved.cardsAutoscrollIntervalMs), [listedPlaces.length, panelOpen, resolved.cardsAutoscroll, resolved.cardsAutoscrollIntervalMs, resolved.renderMode]);

  function openPrimaryCta(): void {
    setPanelOpen(true);
    ctx.triggerWidgetAction('click');
  }

  if (viewModel.searchBarMode) {
    return (
      <DynamicMapSearchBarStage
        node={node}
        ctx={ctx}
        shellStyle={shellStyle}
        accent={accent}
        viewModel={viewModel}
        panelOpen={panelOpen}
        onOpenPanel={openPrimaryCta}
        onClosePanel={() => setPanelOpen(false)}
        onSelectPlace={setSelectedPlace}
        requestUserPosition={geolocation.requestUserPosition}
        panelState={geolocation.panelState}
        panelMapCanvasRef={panelMapCanvasRef}
        searchListScrollRef={searchListScrollRef}
        selectedPlace={selectedPlace}
      />
    );
  }

  return (
    <DynamicMapStandardStage
      node={node}
      ctx={ctx}
      shellStyle={shellStyle}
      accent={accent}
      viewModel={viewModel}
      providerStatus={providerStatus}
      userPosition={geolocation.userPosition}
      onSelectPlace={setSelectedPlace}
      requestUserPosition={geolocation.requestUserPosition}
      mapCanvasRef={mapCanvasRef}
      cardsListRef={cardsListRef}
      selectedPlace={selectedPlace}
    />
  );
}

export function renderDynamicMapStage(node: WidgetNode, ctx: RenderContext): JSX.Element {
  const collapsed = renderCollapsedIfNeeded(node, ctx);
  if (collapsed) return collapsed;
  return <DynamicMapModuleRenderer node={node} ctx={ctx} />;
}
