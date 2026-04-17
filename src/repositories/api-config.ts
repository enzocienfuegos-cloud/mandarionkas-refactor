import { readStorageItem, writeStorageItem } from '../shared/browser/storage';

export function getRepositoryApiBase(key: string): string {
  return readStorageItem(key, '');
}

export function setRepositoryApiBase(key: string, value: string): void {
  writeStorageItem(key, value);
}
