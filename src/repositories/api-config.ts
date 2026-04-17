import { getRepositoryApiBaseUrl } from '../shared/runtime/api-base';

export function getRepositoryApiBase(key: string): string {
  return getRepositoryApiBaseUrl(key);
}

export function setRepositoryApiBase(key: string, value: string): void {
  if (import.meta.env.DEV) {
    console.warn(`setRepositoryApiBase("${key}") is deprecated. Configure API endpoints with Vite env vars instead.`);
  }
  void value;
}
