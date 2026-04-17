import { loadOptionalEnvFile } from './load-optional-env.mjs';

loadOptionalEnvFile('.env');
loadOptionalEnvFile('.env.staging');

const baseUrl = String(process.env.SMOKE_BASE_URL || process.env.VITE_API_BASE_URL || '').trim().replace(/\/+$/, '');
const expectedDriver = String(
  process.env.STAGING_EXPECTED_REPOSITORY_DRIVER
  || process.env.SMOKE_EXPECTED_REPOSITORY_DRIVER
  || 'postgres'
).trim();

if (!baseUrl) {
  console.error(JSON.stringify({
    ok: false,
    message: 'Missing SMOKE_BASE_URL or VITE_API_BASE_URL for post-deploy cutover checks.',
  }, null, 2));
  process.exit(1);
}

async function request(path) {
  const response = await fetch(`${baseUrl}${path}`, { method: 'GET' });
  const text = await response.text();
  let body = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }
  return {
    ok: response.ok,
    status: response.status,
    body,
  };
}

function assertDriver(label, payload) {
  const driver = payload?.repository?.driver || '';
  if (expectedDriver && driver !== expectedDriver) {
    throw new Error(`${label} reported repository driver "${driver || 'unknown'}" instead of "${expectedDriver}".`);
  }
  return driver;
}

async function main() {
  const checks = [];

  const health = await request('/health');
  checks.push({ step: 'health', status: health.status, ok: health.ok });
  if (!health.ok) throw new Error('Health check failed.');

  const readyz = await request('/readyz');
  const readyzDriver = assertDriver('readyz', readyz.body);
  checks.push({
    step: 'readyz',
    status: readyz.status,
    ok: readyz.ok,
    driver: readyzDriver,
    repositoryOk: readyz.body?.repository?.ok ?? null,
  });
  if (!readyz.ok) throw new Error('Readiness check failed.');

  const version = await request('/version');
  const versionDriver = assertDriver('version', version.body);
  checks.push({
    step: 'version',
    status: version.status,
    ok: version.ok,
    driver: versionDriver,
    version: version.body?.version || '',
  });
  if (!version.ok) throw new Error('Version check failed.');

  const observability = await request('/observability');
  const observabilityDriver = assertDriver('observability', observability.body);
  checks.push({
    step: 'observability',
    status: observability.status,
    ok: observability.ok,
    driver: observabilityDriver,
    totalRequests: observability.body?.totals?.requests ?? null,
    total4xx: observability.body?.totals?.status4xx ?? null,
    total5xx: observability.body?.totals?.status5xx ?? null,
  });
  if (!observability.ok) throw new Error('Observability check failed.');

  console.log(JSON.stringify({
    ok: true,
    baseUrl,
    expectedDriver,
    checks,
  }, null, 2));
}

main().catch((error) => {
  console.error(JSON.stringify({
    ok: false,
    baseUrl,
    expectedDriver,
    message: error instanceof Error ? error.message : String(error),
  }, null, 2));
  process.exit(1);
});
