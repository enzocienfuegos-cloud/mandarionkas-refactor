import { loadOptionalEnvFile } from './load-optional-env.mjs';

loadOptionalEnvFile('.env');
loadOptionalEnvFile('.env.staging');

const baseUrl = String(process.env.SMOKE_BASE_URL || process.env.VITE_API_BASE_URL || '').trim().replace(/\/+$/, '');
const email = String(process.env.SMOKE_LOGIN_EMAIL || '').trim();
const password = String(process.env.SMOKE_LOGIN_PASSWORD || '').trim();
const allow = String(process.env.STAGING_TENANT_MUTATION_REHEARSAL_ALLOW || 'false').trim() === 'true';
const workspacePrefix = String(process.env.STAGING_TENANT_MUTATION_REHEARSAL_PREFIX || '').trim();
const inviteDomain = String(process.env.STAGING_TENANT_MUTATION_REHEARSAL_INVITE_DOMAIN || 'example.invalid').trim();

if (!baseUrl) {
  console.error(JSON.stringify({
    ok: false,
    message: 'Missing SMOKE_BASE_URL or VITE_API_BASE_URL for tenant mutation rehearsal.',
  }, null, 2));
  process.exit(1);
}

if (!email || !password) {
  console.error(JSON.stringify({
    ok: false,
    message: 'Missing SMOKE_LOGIN_EMAIL or SMOKE_LOGIN_PASSWORD for tenant mutation rehearsal.',
  }, null, 2));
  process.exit(1);
}

if (!allow) {
  console.error(JSON.stringify({
    ok: false,
    message: 'Tenant mutation rehearsal is disabled. Set STAGING_TENANT_MUTATION_REHEARSAL_ALLOW=true only in a dedicated smoke tenant.',
  }, null, 2));
  process.exit(1);
}

if (!workspacePrefix) {
  console.error(JSON.stringify({
    ok: false,
    message: 'Missing STAGING_TENANT_MUTATION_REHEARSAL_PREFIX. Use a dedicated smoke prefix to avoid mixing rehearsal artifacts with real tenants.',
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

  const response = await fetch(`${baseUrl}${path}`, { ...init, headers });
  updateCookies(response);

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

function isoNowSuffix() {
  return new Date().toISOString().replace(/[:.]/g, '-').toLowerCase();
}

async function main() {
  const checks = [];
  const suffix = isoNowSuffix();
  const workspaceName = `${workspacePrefix} ${suffix}`;
  const brandName = `Brand ${suffix}`;
  const inviteEmail = `${workspacePrefix.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now()}@${inviteDomain}`;

  const login = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password, remember: false }),
  });
  checks.push({
    step: 'login',
    status: login.status,
    ok: login.ok,
  });
  if (!login.ok) throw new Error('Login failed.');

  const createClient = await request('/clients', {
    method: 'POST',
    body: JSON.stringify({ name: workspaceName }),
  });
  const clientId = createClient.body?.client?.id || '';
  checks.push({
    step: 'create-client',
    status: createClient.status,
    ok: createClient.ok,
    clientId,
    name: workspaceName,
  });
  if (!createClient.ok || !clientId) throw new Error('Workspace creation failed.');

  const setActive = await request('/clients/active', {
    method: 'POST',
    body: JSON.stringify({ clientId }),
  });
  checks.push({
    step: 'set-active-client',
    status: setActive.status,
    ok: setActive.ok,
    activeClientId: setActive.body?.activeClientId || '',
  });
  if (!setActive.ok || setActive.body?.activeClientId !== clientId) throw new Error('Active client switch failed.');

  const createBrand = await request(`/clients/${clientId}/brands`, {
    method: 'POST',
    body: JSON.stringify({
      name: brandName,
      primaryColor: '#0ea5e9',
    }),
  });
  const createdBrand = createBrand.body?.client?.brands?.[0] || null;
  checks.push({
    step: 'create-brand',
    status: createBrand.status,
    ok: createBrand.ok,
    brandId: createdBrand?.id || '',
    brandName: createdBrand?.name || '',
  });
  if (!createBrand.ok || !createdBrand?.id) throw new Error('Brand creation failed.');

  const invite = await request(`/clients/${clientId}/invites`, {
    method: 'POST',
    body: JSON.stringify({
      email: inviteEmail,
      role: 'reviewer',
    }),
  });
  checks.push({
    step: 'invite-member',
    status: invite.status,
    ok: invite.ok,
    inviteEmail,
    message: invite.body?.message || '',
  });
  if (!invite.ok) throw new Error('Client invite failed.');

  const clients = await request('/clients');
  const createdClient = (clients.body?.clients || []).find((entry) => entry.id === clientId);
  checks.push({
    step: 'verify-client',
    status: clients.status,
    ok: clients.ok,
    found: Boolean(createdClient),
    brandCount: createdClient?.brands?.length ?? null,
    inviteCount: createdClient?.invites?.length ?? null,
  });
  if (!clients.ok || !createdClient) throw new Error('Created workspace verification failed.');

  const logout = await request('/auth/logout', {
    method: 'POST',
    body: JSON.stringify({}),
  });
  checks.push({
    step: 'logout',
    status: logout.status,
    ok: logout.ok,
  });

  console.log(JSON.stringify({
    ok: true,
    baseUrl,
    workspaceName,
    inviteEmail,
    checks,
    note: 'This rehearsal intentionally leaves smoke-only client/brand/invite records behind. Use a dedicated smoke prefix/tenant.',
  }, null, 2));
}

main().catch((error) => {
  console.error(JSON.stringify({
    ok: false,
    baseUrl,
    message: error instanceof Error ? error.message : String(error),
  }, null, 2));
  process.exit(1);
});
