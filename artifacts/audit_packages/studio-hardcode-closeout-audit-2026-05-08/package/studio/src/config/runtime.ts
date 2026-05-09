const rawApiBase = (import.meta.env.VITE_API_BASE_URL ?? '').trim();
const rawAssetsBase = (import.meta.env.VITE_ASSETS_BASE_URL ?? '').trim();

function stripTrailingSlash(value: string): string {
  return value.replace(/\/$/, '');
}

export function getApiBaseUrl(): string {
  const normalized = stripTrailingSlash(rawApiBase);
  if (!normalized) return '';
  return normalized.endsWith('/v1') ? normalized : `${normalized}/v1`;
}

export function getAssetsBaseUrl(): string {
  return stripTrailingSlash(rawAssetsBase);
}

export const APP_ENV = (import.meta.env.VITE_APP_ENV ?? 'development').trim() || 'development';
