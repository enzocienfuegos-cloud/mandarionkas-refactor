export type LocationCtaType = 'maps' | 'waze' | 'call' | 'site' | 'custom';
export type NearbyPlacesProvider = 'manual' | 'osm-embed' | 'google-places';
export type NearbyPlacesFetchPolicy = 'cache-first' | 'network-first' | 'cache-only';

export const DYNAMIC_MAP_TILE_URL = import.meta.env.VITE_CARTO_TILE_URL || 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';
export const DYNAMIC_MAP_DEFAULT_PROVIDER: NearbyPlacesProvider = 'manual';
export const DYNAMIC_MAP_DEFAULT_RENDER_MODE = 'cards-map';
export const DYNAMIC_MAP_DEFAULT_CTA_TYPE: LocationCtaType = 'maps';
export const DYNAMIC_MAP_DEFAULT_CTA_LABEL = 'Open in Maps';
export const DYNAMIC_MAP_DEFAULT_FETCH_POLICY: NearbyPlacesFetchPolicy = 'network-first';
export const DYNAMIC_MAP_DEFAULT_CACHE_TTL_MS = 300000;
export const DYNAMIC_MAP_DEFAULT_RESULT_LIMIT = 5;
export const DYNAMIC_MAP_DEFAULT_RADIUS_KM = 5;
export const DYNAMIC_MAP_DEFAULT_ZOOM = 13;
export const DYNAMIC_MAP_DEFAULT_LATITUDE = 13.6929;
export const DYNAMIC_MAP_DEFAULT_LONGITUDE = -89.2182;
export const DYNAMIC_MAP_DEFAULT_SCROLLBAR_THUMB = '#ffffff';
export const DYNAMIC_MAP_DEFAULT_SCROLLBAR_TRACK = 'rgba(255,255,255,0.18)';
export const DYNAMIC_MAP_BRAND_PALETTE = {
  wazeBlue: '#08d4ff',
  mapsBlue: '#4285f4',
} as const;
export const DYNAMIC_MAP_ACTION_LABELS = {
  waze: 'Waze',
  maps: 'Maps',
} as const;
export const DYNAMIC_MAP_THEME_PALETTE = {
  black: 'var(--neutral-black)',
  white: 'var(--surface-card-light)',
  ink: 'var(--ink-strong)',
  ink900: 'var(--neutral-slate-900)',
  slate900: 'var(--neutral-slate-900)',
  blue600: 'hsl(217 91% 60%)',
  muted: 'hsl(0 0% 33%)',
  mutedSecondary: 'hsl(0 0% 40%)',
  borderSoft: 'var(--border-card-soft)',
  whiteBorder18: 'var(--white-a-18)',
  whitePanel78: 'hsl(0 0% 100% / 0.78)',
  shadow20: '0 3px 14px hsl(0 0% 0% / 0.2)',
  transparent: 'hsl(0 0% 0% / 0)',
  heroOverlayStart: 'hsl(0 0% 0% / 0.18)',
  heroGradient: 'linear-gradient(160deg,hsl(217 33% 17%),hsl(221 83% 53%))',
  darkGradient: 'linear-gradient(135deg,hsl(217 33% 17%),hsl(215 28% 17%))',
  satelliteGradient: 'linear-gradient(135deg,hsl(142 76% 20%),hsl(83 64% 24%))',
  lightGradient: 'linear-gradient(135deg,hsl(213 97% 87%),hsl(214 95% 93%))',
} as const;
export const DYNAMIC_MAP_TOOLTIP_STYLES = `.smx-map-label,.smx-map-label.leaflet-tooltip{background:var(--neutral-slate-900)!important;border:none!important;border-radius:999px!important;color:var(--surface-card-light)!important;padding:4px 8px!important;font-size:10px!important;font-weight:700!important;box-shadow:none!important;opacity:1!important}.smx-map-label:before,.smx-map-label.leaflet-tooltip:before{display:none!important}.smx-locator-scroll::-webkit-scrollbar{width:10px}.smx-locator-scroll::-webkit-scrollbar-track{background:var(--map-scrollbar-track,var(--white-a-18));border-radius:999px}.smx-locator-scroll::-webkit-scrollbar-thumb{background:var(--map-scrollbar-thumb,var(--surface-card-light));border-radius:999px;border:2px solid hsl(0 0% 0% / 0)}`;
export const DYNAMIC_MAP_PROVIDER_OPTIONS = [
  { value: 'manual', label: 'Manual locations' },
  { value: 'osm-embed', label: 'OSM embed' },
  { value: 'google-places', label: 'Google Places' },
] as const;
export const DYNAMIC_MAP_RENDER_MODE_OPTIONS = [
  { value: 'cards-map', label: 'Cards + map' },
  { value: 'map-first', label: 'Map first' },
  { value: 'cards-only', label: 'Cards only' },
  { value: 'search-bar', label: 'Search bar locator' },
] as const;
export const DYNAMIC_MAP_CTA_OPTIONS = [
  { value: 'maps', label: 'Open in Maps' },
  { value: 'waze', label: 'Open in Waze' },
  { value: 'call', label: 'Call' },
  { value: 'site', label: 'Website' },
  { value: 'custom', label: 'Custom URL' },
] as const;

