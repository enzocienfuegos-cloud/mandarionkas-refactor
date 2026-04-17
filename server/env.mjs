function required(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

function optional(name, fallback = '') {
  return process.env[name]?.trim() || fallback;
}

export function getServerEnv() {
  const repositoryDriver = optional('PLATFORM_REPOSITORY_DRIVER', 'postgres');
  if (repositoryDriver !== 'postgres') {
    throw new Error(`Unsupported PLATFORM_REPOSITORY_DRIVER: ${repositoryDriver}. PostgreSQL is the only supported backend.`);
  }
  return {
    repositoryDriver,
    postgresUrl: optional('PLATFORM_POSTGRES_URL', ''),
    postgresSchema: optional('PLATFORM_POSTGRES_SCHEMA', 'public'),
    postgresSslMode: optional('PLATFORM_POSTGRES_SSL_MODE', 'prefer'),
    accountId: optional('R2_ACCOUNT_ID', ''),
    accessKeyId: optional('R2_ACCESS_KEY_ID', ''),
    secretAccessKey: optional('R2_SECRET_ACCESS_KEY', ''),
    bucket: optional('R2_BUCKET', ''),
    endpoint: optional('R2_ENDPOINT', ''),
    publicBaseUrl: optional('R2_PUBLIC_BASE', ''),
    signedUrlTtlSeconds: Number(optional('ASSET_SIGNED_URL_TTL_SECONDS', '900')),
    host: optional('PLATFORM_API_HOST', '0.0.0.0'),
    port: Number(optional('PLATFORM_API_PORT', '8787')),
    allowedOrigin: optional('PLATFORM_ALLOWED_ORIGIN', ''),
    cookieSecure: optional('PLATFORM_COOKIE_SECURE', 'false') === 'true',
    observabilityEnabled: optional('PLATFORM_OBSERVABILITY_ENABLED', 'true') !== 'false',
    loginRateLimitWindowMs: Number(optional('PLATFORM_LOGIN_RATE_LIMIT_WINDOW_MS', '60000')),
    loginRateLimitMax: Number(optional('PLATFORM_LOGIN_RATE_LIMIT_MAX', '10')),
    uploadRateLimitWindowMs: Number(optional('PLATFORM_UPLOAD_RATE_LIMIT_WINDOW_MS', '60000')),
    uploadRateLimitMax: Number(optional('PLATFORM_UPLOAD_RATE_LIMIT_MAX', '20')),
    draftRetentionDays: Number(optional('PLATFORM_DRAFT_RETENTION_DAYS', '14')),
  };
}
