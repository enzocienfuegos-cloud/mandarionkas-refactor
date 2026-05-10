import { createModuleDefinition } from '../module-definition-factory';
import type { ComponentType } from 'react';
import type { WidgetNode } from '../../../domain/document/types';
import { renderDynamicMapExport } from '../dynamic-map.export';
import {
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
} from '../dynamic-map.shared';
import { MapThumb } from '../../registry/widget-thumbnails';
import { createLazyInspectorRenderer, createLazyStageRenderer } from '../../registry/lazy-widget-runtime';

const renderDynamicMapStage = createLazyStageRenderer(
  'Dynamic Map',
  () => import('../dynamic-map.renderer').then((mod) => ({
    default: ({ node, ctx }) => mod.renderDynamicMapStage(node, ctx),
  })),
);

const renderDynamicMapInspector = createLazyInspectorRenderer(
  'Dynamic Map',
  (): Promise<{ default: ComponentType<{ widget: WidgetNode }> }> => import('../dynamic-map.inspector').then((mod) => ({
    default: mod.DynamicMapInspector,
  })),
  (widget) => ({ widget }),
);

export const DynamicMapDefinition = createModuleDefinition({
  type: 'dynamic-map',
  label: 'Dynamic Map',
  category: 'interactive',
  thumbnail: MapThumb,
  frame: { x: 100, y: 70, width: 320, height: 180, rotation: 0 },
  props: {
    title: 'Nearby Locations',
    location: 'San Salvador',
    radiusKm: DYNAMIC_MAP_DEFAULT_RADIUS_KM,
    pinLabel: 'Store',
    latitude: DYNAMIC_MAP_DEFAULT_LATITUDE,
    longitude: DYNAMIC_MAP_DEFAULT_LONGITUDE,
    zoom: DYNAMIC_MAP_DEFAULT_ZOOM,
    provider: DYNAMIC_MAP_DEFAULT_PROVIDER,
    renderMode: DYNAMIC_MAP_DEFAULT_RENDER_MODE,
    mapPaneRatio: 72,
    requestUserLocation: false,
    sortByDistance: true,
    showOpenNow: true,
    showDistance: true,
    cardsAutoscroll: false,
    cardsAutoscrollIntervalMs: 2200,
    scrollbarThumbColor: DYNAMIC_MAP_DEFAULT_SCROLLBAR_THUMB,
    scrollbarTrackColor: DYNAMIC_MAP_DEFAULT_SCROLLBAR_TRACK,
    ctaType: DYNAMIC_MAP_DEFAULT_CTA_TYPE,
    ctaLabel: DYNAMIC_MAP_DEFAULT_CTA_LABEL,
    providerApiKey: '',
    markersCsv: 'name,flag,lat,lng,address,badge,openNow,ctaLabel,ctaType,ctaUrl\nSan Salvador,SV,13.6929,-89.2182,Centro Comercial,Open now,true,Open in Maps,maps,\nSanta Tecla,SV,13.6769,-89.2797,Plaza Merliot,Drive-thru,false,Open in Waze,waze,',
    providerPlaceQuery: '',
    providerResultLimit: DYNAMIC_MAP_DEFAULT_RESULT_LIMIT,
    fetchPolicy: DYNAMIC_MAP_DEFAULT_FETCH_POLICY,
    cacheTtlMs: DYNAMIC_MAP_DEFAULT_CACHE_TTL_MS,
    heroImage: '',
    logoImage: '',
    headlineText: 'Estamos cerca de ti',
    subheadlineText: 'Visitanos hoy',
    infoLabelText: 'Encuentranos aqui',
    brandText: 'Mi marca',
    primaryAddressText: '123 Calle Principal',
    primaryHoursText: 'Lun-Vie 8am-6pm',
    directionsCtaLabel: 'Como llegar?',
    locateMeLabel: 'Mi ubicacion',
    nearbyTitleText: 'Las 3 ubicaciones mas cercanas',
    locatingText: 'Buscando cerca de ti',
    locationFoundText: 'Ubicacion encontrada',
    bottomBackgroundColor: '#ffffff',
    searchBackgroundColor: 'rgba(255,255,255,0.7)',
    heroOverlayOpacity: 0.45,
  },
  style: {
    backgroundColor: '#dbeafe',
    accentColor: '#ef4444',
    color: '#0f172a',
    modulePreset: 'commerce',
  },
  capabilities: {
    performsNetworkIo: true,
    worksOffline: false,
    requiresMraidHost: true,
  },
  renderStage: renderDynamicMapStage,
  renderInspector: renderDynamicMapInspector,
  renderExport: (node) => renderDynamicMapExport(node),
});