export type NearbyPlace = {
  name: string;
  flag: string;
  lat: number;
  lng: number;
  address: string;
  badge: string;
  openNow: boolean | null;
  ctaLabel: string;
  ctaType: LocationCtaType;
  ctaUrl: string;
};

export type NearbyPlacesSnapshot = {
  provider: NearbyPlacesProvider;
  query: string;
  places: NearbyPlace[];
  fetchedAt: string;
};

type GooglePlacesResponse = {
  places?: Array<{
    displayName?: { text?: string };
    location?: { latitude?: number; longitude?: number };
    formattedAddress?: string;
    currentOpeningHours?: { openNow?: boolean };
    nationalPhoneNumber?: string;
    websiteUri?: string;
  }>;
};

function csvEscape(value: string): string {
  if (!/[",\n]/.test(value)) return value;
  return `"${value.replace(/"/g, '""')}"`;
}

function parseCsvLine(line: string): string[] {
  const cols: string[] = [];
  let current = '';
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') {
      if (quoted && line[index + 1] === '"') {
        current += '"';
        index += 1;
        continue;
      }
      quoted = !quoted;
      continue;
    }
    if (char === ',' && !quoted) {
      cols.push(current.trim());
      current = '';
      continue;
    }
    current += char;
  }
  cols.push(current.trim());
  return cols;
}

function normalizeOpenNow(value: unknown): boolean | null {
  const normalizedOpenNow = String(value ?? '').trim().toLowerCase();
  return normalizedOpenNow === 'true' || normalizedOpenNow === 'yes' || normalizedOpenNow === 'open'
    ? true
    : normalizedOpenNow === 'false' || normalizedOpenNow === 'no' || normalizedOpenNow === 'closed'
      ? false
      : null;
}

function normalizeCtaType(value: unknown): LocationCtaType {
  const ctaType = String(value ?? DYNAMIC_MAP_DEFAULT_CTA_TYPE).trim().toLowerCase();
  return ['maps', 'waze', 'call', 'site', 'custom'].includes(ctaType) ? ctaType as LocationCtaType : DYNAMIC_MAP_DEFAULT_CTA_TYPE;
}

