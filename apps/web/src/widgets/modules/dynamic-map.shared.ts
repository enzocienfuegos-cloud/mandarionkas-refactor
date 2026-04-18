export type LocationCtaType = 'maps' | 'waze' | 'call' | 'site' | 'custom';
export type NearbyPlacesProvider = 'manual' | 'osm-embed' | 'google-places';
export type NearbyPlacesFetchPolicy = 'cache-first' | 'network-first' | 'cache-only';

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
  const ctaType = String(value ?? 'maps').trim().toLowerCase();
  return ['maps', 'waze', 'call', 'site', 'custom'].includes(ctaType) ? ctaType as LocationCtaType : 'maps';
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
      ctaLabel: String(normalized.ctalabel ?? normalized.cta_label ?? normalized['cta-label'] ?? 'Open in Maps'),
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
