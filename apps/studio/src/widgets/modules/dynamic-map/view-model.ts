import type { WidgetNode } from '../../../domain/document/types';
import { DYNAMIC_MAP_THEME_PALETTE } from './style-recipe';
import { haversineKm, parseNearbyPlaces, type NearbyPlace } from './places-loader';
import { resolveDynamicMapProps } from './schema';
import { resolveSkinFromStyle, resolveTokensFromSkin } from '../view-model';

export type PlaceWithDistance = NearbyPlace & { distanceKm?: number };

export type DynamicMapViewModel = {
  resolved: ReturnType<typeof resolveDynamicMapProps>;
  places: PlaceWithDistance[];
  nearestPlaces: PlaceWithDistance[];
  listedPlaces: PlaceWithDistance[];
  cardsOnly: boolean;
  mapFirst: boolean;
  searchBarMode: boolean;
  isVertical: boolean;
  stackedLayout: boolean;
  gridTemplateColumns: string;
  gridTemplateRows?: string;
  mapBackground: string;
  mapCenterLat: number;
  mapCenterLng: number;
  heroHeight: string;
  bottomHeight: string;
};

export function rankPlaces(
  places: NearbyPlace[],
  userPosition: { latitude: number; longitude: number } | null,
  sortByDistance: boolean,
): PlaceWithDistance[] {
  const next = places.map((place) => ({
    ...place,
    distanceKm: userPosition ? haversineKm(userPosition.latitude, userPosition.longitude, place.lat, place.lng) : undefined,
  }));
  if (!sortByDistance || !userPosition) return next;
  return [...next].sort((a, b) => (a.distanceKm ?? Number.MAX_SAFE_INTEGER) - (b.distanceKm ?? Number.MAX_SAFE_INTEGER));
}

export function buildDynamicMapViewModel(
  node: Pick<WidgetNode, 'name' | 'props' | 'frame' | 'style'>,
  providerPlaces: NearbyPlace[],
  userPosition: { latitude: number; longitude: number } | null,
): DynamicMapViewModel {
  const baseResolved = resolveDynamicMapProps(node);
  const tokens = resolveTokensFromSkin(resolveSkinFromStyle(node.style as Record<string, unknown>));
  const resolved = {
    ...baseResolved,
    bottomBackgroundColor: baseResolved.bottomBackgroundColor === '#ffffff' ? tokens.backgroundStrong : baseResolved.bottomBackgroundColor,
    searchBackgroundColor: baseResolved.searchBackgroundColor === 'rgba(255,255,255,0.7)' ? tokens.background : baseResolved.searchBackgroundColor,
    scrollbarThumbColor: baseResolved.scrollbarThumbColor === '#ffffff' ? tokens.accent : baseResolved.scrollbarThumbColor,
    scrollbarTrackColor: baseResolved.scrollbarTrackColor === 'rgba(255,255,255,0.18)' ? tokens.border : baseResolved.scrollbarTrackColor,
  };
  const parsed = parseNearbyPlaces(resolved.markersCsv);
  const source = providerPlaces.length ? providerPlaces : parsed;
  const fallback = source.length ? source : [{
    name: resolved.location,
    flag: '',
    lat: resolved.latitude,
    lng: resolved.longitude,
    address: '',
    badge: resolved.pinLabel,
    openNow: null,
    ctaLabel: resolved.defaultCtaLabel,
    ctaType: resolved.defaultCtaType,
    ctaUrl: '',
  }];
  const places = rankPlaces(fallback, userPosition, resolved.sortByDistance);

  const cardsOnly = resolved.renderMode === 'cards-only';
  const mapFirst = resolved.renderMode === 'map-first';
  const searchBarMode = resolved.renderMode === 'search-bar';
  const isVertical = node.frame.height > node.frame.width;
  const stackedLayout = !cardsOnly && isVertical;
  const mapShare = `${resolved.mapPaneRatio}fr`;
  const cardsShare = `${Math.max(1, 100 - resolved.mapPaneRatio)}fr`;
  const gridTemplateColumns = cardsOnly || stackedLayout
    ? '1fr'
    : mapFirst
      ? `${mapShare} ${cardsShare}`
      : `${cardsShare} ${mapShare}`;
  const gridTemplateRows = stackedLayout
    ? (mapFirst ? `${mapShare} ${cardsShare}` : `${cardsShare} ${mapShare}`)
    : undefined;

  const mapBackground = resolved.mode === 'dark'
    ? DYNAMIC_MAP_THEME_PALETTE.darkGradient
    : resolved.mode === 'satellite'
      ? DYNAMIC_MAP_THEME_PALETTE.satelliteGradient
      : DYNAMIC_MAP_THEME_PALETTE.lightGradient;

  return {
    resolved,
    places,
    nearestPlaces: places.slice(0, 3),
    listedPlaces: places,
    cardsOnly,
    mapFirst,
    searchBarMode,
    isVertical,
    stackedLayout,
    gridTemplateColumns,
    gridTemplateRows,
    mapBackground,
    mapCenterLat: userPosition?.latitude ?? resolved.latitude,
    mapCenterLng: userPosition?.longitude ?? resolved.longitude,
    heroHeight: isVertical ? '46%' : '60%',
    bottomHeight: isVertical ? '54%' : '40%',
  };
}