export function normalizeNearbyPlacesRows(rows: Array<Record<string, unknown>>): NearbyPlace[] {
  return rows.map((row) => {
    const normalized = Object.fromEntries(
      Object.entries(row).map(([key, value]) => [key.trim().toLowerCase(), value]),
    );
    return {
      name: String(normalized.name ?? 'Store'),
      flag: String(normalized.flag ?? ''),
      lat: Number(normalized.lat ?? normalized.latitude),
      lng: Number(normalized.lng ?? normalized.lon ?? normalized.long ?? normalized.longitude),
      address: String(normalized.address ?? ''),
      badge: String(normalized.badge ?? ''),
      openNow: normalizeOpenNow(normalized.opennow ?? normalized.open_now ?? normalized['open-now']),
      ctaLabel: String(normalized.ctalabel ?? normalized.cta_label ?? normalized['cta-label'] ?? DYNAMIC_MAP_DEFAULT_CTA_LABEL),
      ctaType: normalizeCtaType(normalized.ctatype ?? normalized.cta_type ?? normalized['cta-type']),
      ctaUrl: String(normalized.ctaurl ?? normalized.cta_url ?? normalized['cta-url'] ?? normalized.url ?? ''),
    };
  }).filter((item) => Number.isFinite(item.lat) && Number.isFinite(item.lng));
}

export function parseNearbyPlaces(csv: string): NearbyPlace[] {
  const lines = csv.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (lines.length <= 1) return [];
  const header = parseCsvLine(lines[0]).map((item) => item.trim());
  const rows = lines.slice(1).map((line) => {
    const cols = parseCsvLine(line);
    return Object.fromEntries(header.map((key, index) => [key, cols[index] ?? '']));
  });
  return normalizeNearbyPlacesRows(rows);
}

export function buildNearbyPlacesCsv(places: NearbyPlace[]): string {
  const header = 'name,flag,lat,lng,address,badge,openNow,ctaLabel,ctaType,ctaUrl';
  const rows = places.map((place) => [
    csvEscape(place.name),
    csvEscape(place.flag),
    String(place.lat),
    String(place.lng),
    csvEscape(place.address),
    csvEscape(place.badge),
    place.openNow == null ? '' : String(place.openNow),
    csvEscape(place.ctaLabel),
    place.ctaType,
    csvEscape(place.ctaUrl),
  ].join(','));
  return [header, ...rows].join('\n');
}

export function buildNearbyPlacesCacheKey(provider: NearbyPlacesProvider, query: string, latitude: number, longitude: number, radiusKm: number): string {
  return `smx-nearby:${provider}:${query.trim().toLowerCase()}:${latitude.toFixed(4)}:${longitude.toFixed(4)}:${radiusKm.toFixed(2)}`;
}

export function readNearbyPlacesCache(storage: Pick<Storage, 'getItem'> | null | undefined, key: string, cacheTtlMs: number): NearbyPlacesSnapshot | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(key);
    if (!raw) return null;
    const snapshot = JSON.parse(raw) as NearbyPlacesSnapshot;
    const age = Date.now() - Date.parse(snapshot.fetchedAt);
    if (!Number.isFinite(age) || age > cacheTtlMs) return null;
    return snapshot;
  } catch {
    return null;
  }
}

export function writeNearbyPlacesCache(storage: Pick<Storage, 'setItem'> | null | undefined, key: string, snapshot: NearbyPlacesSnapshot): void {
  if (!storage) return;
  try {
    storage.setItem(key, JSON.stringify(snapshot));
  } catch {
    // ignore cache write failures
  }
}

