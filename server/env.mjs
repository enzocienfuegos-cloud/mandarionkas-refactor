function required(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

function optional(name, fallback = '') {
  return process.env[name]?.trim() || fallback;
}

export function getServerEnv() {
  return {
    accountId: required('R2_ACCOUNT_ID'),
    accessKeyId: required('R2_ACCESS_KEY_ID'),
    secretAccessKey: required('R2_SECRET_ACCESS_KEY'),
    bucket: required('R2_BUCKET'),
    endpoint: required('R2_ENDPOINT'),
    publicBaseUrl: required('R2_PUBLIC_BASE'),
    signedUrlTtlSeconds: Number(optional('ASSET_SIGNED_URL_TTL_SECONDS', '900')),
    host: optional('PLATFORM_API_HOST', '0.0.0.0'),
    port: Number(optional('PLATFORM_API_PORT', '8787')),
    dataKey: optional('PLATFORM_API_DATA_KEY', 'platform-api/store.json'),
    dataPrefix: optional('PLATFORM_API_DATA_PREFIX', ''),
  };
}
