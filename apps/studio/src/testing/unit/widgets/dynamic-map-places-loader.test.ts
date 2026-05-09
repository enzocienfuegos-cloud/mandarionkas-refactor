import { describe, expect, it, vi } from 'vitest';
import {
  buildNearbyPlacesCacheKey,
  buildNearbyPlacesCsv,
  loadNearbyPlacesSnapshot,
  parseNearbyPlaces,
  readNearbyPlacesCache,
  writeNearbyPlacesCache,
} from '../../../widgets/modules/dynamic-map/places-loader';
import { dynamicMapFixturePlaces } from '../../../widgets/modules/dynamic-map/fixtures';

function createStorageMock(seed?: Record<string, string>): Pick<Storage, 'getItem' | 'setItem'> {
  const data = new Map(Object.entries(seed ?? {}));
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => {
      data.set(key, value);
    },
  };
}

describe('dynamic map places loader', () => {
  it('round-trips nearby places csv', () => {
    const csv = buildNearbyPlacesCsv(dynamicMapFixturePlaces);
    expect(parseNearbyPlaces(csv)).toEqual(dynamicMapFixturePlaces);
  });

  it('reads fresh cache snapshots', () => {
    const key = buildNearbyPlacesCacheKey('google-places', 'coffee', 13.69, -89.21, 5);
    const storage = createStorageMock();
    const snapshot = {
      provider: 'google-places' as const,
      query: 'coffee',
      places: dynamicMapFixturePlaces,
      fetchedAt: new Date().toISOString(),
    };

    writeNearbyPlacesCache(storage, key, snapshot);

    expect(readNearbyPlacesCache(storage, key, 300000)).toEqual(snapshot);
  });

  it('returns cache immediately for cache-first hits', async () => {
    const key = buildNearbyPlacesCacheKey('google-places', 'coffee', 13.69, -89.21, 5);
    const snapshot = {
      provider: 'google-places' as const,
      query: 'coffee',
      places: dynamicMapFixturePlaces,
      fetchedAt: new Date().toISOString(),
    };
    const storage = createStorageMock({
      [key]: JSON.stringify(snapshot),
    });
    const fetchImpl = vi.fn();

    const result = await loadNearbyPlacesSnapshot({
      provider: 'google-places',
      apiKey: 'key',
      query: 'coffee',
      latitude: 13.69,
      longitude: -89.21,
      radiusKm: 5,
      resultLimit: 5,
      fetchPolicy: 'cache-first',
      cacheTtlMs: 300000,
      defaultCtaType: 'maps',
      defaultCtaLabel: 'Open in Maps',
    }, { storage, fetchImpl: fetchImpl as unknown as typeof fetch });

    expect(result).toEqual(snapshot);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('uses network results on network-first misses and writes cache', async () => {
    const storage = createStorageMock();
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        places: [
          {
            displayName: { text: 'Live Store' },
            location: { latitude: 13.7, longitude: -89.2 },
            formattedAddress: 'Centro',
            currentOpeningHours: { openNow: true },
            websiteUri: 'https://example.com',
          },
        ],
      }),
    }));

    const result = await loadNearbyPlacesSnapshot({
      provider: 'google-places',
      apiKey: 'key',
      query: 'coffee',
      latitude: 13.69,
      longitude: -89.21,
      radiusKm: 5,
      resultLimit: 5,
      fetchPolicy: 'network-first',
      cacheTtlMs: 300000,
      defaultCtaType: 'maps',
      defaultCtaLabel: 'Open in Maps',
    }, { storage, fetchImpl: fetchImpl as unknown as typeof fetch });

    expect(result?.places[0]?.name).toBe('Live Store');
    expect(readNearbyPlacesCache(storage, buildNearbyPlacesCacheKey('google-places', 'coffee', 13.69, -89.21, 5), 300000)?.places[0]?.name).toBe('Live Store');
  });

  it('returns cached data for cache-only requests', async () => {
    const key = buildNearbyPlacesCacheKey('google-places', 'coffee', 13.69, -89.21, 5);
    const snapshot = {
      provider: 'google-places' as const,
      query: 'coffee',
      places: dynamicMapFixturePlaces,
      fetchedAt: new Date().toISOString(),
    };
    const storage = createStorageMock({
      [key]: JSON.stringify(snapshot),
    });

    const result = await loadNearbyPlacesSnapshot({
      provider: 'google-places',
      apiKey: 'key',
      query: 'coffee',
      latitude: 13.69,
      longitude: -89.21,
      radiusKm: 5,
      resultLimit: 5,
      fetchPolicy: 'cache-only',
      cacheTtlMs: 300000,
      defaultCtaType: 'maps',
      defaultCtaLabel: 'Open in Maps',
    }, { storage });

    expect(result).toEqual(snapshot);
  });
});
