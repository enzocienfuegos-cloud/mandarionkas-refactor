#!/usr/bin/env node
// scripts/validate-portal-cutover.mjs
//
// S43: End-to-end validation of the portal cutover.
//
// Usage:
//   PORTAL_URL=https://portal.YOUR_DOMAIN.com \
//   API_URL=https://api.YOUR_DOMAIN.com \
//   WEB_URL=https://app.YOUR_DOMAIN.com \
//   node scripts/validate-portal-cutover.mjs
//
// Exit codes: 0 = all passed, 1 = failures found

const PORTAL_URL = (process.env.PORTAL_URL || '').replace(/\/$/, '');
const API_URL    = (process.env.API_URL    || process.env.SMOKE_BASE_URL || '').replace(/\/$/, '');
const WEB_URL    = (process.env.WEB_URL    || '').replace(/\/$/, '');
const TIMEOUT_MS = Number(process.env.CHECK_TIMEOUT_MS) || 10_000;

if (!PORTAL_URL || !API_URL) {
  console.error('ERROR: PORTAL_URL and API_URL (or SMOKE_BASE_URL) are required.');
  process.exit(1);
}

const ok   = (s) => `\x1b[32m✅ ${s}\x1b[0m`;
const fail = (s) => `\x1b[31m❌ ${s}\x1b[0m`;
const warn = (s) => `\x1b[33m⚠️  ${s}\x1b[0m`;
const info = (s) => `\x1b[36mℹ  ${s}\x1b[0m`;

let failures = 0;

const pass  = (l, d) => console.log(ok(`${l}${d ? ' — ' + d : ''}`));
const rfail = (l, d) => { console.log(fail(`${l}${d ? ' — ' + d : ''}`)); failures++; };
const rwarn = (l, d) => console.log(warn(`${l}${d ? ' — ' + d : ''}`));

async function fetchT(url, opts = {}) {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), TIMEOUT_MS);
  try { return await fetch(url, { signal: c.signal, ...opts }); }
  finally { clearTimeout(t); }
}

async function main() {
  console.log(`\nS43 Portal Cutover Validation`);
  console.log(`Portal: ${PORTAL_URL}`);
  console.log(`API:    ${API_URL}`);
  if (WEB_URL) console.log(`Web:    ${WEB_URL}`);
  console.log('─'.repeat(60) + '\n');

  // API health
  const health = await fetchT(`${API_URL}/healthz`).catch(() => null);
  health?.ok ? pass('API health OK', `status=${health.status}`) : rfail('API health', 'unreachable');

  // Readyz
  const readyz = await fetchT(`${API_URL}/readyz`).catch(() => null);
  readyz?.ok ? pass('API readyz OK') : rfail('API readyz failed');

  // CORS: portal origin allowed
  const corsRes = await fetchT(`${API_URL}/v1/auth/session`, {
    headers: { Origin: PORTAL_URL, 'Content-Type': 'application/json' },
  }).catch(() => null);
  const allowOrigin = corsRes?.headers?.get('access-control-allow-origin');
  const allowCreds  = corsRes?.headers?.get('access-control-allow-credentials');
  if (allowOrigin === PORTAL_URL || allowOrigin === '*') {
    pass('CORS allows portal origin', `Access-Control-Allow-Origin: ${allowOrigin}`);
  } else if (!allowOrigin) {
    rfail('CORS allows portal origin', 'No ACAO header — PLATFORM_ALLOWED_ORIGIN not set to portal domain');
  } else {
    rfail('CORS allows portal origin', `Expected ${PORTAL_URL}, got ${allowOrigin}`);
  }
  allowCreds === 'true'
    ? pass('CORS: Allow-Credentials=true')
    : rwarn('CORS: Allow-Credentials not true', 'Cookie auth may not work cross-origin');

  // Placeholder NOT active
  const placeholderRes = await fetchT(`${API_URL}/v1/auth/session`, {
    headers: { Origin: 'https://portal.example.com' },
  }).catch(() => null);
  placeholderRes?.headers?.get('access-control-allow-origin') === 'https://portal.example.com'
    ? rfail('Placeholder origin NOT active', 'API still allows portal.example.com — PLATFORM_ALLOWED_ORIGIN is a placeholder!')
    : pass('Placeholder origin NOT active');

  // Session shape
  let sessionBody = null;
  try { sessionBody = await corsRes?.json(); } catch {}
  typeof sessionBody?.authenticated === 'boolean'
    ? pass('Session endpoint shape valid', `authenticated=${sessionBody.authenticated}`)
    : rfail('Session endpoint shape', 'Missing authenticated field');

  // Portal reachable
  const portalRes = await fetchT(PORTAL_URL).catch(() => null);
  portalRes?.ok
    ? pass('Portal reachable', `status=${portalRes.status}`)
    : rfail('Portal reachable', portalRes ? `status=${portalRes.status}` : 'Connection failed');

  // Web app
  if (WEB_URL) {
    const webRes = await fetchT(WEB_URL).catch(() => null);
    webRes?.ok ? pass('Ad Server web app reachable') : rfail('Ad Server web app', `status=${webRes?.status}`);
  }

  // Observability
  const obsRes = await fetchT(`${API_URL}/observability`).catch(() => null);
  if (obsRes?.ok) {
    const obsBody = await obsRes.json().catch(() => null);
    pass('Observability endpoint OK');
    if (obsBody?.repositoryDriver === 'postgres') pass('Repository driver: postgres');
    else if (obsBody?.repositoryDriver) rfail('Repository driver', `Expected postgres, got ${obsBody.repositoryDriver}`);
  } else if (obsRes?.status === 401 || obsRes?.status === 403) {
    pass('Observability requires auth (OK)');
  } else {
    rwarn('Observability endpoint', `status=${obsRes?.status}`);
  }

  console.log('\n' + '─'.repeat(60));
  if (failures > 0) {
    console.log(fail(`FAILED — ${failures} check(s) failed. Fix before DNS cutover.`));
    process.exit(1);
  } else {
    console.log(ok('PASSED — Portal cutover validation complete.'));
    console.log('\nNext: run npm run staging:acceptance:matrix\n');
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
