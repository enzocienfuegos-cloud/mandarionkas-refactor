import { loadOptionalEnvFile } from './load-optional-env.mjs';

loadOptionalEnvFile('.env');
loadOptionalEnvFile('.env.staging');

const baseUrl = String(process.env.SMOKE_BASE_URL || process.env.VITE_API_BASE_URL || '').trim().replace(/\/+$/, '');
const email = String(process.env.SMOKE_LOGIN_EMAIL || '').trim();
const password = String(process.env.SMOKE_LOGIN_PASSWORD || '').trim();
const expectedDriver = String(
  process.env.SMOKE_EXPECTED_REPOSITORY_DRIVER
  || process.env.STAGING_EXPECTED_REPOSITORY_DRIVER
  || 'postgres'
).trim();

if (!baseUrl) {
  console.error(JSON.stringify({
    ok: false,
    message: 'Missing SMOKE_BASE_URL or VITE_API_BASE_URL for staging smoke test.',
  }, null, 2));
  process.exit(1);
}

if (!email || !password) {
  console.error(JSON.stringify({
    ok: false,
    message: 'Missing SMOKE_LOGIN_EMAIL or SMOKE_LOGIN_PASSWORD for staging smoke test.',
  }, null, 2));
  process.exit(1);
}

const cookieJar = new Map();

function updateCookies(response) {
  const setCookie = response.headers.get('set-cookie');
  if (!setCookie) return;
  const firstPair = setCookie.split(';')[0];
  const separatorIndex = firstPair.indexOf('=');
  if (separatorIndex <= 0) return;
  const name = firstPair.slice(0, separatorIndex).trim();
  const value = firstPair.slice(separatorIndex + 1).trim();
  if (!name) return;
  cookieJar.set(name, value);
}

function getCookieHeader() {
  return Array.from(cookieJar.entries()).map(([name, value]) => `${name}=${value}`).join('; ');
}

async function request(path, init = {}) {
  const headers = new Headers(init.headers || {});
  headers.set('Content-Type', 'application/json');
  const cookieHeader = getCookieHeader();
  if (cookieHeader) headers.set('Cookie', cookieHeader);

  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers,
  });
  updateCookies(response);

  let body = null;
  const text = await response.text();
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

function isoNowSuffix() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

