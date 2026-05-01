function normalize(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function parseInteger(value, fallback) {
  const normalized = normalize(value);
  if (!normalized) return fallback;
  const parsed = Number.parseInt(normalized, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseCsv(value) {
  const normalized = normalize(value);
  if (!normalized) return [];
  return normalized
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export function readApiEnv(source = process.env) {
  const appOrigin = normalize(source.APP_ORIGIN) || 'http://localhost:5173';
  const corsOrigins = parseCsv(source.CORS_ORIGIN);
  return Object.freeze({
    nodeEnv: normalize(source.NODE_ENV) || 'development',
    appName: normalize(source.APP_NAME) || 'smx-studio-api',
    appEnv: normalize(source.APP_ENV) || normalize(source.NODE_ENV) || 'development',
    port: parseInteger(source.PORT, 8080),
    appOrigin,
    corsOrigins: corsOrigins.length ? corsOrigins : [appOrigin],
    apiBaseUrl: normalize(source.API_BASE_URL) || '',
    apiPublicBaseUrl: normalize(source.API_PUBLIC_BASE_URL) || '',
    baseUrl: normalize(source.BASE_URL) || '',
    assetsPublicBaseUrl: normalize(source.ASSETS_PUBLIC_BASE_URL) || '',
    databaseUrl: normalize(source.DATABASE_URL) || '',
    databasePoolUrl: normalize(source.DATABASE_POOL_URL) || '',
    sessionSecret: normalize(source.SESSION_SECRET) || '',
    gitSha: normalize(source.APP_GIT_SHA) || 'dev',
    buildTime: normalize(source.APP_BUILD_TIME) || new Date().toISOString(),
    r2Endpoint: normalize(source.R2_ENDPOINT) || '',
    r2Bucket: normalize(source.R2_BUCKET) || '',
    r2AccessKeyId: normalize(source.R2_ACCESS_KEY_ID) || '',
    r2SecretAccessKey: normalize(source.R2_SECRET_ACCESS_KEY) || '',
  });
}

export function validateApiEnv(env) {
  const warnings = [];

  if (!env.databaseUrl) warnings.push('DATABASE_URL is not set yet. Database-backed modules will remain unavailable.');
  if (!env.databasePoolUrl) warnings.push('DATABASE_POOL_URL is not set yet. Runtime should use a pooled PostgreSQL URL on DigitalOcean.');
  if (!env.sessionSecret) warnings.push('SESSION_SECRET is not set yet. Cookie-based auth cannot be enabled safely.');
  if (!env.assetsPublicBaseUrl) warnings.push('ASSETS_PUBLIC_BASE_URL is not set yet. Public asset URLs should resolve through the Cloudflare-backed custom domain.');

  return warnings;
}
