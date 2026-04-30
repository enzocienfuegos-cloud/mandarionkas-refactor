import { readStorageItem, writeStorageItem } from '../shared/browser/storage';
import { getApiBaseUrl } from '../config/runtime';

export function getRepositoryApiBase(key: string): string {
  const override = readStorageItem(key, '').trim().replace(/\/$/, '');
  if (override) {
    return override.endsWith('/v1') ? override : `${override}/v1`;
  }
  return getApiBaseUrl();
}

export function setRepositoryApiBase(key: string, value: string): void {
  writeStorageItem(key, value);
}
