import { loadOptionalEnvFile } from './load-optional-env.mjs';

loadOptionalEnvFile('.env');
loadOptionalEnvFile('.env.staging');

const baseUrl = String(process.env.SMOKE_BASE_URL || process.env.VITE_API_BASE_URL || '').trim().replace(/\/+$/, '');
const email = String(process.env.SMOKE_LOGIN_EMAIL || '').trim();
const password = String(process.env.SMOKE_LOGIN_PASSWORD || '').trim();

if (!baseUrl) {
  console.error(JSON.stringify({
    ok: false,
    message: 'Missing SMOKE_BASE_URL or VITE_API_BASE_URL for upload completion rehearsal.',
  }, null, 2));
  process.exit(1);
}

if (!email || !password) {
  console.error(JSON.stringify({
    ok: false,
    message: 'Missing SMOKE_LOGIN_EMAIL or SMOKE_LOGIN_PASSWORD for upload completion rehearsal.',
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

async function uploadBinaryToSignedUrl(uploadUrl, mimeType, content) {
  const response = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': mimeType,
    },
    body: new TextEncoder().encode(content),
  });
  return {
    ok: response.ok,
    status: response.status,
  };
}

function isoNowSuffix() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

async function main() {
  const checks = [];

  const login = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password, remember: false }),
  });
  checks.push({
    step: 'login',
    status: login.status,
    ok: login.ok,
    sessionId: login.body?.session?.sessionId || '',
  });
  if (!login.ok || !login.body?.session?.sessionId) throw new Error('Login failed.');

  const prepare = await request('/assets/upload-url', {
    method: 'POST',
    body: JSON.stringify({
      filename: 'rehearsal-upload.txt',
      mimeType: 'text/plain',
      requestedName: `Upload Rehearsal ${isoNowSuffix()}`,
      sizeBytes: 32,
      accessScope: 'client',
      tags: ['rehearsal', 'upload-completion'],
    }),
  });
  const upload = prepare.body?.upload || null;
  checks.push({
    step: 'prepare-upload',
    status: prepare.status,
    ok: prepare.ok,
    assetId: upload?.assetId || '',
    storageKey: upload?.storageKey || '',
  });
  if (!prepare.ok || !upload?.uploadUrl) throw new Error('Upload preparation failed.');

  const directUpload = await uploadBinaryToSignedUrl(
    upload.uploadUrl,
    upload.mimeType || 'text/plain',
    `upload-rehearsal-${Date.now()}`,
  );
  checks.push({
    step: 'put-object',
    status: directUpload.status,
    ok: directUpload.ok,
  });
  if (!directUpload.ok) throw new Error('Direct upload to signed URL failed.');

  const complete = await request('/assets/complete-upload', {
    method: 'POST',
    body: JSON.stringify({
      assetId: upload.assetId,
      name: upload.name,
      kind: upload.kind,
      mimeType: upload.mimeType,
      sourceType: 'upload',
      storageMode: upload.storageMode,
      storageKey: upload.storageKey,
      publicUrl: upload.publicUrl,
      accessScope: upload.accessScope,
      tags: upload.tags,
      folderId: upload.folderId,
      sizeBytes: upload.sizeBytes,
      fontFamily: upload.fontFamily,
    }),
  });
  const completedAssetId = complete.body?.asset?.id || upload.assetId;
  checks.push({
    step: 'complete-upload',
    status: complete.status,
    ok: complete.ok,
    assetId: completedAssetId || '',
  });
  if (!complete.ok || !completedAssetId) throw new Error('Upload completion failed.');

  const fetchAsset = await request(`/assets/${completedAssetId}`);
  checks.push({
    step: 'fetch-asset',
    status: fetchAsset.status,
    ok: fetchAsset.ok,
    found: Boolean(fetchAsset.body?.asset),
    storageMode: fetchAsset.body?.asset?.storageMode || '',
  });
  if (!fetchAsset.ok || !fetchAsset.body?.asset) throw new Error('Completed asset fetch failed.');

  const remove = await request(`/assets/${completedAssetId}?purge=1`, {
    method: 'DELETE',
  });
  checks.push({
    step: 'delete-uploaded-asset',
    status: remove.status,
    ok: remove.ok,
  });
  if (!remove.ok) throw new Error('Uploaded asset cleanup failed.');

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
    checks,
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