async function main() {
  const results = [];

  const health = await request('/health', { method: 'GET' });
  results.push({ step: 'health', ...health });
  if (!health.ok) throw new Error('Health check failed.');

  const readyz = await request('/readyz', { method: 'GET' });
  results.push({ step: 'readyz', ...readyz, driver: readyz.body?.repository?.driver || '' });
  if (!readyz.ok) throw new Error('Readiness check failed.');
  if (expectedDriver && readyz.body?.repository?.driver !== expectedDriver) {
    throw new Error(`Readiness reported repository driver "${readyz.body?.repository?.driver || 'unknown'}" instead of "${expectedDriver}".`);
  }

  const version = await request('/version', { method: 'GET' });
  results.push({ step: 'version', status: version.status, ok: version.ok, driver: version.body?.repository?.driver || '', version: version.body?.version || '' });
  if (!version.ok) throw new Error('Version check failed.');
  if (expectedDriver && version.body?.repository?.driver !== expectedDriver) {
    throw new Error(`Version endpoint reported repository driver "${version.body?.repository?.driver || 'unknown'}" instead of "${expectedDriver}".`);
  }

  const observability = await request('/observability', { method: 'GET' });
  results.push({
    step: 'observability',
    status: observability.status,
    ok: observability.ok,
    driver: observability.body?.repository?.driver || '',
    totalRequests: observability.body?.totals?.requests ?? null,
  });
  if (!observability.ok) throw new Error('Observability check failed.');
  if (expectedDriver && observability.body?.repository?.driver !== expectedDriver) {
    throw new Error(`Observability endpoint reported repository driver "${observability.body?.repository?.driver || 'unknown'}" instead of "${expectedDriver}".`);
  }

  const login = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      email,
      password,
      remember: false,
    }),
  });
  results.push({ step: 'login', status: login.status, ok: login.ok, bodyPreview: login.body?.ok });
  if (!login.ok || !login.body?.session?.sessionId) throw new Error('Login failed.');

  const session = await request('/auth/session', { method: 'GET' });
  results.push({ step: 'session', status: session.status, ok: session.ok, activeClientId: session.body?.activeClientId });
  if (!session.ok || !session.body?.activeClientId) throw new Error('Session restore failed.');

  const clients = await request('/clients', { method: 'GET' });
  results.push({ step: 'clients', status: clients.status, ok: clients.ok, count: clients.body?.clients?.length ?? 0 });
  if (!clients.ok) throw new Error('Client list failed.');

  const projectsBefore = await request('/projects', { method: 'GET' });
  results.push({ step: 'projects:list:before', status: projectsBefore.status, ok: projectsBefore.ok, count: projectsBefore.body?.projects?.length ?? 0 });
  if (!projectsBefore.ok) throw new Error('Project list failed.');

  const projectName = `Smoke Project ${isoNowSuffix()}`;
  const projectState = {
    document: {
      id: `proj_smoke_${Date.now()}`,
      name: projectName,
      metadata: {
        platform: {
          accessScope: 'client',
          campaignName: 'Staging Smoke',
          brandName: 'Smoke Brand',
        },
      },
      canvas: {
        presetId: 'custom',
      },
      scenes: [
        { id: 'scene_smoke', widgetIds: ['widget_smoke'] },
      ],
    },
    ui: {
      activeProjectId: `proj_smoke_${Date.now()}`,
    },
  };

  const saveProject = await request('/projects/save', {
    method: 'POST',
    body: JSON.stringify({ state: projectState }),
  });
  results.push({ step: 'projects:save', status: saveProject.status, ok: saveProject.ok, projectId: saveProject.body?.project?.id });
  if (!saveProject.ok || !saveProject.body?.project?.id) throw new Error('Project save failed.');
  const projectId = saveProject.body.project.id;

  const loadProject = await request(`/projects/${projectId}`, { method: 'GET' });
  results.push({ step: 'projects:load', status: loadProject.status, ok: loadProject.ok, hasState: Boolean(loadProject.body?.state) });
  if (!loadProject.ok || !loadProject.body?.state) throw new Error('Project load failed.');

  const listVersions = await request(`/projects/${projectId}/versions`, { method: 'GET' });
  results.push({ step: 'projects:versions:list', status: listVersions.status, ok: listVersions.ok, count: listVersions.body?.versions?.length ?? 0 });
  if (!listVersions.ok) throw new Error('Project version list failed.');

  const saveVersion = await request(`/projects/${projectId}/versions`, {
    method: 'POST',
    body: JSON.stringify({
      state: projectState,
      note: 'Smoke checkpoint',
    }),
  });
  results.push({ step: 'projects:versions:save', status: saveVersion.status, ok: saveVersion.ok, versionId: saveVersion.body?.version?.id });
  if (!saveVersion.ok || !saveVersion.body?.version?.id) throw new Error('Project version save failed.');

  const createAsset = await request('/assets', {
    method: 'POST',
    body: JSON.stringify({
      asset: {
        name: `Smoke Asset ${isoNowSuffix()}`,
        kind: 'image',
        src: 'https://cdn.example.com/smoke-image.jpg',
        publicUrl: 'https://cdn.example.com/smoke-image.jpg',
        sourceType: 'url',
        storageMode: 'remote-url',
        accessScope: 'client',
        tags: ['smoke', 'staging'],
      },
    }),
  });
  results.push({ step: 'assets:create', status: createAsset.status, ok: createAsset.ok, assetId: createAsset.body?.asset?.id });
  if (!createAsset.ok || !createAsset.body?.asset?.id) throw new Error('Asset create failed.');
  const assetId = createAsset.body.asset.id;

  const getAsset = await request(`/assets/${assetId}`, { method: 'GET' });
  results.push({ step: 'assets:get', status: getAsset.status, ok: getAsset.ok, found: Boolean(getAsset.body?.asset) });
  if (!getAsset.ok || !getAsset.body?.asset) throw new Error('Asset fetch failed.');

  const renameAsset = await request(`/assets/${assetId}/rename`, {
    method: 'POST',
    body: JSON.stringify({ name: `Renamed Smoke Asset ${isoNowSuffix()}` }),
  });
  results.push({ step: 'assets:rename', status: renameAsset.status, ok: renameAsset.ok });
  if (!renameAsset.ok) throw new Error('Asset rename failed.');

  const deleteAsset = await request(`/assets/${assetId}`, { method: 'DELETE' });
  results.push({ step: 'assets:delete', status: deleteAsset.status, ok: deleteAsset.ok });
  if (!deleteAsset.ok) throw new Error('Asset delete failed.');

  const deleteProject = await request(`/projects/${projectId}`, { method: 'DELETE' });
  results.push({ step: 'projects:delete', status: deleteProject.status, ok: deleteProject.ok });
  if (!deleteProject.ok) throw new Error('Project delete failed.');

  const logout = await request('/auth/logout', { method: 'POST' });
  results.push({ step: 'logout', status: logout.status, ok: logout.ok });

  console.log(JSON.stringify({
    ok: true,
    baseUrl,
    expectedDriver,
    steps: results,
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
