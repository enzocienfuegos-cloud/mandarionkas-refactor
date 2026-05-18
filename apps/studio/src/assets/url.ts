import { getAssetsBaseUrl } from '../config/runtime';

function hasProtocol(value: string): boolean {
  return /^[a-z][a-z0-9+.-]*:/i.test(value) || value.startsWith('//');
}

export function absolutizeAssetUrl(value: string | undefined | null): string {
  const trimmed = String(value ?? '').trim();
  if (!trimmed) return '';
  if (hasProtocol(trimmed)) return trimmed;

  const base = getAssetsBaseUrl();
  if (!base) return trimmed;
  if (trimmed.startsWith('/')) return `${base}${trimmed}`;
  return `${base}/${trimmed}`;
}
