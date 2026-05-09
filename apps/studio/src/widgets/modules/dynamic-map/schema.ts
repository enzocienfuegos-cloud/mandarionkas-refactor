import type { WidgetNode } from '../../../domain/document/types';
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
  type LocationCtaType,
  type NearbyPlacesFetchPolicy,
  type NearbyPlacesProvider,
} from './places-loader';

export type DynamicMapPanelState = 'default' | 'locating' | 'located';

export type DynamicMapResolvedProps = {
  latitude: number;
  longitude: number;
  zoom: number;
  provider: NearbyPlacesProvider;
  mode: string;
  renderMode: string;
  mapPaneRatio: number;
  requestUserLocation: boolean;
  sortByDistance: boolean;
  showOpenNow: boolean;
  showDistance: boolean;
  defaultCtaType: LocationCtaType;
  defaultCtaLabel: string;
  providerApiKey: string;
  providerPlaceQuery: string;
  fetchPolicy: NearbyPlacesFetchPolicy;
  cacheTtlMs: number;
  providerResultLimit: number;
  radiusKm: number;
  cardsAutoscroll: boolean;
  cardsAutoscrollIntervalMs: number;
  scrollbarThumbColor: string;
  scrollbarTrackColor: string;
  headlineText: string;
  subheadlineText: string;
  infoLabelText: string;
  brandText: string;
  primaryAddressText: string;
  primaryHoursText: string;
  directionsCtaLabel: string;
  locateMeLabel: string;
  nearbyTitleText: string;
  locatingText: string;
  locationFoundText: string;
  heroImage: string;
  logoImage: string;
  bottomBackgroundColor: string;
  searchBackgroundColor: string;
  heroOverlayOpacity: number;
  title: string;
  location: string;
  pinLabel: string;
  markersCsv: string;
};

export function resolveDynamicMapProps(node: Pick<WidgetNode, 'name' | 'props'>): DynamicMapResolvedProps {
  return {
    title: String(node.props.title ?? node.name),
    location: String(node.props.location ?? 'Main location'),
    pinLabel: String(node.props.pinLabel ?? 'Store'),
    markersCsv: String(node.props.markersCsv ?? ''),
    latitude: Number(node.props.latitude ?? DYNAMIC_MAP_DEFAULT_LATITUDE),
    longitude: Number(node.props.longitude ?? DYNAMIC_MAP_DEFAULT_LONGITUDE),
    zoom: Number(node.props.zoom ?? DYNAMIC_MAP_DEFAULT_ZOOM),
    provider: String(node.props.provider ?? DYNAMIC_MAP_DEFAULT_PROVIDER) as NearbyPlacesProvider,
    mode: String(node.props.mode ?? 'street'),
    renderMode: String(node.props.renderMode ?? DYNAMIC_MAP_DEFAULT_RENDER_MODE),
    mapPaneRatio: Math.max(35, Math.min(85, Number(node.props.mapPaneRatio ?? 72))),
    requestUserLocation: Boolean(node.props.requestUserLocation ?? false),
    sortByDistance: Boolean(node.props.sortByDistance ?? true),
    showOpenNow: Boolean(node.props.showOpenNow ?? true),
    showDistance: Boolean(node.props.showDistance ?? true),
    defaultCtaType: String(node.props.ctaType ?? DYNAMIC_MAP_DEFAULT_CTA_TYPE) as LocationCtaType,
    defaultCtaLabel: String(node.props.ctaLabel ?? DYNAMIC_MAP_DEFAULT_CTA_LABEL),
    providerApiKey: String(node.props.providerApiKey ?? ''),
    providerPlaceQuery: String(node.props.providerPlaceQuery ?? ''),
    fetchPolicy: String(node.props.fetchPolicy ?? DYNAMIC_MAP_DEFAULT_FETCH_POLICY) as NearbyPlacesFetchPolicy,
    cacheTtlMs: Math.max(1000, Number(node.props.cacheTtlMs ?? DYNAMIC_MAP_DEFAULT_CACHE_TTL_MS)),
    providerResultLimit: Math.max(1, Math.min(10, Number(node.props.providerResultLimit ?? DYNAMIC_MAP_DEFAULT_RESULT_LIMIT))),
    radiusKm: Math.max(1, Number(node.props.radiusKm ?? DYNAMIC_MAP_DEFAULT_RADIUS_KM)),
    cardsAutoscroll: Boolean(node.props.cardsAutoscroll ?? false),
    cardsAutoscrollIntervalMs: Math.max(800, Number(node.props.cardsAutoscrollIntervalMs ?? 2200)),
    scrollbarThumbColor: String(node.props.scrollbarThumbColor ?? DYNAMIC_MAP_DEFAULT_SCROLLBAR_THUMB),
    scrollbarTrackColor: String(node.props.scrollbarTrackColor ?? DYNAMIC_MAP_DEFAULT_SCROLLBAR_TRACK),
    headlineText: String(node.props.headlineText ?? 'Estamos cerca de ti'),
    subheadlineText: String(node.props.subheadlineText ?? 'Visitanos hoy'),
    infoLabelText: String(node.props.infoLabelText ?? 'Encuentranos aqui'),
    brandText: String(node.props.brandText ?? 'Mi marca'),
    primaryAddressText: String(node.props.primaryAddressText ?? '123 Calle Principal'),
    primaryHoursText: String(node.props.primaryHoursText ?? 'Lun-Vie 8am-6pm'),
    directionsCtaLabel: String(node.props.directionsCtaLabel ?? 'Como llegar?'),
    locateMeLabel: String(node.props.locateMeLabel ?? 'Mi ubicacion'),
    nearbyTitleText: String(node.props.nearbyTitleText ?? 'Las 3 ubicaciones mas cercanas'),
    locatingText: String(node.props.locatingText ?? 'Buscando cerca de ti'),
    locationFoundText: String(node.props.locationFoundText ?? 'Ubicacion encontrada'),
    heroImage: String(node.props.heroImage ?? ''),
    logoImage: String(node.props.logoImage ?? ''),
    bottomBackgroundColor: String(node.props.bottomBackgroundColor ?? '#ffffff'),
    searchBackgroundColor: String(node.props.searchBackgroundColor ?? 'rgba(255,255,255,0.7)'),
    heroOverlayOpacity: Math.max(0, Math.min(1, Number(node.props.heroOverlayOpacity ?? 0.45))),
  };
}