export async function fetchGooglePlacesSnapshot(
  input: {
    apiKey: string;
    query: string;
    latitude: number;
    longitude: number;
    radiusKm: number;
    resultLimit: number;
    defaultCtaType: LocationCtaType;
    defaultCtaLabel: string;
  },
  fetchImpl: typeof fetch = fetch,
): Promise<NearbyPlacesSnapshot | null> {
  if (!input.apiKey.trim() || !input.query.trim()) return null;
  try {
    const response = await fetchImpl('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': input.apiKey.trim(),
        'X-Goog-FieldMask': [
          'places.displayName',
          'places.location',
          'places.formattedAddress',
          'places.currentOpeningHours.openNow',
          'places.nationalPhoneNumber',
          'places.websiteUri',
        ].join(','),
      },
      body: JSON.stringify({
        textQuery: input.query.trim(),
        maxResultCount: Math.max(1, Math.min(10, input.resultLimit)),
        locationBias: {
          circle: {
            center: {
              latitude: input.latitude,
              longitude: input.longitude,
            },
            radius: Math.max(500, input.radiusKm * 1000),
          },
        },
      }),
    });
    if (!response.ok) return null;
    const payload = await response.json() as GooglePlacesResponse;
    const places = (payload.places ?? [])
      .map((place) => {
        const lat = Number(place.location?.latitude);
        const lng = Number(place.location?.longitude);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
        const ctaUrl = place.websiteUri || (place.nationalPhoneNumber ? `tel:${place.nationalPhoneNumber.replace(/\s+/g, '')}` : '');
        return {
          name: String(place.displayName?.text ?? 'Store'),
          flag: '',
          lat,
          lng,
          address: String(place.formattedAddress ?? ''),
          badge: place.currentOpeningHours?.openNow ? 'Open now' : '',
          openNow: typeof place.currentOpeningHours?.openNow === 'boolean' ? place.currentOpeningHours.openNow : null,
          ctaLabel: input.defaultCtaLabel,
          ctaType: input.defaultCtaType,
          ctaUrl,
        } satisfies NearbyPlace;
      })
      .filter((place): place is NearbyPlace => Boolean(place));
    return {
      provider: 'google-places',
      query: input.query.trim(),
      places,
      fetchedAt: new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

export async function loadNearbyPlacesSnapshot(
  input: {
    provider: NearbyPlacesProvider;
    apiKey: string;
    query: string;
    latitude: number;
    longitude: number;
    radiusKm: number;
    resultLimit: number;
    fetchPolicy: NearbyPlacesFetchPolicy;
    cacheTtlMs: number;
    defaultCtaType: LocationCtaType;
    defaultCtaLabel: string;
  },
  options?: {
    fetchImpl?: typeof fetch;
    storage?: Pick<Storage, 'getItem' | 'setItem'> | null;
  },
): Promise<NearbyPlacesSnapshot | null> {
  if (input.provider !== 'google-places') return null;
  const fetchImpl = options?.fetchImpl ?? fetch;
  const storage = options?.storage ?? (typeof window !== 'undefined' ? window.localStorage : null);
  const key = buildNearbyPlacesCacheKey(input.provider, input.query, input.latitude, input.longitude, input.radiusKm);
  const cached = readNearbyPlacesCache(storage, key, input.cacheTtlMs);
  if (input.fetchPolicy === 'cache-only') return cached;
  if (input.fetchPolicy === 'cache-first' && cached) return cached;

  const live = await fetchGooglePlacesSnapshot({
    apiKey: input.apiKey,
    query: input.query,
    latitude: input.latitude,
    longitude: input.longitude,
    radiusKm: input.radiusKm,
    resultLimit: input.resultLimit,
    defaultCtaType: input.defaultCtaType,
    defaultCtaLabel: input.defaultCtaLabel,
  }, fetchImpl);

  if (live) {
    writeNearbyPlacesCache(storage, key, live);
    return live;
  }
  return cached;
}

export function haversineKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const lat1 = toRad(aLat);
  const lat2 = toRad(bLat);
  const arc = Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 6371 * 2 * Math.atan2(Math.sqrt(arc), Math.sqrt(1 - arc));
}

export function buildPlaceCtaUrl(place: NearbyPlace, ctaType: LocationCtaType): string {
  if (ctaType === 'waze') return place.ctaUrl || `https://waze.com/ul?ll=${place.lat},${place.lng}&navigate=yes`;
  if (ctaType === 'call') return place.ctaUrl || '';
  if (ctaType === 'site' || ctaType === 'custom') return place.ctaUrl || '';
  return place.ctaUrl || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${place.lat},${place.lng}`)}`;
}
