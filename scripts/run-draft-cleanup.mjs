import { loadOptionalEnvFile } from './load-optional-env.mjs';

loadOptionalEnvFile('.env');
loadOptionalEnvFile('.env.staging');

const baseUrl = String(process.env.SMOKE_BASE_URL || process.env.VITE_API_BASE_URL || '').trim().replace(/\/+$/, '');
const email = String(process.env.SMOKE_LOGIN_EMAIL || '').trim();
const password = String(process.env.SMOKE_LOGIN_PASSWORD || '').trim();
const maxAgeDays = Number(process.env.DRAFT_CLEANUP_MAX_AGE_DAYS || process.env.PLATFORM_DRAFT_RETENTION_DAYS || '14');
const scope = String(process.env.DRAFT_CLEANUP_SCOPE || '').trim();

if (!baseUrl || !email || !password) {
  console.error(JSON.stringify({
    ok: false,
    message: 'Missing SMOKE_BASE_URL/VITE_API_BASE_URL or smoke credentials for draft cleanup script.',
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
  cookieJar.set(firstPair.slice(0, separatorIndex).trim(), firstPair.slice(separatorIndex + 1).trim());
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
  return { ok: response.ok, status: response.status, body };
}

async function main() {
  const login = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password, remember: false }),
  });
  if (!login.ok) throw new Error('Admin login failed for draft cleanup.');

  const cleanup = await request('/admin/maintenance/cleanup-drafts', {
    method: 'POST',
    body: JSON.stringify({ maxAgeDays, scope }),
  });
  console.log(JSON.stringify(cleanup.body ?? { ok: cleanup.ok, status: cleanup.status }, null, 2));
  if (!cleanup.ok) process.exit(1);
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, message: error.message }, null, 2));
  process.exit(1);
});
