function normalize(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeOrigin(value) {
  const normalized = normalize(value);
  return normalized.replace(/\/+$/, '');
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
    .split(/[,\n\r\s]+/)
    .map((entry) => normalizeOrigin(entry))
    .filter(Boolean);
}

export function readApiEnv(source = process.env) {
  const appOrigin = normalizeOrigin(source.APP_ORIGIN) || 'http://localhost:5173';
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
    pgPoolMax: parseInteger(source.PG_POOL_MAX, 10),
    pgPoolIdleTimeoutMs: parseInteger(source.PG_POOL_IDLE_TIMEOUT_MS, 10_000),
    pgPoolConnectTimeoutMs: parseInteger(source.PG_POOL_CONNECT_TIMEOUT_MS, 5_000),
    postgresCaCertPath: normalize(source.POSTGRES_CA_CERT_PATH) || '',
    postgresSslRejectUnauth: normalize(source.POSTGRES_SSL_REJECT_UNAUTHORIZED) || 'true',
    sessionSecret: normalize(source.SESSION_SECRET) || '',
    gitSha: normalize(source.APP_GIT_SHA) || 'dev',
    buildTime: normalize(source.APP_BUILD_TIME) || new Date().toISOString(),
    r2Endpoint: normalize(source.R2_ENDPOINT) || '',
    r2Bucket: normalize(source.R2_BUCKET) || '',
    r2AccessKeyId: normalize(source.R2_ACCESS_KEY_ID) || '',
    r2SecretAccessKey: normalize(source.R2_SECRET_ACCESS_KEY) || '',
    r2PublicBaseUrl: normalize(source.R2_PUBLIC_BASE) || '',
    trackerFlushIntervalMs: parseInteger(source.TRACKER_FLUSH_INTERVAL_MS, 5000),
    trackerFlushThreshold: parseInteger(source.TRACKER_FLUSH_THRESHOLD, 1000),
    trackerCookieName: normalize(source.TRACKER_COOKIE_NAME) || 'smx_uid',
    trackerCookieMaxAge: parseInteger(source.TRACKER_COOKIE_MAX_AGE_S, 30 * 24 * 60 * 60),
    trackerCookiePath: normalize(source.TRACKER_COOKIE_PATH) || '/v1/tags/tracker',
  });
}

export function validateApiEnv(env) {
  const warnings = [];

  if (!env.databaseUrl) warnings.push('DATABASE_URL is not set yet. Database-backed modules will remain unavailable.');
  if (!env.databasePoolUrl) warnings.push('DATABASE_POOL_URL is not set yet. Runtime should use a pooled PostgreSQL URL on DigitalOcean.');
  if (!env.sessionSecret) warnings.push('SESSION_SECRET is not set yet. Cookie-based auth cannot be enabled safely.');
  if (!env.assetsPublicBaseUrl) warnings.push('ASSETS_PUBLIC_BASE_URL is not set yet. Public asset URLs should resolve through the Cloudflare-backed custom domain.');
  if (env.postgresSslRejectUnauth === 'false' && env.nodeEnv === 'production') {
    warnings.push('POSTGRES_SSL_REJECT_UNAUTHORIZED=false in production — TLS certificate is not verified.');
  }

  return warnings;
}
