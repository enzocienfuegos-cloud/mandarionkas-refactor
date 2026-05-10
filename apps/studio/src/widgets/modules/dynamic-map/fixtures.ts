import type { WidgetNode } from '../../../domain/document/types';
import type { NearbyPlace } from './places-loader';

export const dynamicMapFixturePlaces: NearbyPlace[] = [
  {
    name: 'San Salvador',
    flag: 'SV',
    lat: 13.6929,
    lng: -89.2182,
    address: 'Centro Comercial',
    badge: 'Open now',
    openNow: true,
    ctaLabel: 'Open in Maps',
    ctaType: 'maps',
    ctaUrl: '',
  },
  {
    name: 'Santa Tecla',
    flag: 'SV',
    lat: 13.6769,
    lng: -89.2797,
    address: 'Plaza Merliot',
    badge: 'Drive-thru',
    openNow: false,
    ctaLabel: 'Open in Waze',
    ctaType: 'waze',
    ctaUrl: '',
  },
];

export function createDynamicMapFixtureWidget(patch?: Partial<WidgetNode>): WidgetNode {
  const baseFrame = { x: 100, y: 70, width: 320, height: 180, rotation: 0 };
  const baseProps = {
    title: 'Nearby Locations',
    location: 'San Salvador',
    pinLabel: 'Store',
    latitude: 13.6929,
    longitude: -89.2182,
    zoom: 13,
    provider: 'manual',
    renderMode: 'cards-map',
    mapPaneRatio: 72,
    requestUserLocation: false,
    sortByDistance: true,
    showOpenNow: true,
    showDistance: true,
    ctaType: 'maps',
    ctaLabel: 'Open in Maps',
    providerApiKey: '',
    providerPlaceQuery: '',
    fetchPolicy: 'network-first',
    cacheTtlMs: 300000,
    providerResultLimit: 5,
    radiusKm: 5,
    cardsAutoscroll: false,
    cardsAutoscrollIntervalMs: 2200,
    scrollbarThumbColor: '#ffffff',
    scrollbarTrackColor: 'rgba(255,255,255,0.18)',
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
    markersCsv: 'name,flag,lat,lng,address,badge,openNow,ctaLabel,ctaType,ctaUrl\nSan Salvador,SV,13.6929,-89.2182,Centro Comercial,Open now,true,Open in Maps,maps,\nSanta Tecla,SV,13.6769,-89.2797,Plaza Merliot,Drive-thru,false,Open in Waze,waze,',
  };
  const baseStyle = { backgroundColor: '#dbeafe', accentColor: '#ef4444', color: '#0f172a', modulePreset: 'commerce' };
  const baseWidget: WidgetNode = {
    id: 'dynamic_map_fixture',
    type: 'dynamic-map',
    name: 'Dynamic Map',
    sceneId: 'scene_1',
    zIndex: 1,
    frame: baseFrame,
    props: baseProps,
    style: baseStyle,
    timeline: { startMs: 0, endMs: 15000 },
  };

  return {
    ...baseWidget,
    ...patch,
    frame: { ...baseFrame, ...(patch?.frame ?? {}) },
    props: { ...baseProps, ...(patch?.props ?? {}) },
    style: { ...baseStyle, ...(patch?.style ?? {}) },
  };
}
