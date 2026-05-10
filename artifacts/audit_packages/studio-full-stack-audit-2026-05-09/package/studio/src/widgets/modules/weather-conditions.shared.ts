export type WeatherProvider = 'open-meteo' | 'static';
export type WeatherFetchPolicy = 'cache-first' | 'network-first' | 'cache-only';

export type WeatherSnapshot = {
  provider: WeatherProvider;
  location: string;
  temperature: number;
  condition: string;
  conditionCode: number;
  isDay: boolean;
  fetchedAt: string;
};

export function resolveWeatherCondition(code: number): string {
  if (code === 0) return 'Clear';
  if ([1, 2].includes(code)) return 'Partly cloudy';
  if (code === 3) return 'Cloudy';
  if ([45, 48].includes(code)) return 'Fog';
  if ([51, 53, 55, 56, 57].includes(code)) return 'Drizzle';
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return 'Rain';
  if ([71, 73, 75, 77, 85, 86].includes(code)) return 'Snow';
  if ([95, 96, 99].includes(code)) return 'Storm';
  return 'Weather';
}

export function resolveWeatherIcon(condition: string, isDay = true): string {
  const normalized = condition.toLowerCase();
  if (normalized.includes('storm')) return '⛈️';
  if (normalized.includes('snow')) return '❄️';
  if (normalized.includes('rain') || normalized.includes('drizzle')) return '🌧️';
  if (normalized.includes('fog')) return '🌫️';
  if (normalized.includes('cloud')) return '☁️';
  return isDay ? '☀️' : '🌙';
}

export function buildWeatherCacheKey(provider: WeatherProvider, latitude: number, longitude: number): string {
  return `smx-weather:${provider}:${latitude.toFixed(4)}:${longitude.toFixed(4)}`;
}

export function readWeatherCache(storage: Pick<Storage, 'getItem'> | null | undefined, key: string, cacheTtlMs: number): WeatherSnapshot | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(key);
    if (!raw) return null;
    const snapshot = JSON.parse(raw) as WeatherSnapshot;
    const age = Date.now() - Date.parse(snapshot.fetchedAt);
    if (!Number.isFinite(age) || age > cacheTtlMs) return null;
    return snapshot;
  } catch {
    return null;
  }
}

export function writeWeatherCache(storage: Pick<Storage, 'setItem'> | null | undefined, key: string, snapshot: WeatherSnapshot): void {
  if (!storage) return;
  try {
    storage.setItem(key, JSON.stringify(snapshot));
  } catch {
    // ignore cache write failures
  }
}

export async function fetchOpenMeteoSnapshot(
  input: { latitude: number; longitude: number; location: string },
  fetchImpl: typeof fetch = fetch,
): Promise<WeatherSnapshot | null> {
  const url = new URL('https://api.open-meteo.com/v1/forecast');
  url.searchParams.set('latitude', String(input.latitude));
  url.searchParams.set('longitude', String(input.longitude));
  url.searchParams.set('current', 'temperature_2m,weather_code,is_day');
  url.searchParams.set('timezone', 'auto');
  try {
    const response = await fetchImpl(url.toString());
    if (!response.ok) return null;
    const payload = await response.json() as {
      current?: {
        temperature_2m?: number;
        weather_code?: number;
        is_day?: number;
      };
    };
    const current = payload.current;
    if (!current || !Number.isFinite(current.temperature_2m) || !Number.isFinite(current.weather_code)) return null;
    const conditionCode = Number(current.weather_code);
    return {
      provider: 'open-meteo',
      location: input.location,
      temperature: Math.round(Number(current.temperature_2m)),
      condition: resolveWeatherCondition(conditionCode),
      conditionCode,
      isDay: Number(current.is_day ?? 1) === 1,
      fetchedAt: new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

export async function loadWeatherSnapshot(
  input: {
    provider: WeatherProvider;
    latitude: number;
    longitude: number;
    location: string;
    fetchPolicy: WeatherFetchPolicy;
    cacheTtlMs: number;
  },
  options?: {
    fetchImpl?: typeof fetch;
    storage?: Pick<Storage, 'getItem' | 'setItem'> | null;
  },
): Promise<WeatherSnapshot | null> {
  if (input.provider !== 'open-meteo') return null;
  const fetchImpl = options?.fetchImpl ?? fetch;
  const storage = options?.storage ?? (typeof window !== 'undefined' ? window.localStorage : null);
  const key = buildWeatherCacheKey(input.provider, input.latitude, input.longitude);
  const cached = readWeatherCache(storage, key, input.cacheTtlMs);

  if (input.fetchPolicy === 'cache-only') return cached;
  if (input.fetchPolicy === 'cache-first' && cached) return cached;

  const live = await fetchOpenMeteoSnapshot({
    latitude: input.latitude,
    longitude: input.longitude,
    location: input.location,
  }, fetchImpl);

  if (live) {
    writeWeatherCache(storage, key, live);
    return live;
  }

  return cached;
}
