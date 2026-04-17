function normalizeBaseUrl(value: string | undefined): string {
  return (value ?? '').trim().replace(/\/$/, '');
}

function readEnv(name: string): string {
  return normalizeBaseUrl((import.meta.env as Record<string, string | undefined>)[name]);
}

const repositoryEnvByKey: Record<string, string> = {
  'smx-studio-v4:project-api-base': 'VITE_PROJECT_API_BASE_URL',
  'smx-studio-v4:document-api-base': 'VITE_DOCUMENT_API_BASE_URL',
  'smx-studio-v4:asset-api-base': 'VITE_ASSET_API_BASE_URL',
};

export function getApiBaseUrl(): string {
  return readEnv('VITE_API_BASE_URL');
}

export function getPlatformApiBaseUrl(): string {
  return readEnv('VITE_PLATFORM_API_BASE_URL') || getApiBaseUrl();
}

export function getAssetApiBaseUrl(): string {
  return readEnv('VITE_ASSET_API_BASE_URL') || getApiBaseUrl();
}

export function getRepositoryApiBaseUrl(key: string): string {
  const scopedEnv = repositoryEnvByKey[key];
  return (scopedEnv ? readEnv(scopedEnv) : '') || getApiBaseUrl();
}
