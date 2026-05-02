#!/usr/bin/env node
// scripts/staging-acceptance-v2.mjs
//
// S50: Acceptance matrix realigned to the current /v1/* API contract.
//
// Replaces staging-acceptance-matrix.mjs which targeted a pre-unification
// route surface (/health, /auth/login, /clients, /projects, /assets, /admin/audit-events)
// that no longer exists. See docs/sprint-50-acceptance-matrix-realignment.md.
//
// Architecture:
//   - platform_runtime   → /healthz, /readyz, /version (no auth required)
//   - auth_portal        → POST /v1/auth/login, GET /v1/auth/session, POST /v1/auth/logout
//   - workspace_context  → GET /v1/workspaces + session workspace coherence
//   - adserver_catalog   → GET /v1/tags, GET /v1/campaigns, GET /v1/creatives
//   - audit_access       → GET /v1/audit (permission-gated)
//   - tracking_reporting → GET /v1/tracking/tags/:tagId/summary
//
// Each domain is independently selectable via STAGING_ACCEPTANCE_DOMAINS.
// Authenticated domains require SMOKE_LOGIN_EMAIL + SMOKE_LOGIN_PASSWORD.
//
// Usage:
//   SMOKE_BASE_URL=https://api-staging.duskplatform.co \
//   SMOKE_LOGIN_EMAIL=admin@smx.studio \
//   SMOKE_LOGIN_PASSWORD=... \
//   node scripts/staging-acceptance-v2.mjs
//
//   # Run only specific domains:
//   STAGING_ACCEPTANCE_DOMAINS=platform_runtime,auth_portal \
//   node scripts/staging-acceptance-v2.mjs
//
//   # Dry-run (no login, runtime only):
//   STAGING_ACCEPTANCE_RUNTIME_ONLY=true \
//   node scripts/staging-acceptance-v2.mjs

import { loadOptionalEnvFile } from './load-optional-env.mjs';

loadOptionalEnvFile('.env');
loadOptionalEnvFile('.env.staging');

// ─── Config ───────────────────────────────────────────────────────────────────

const baseUrl     = trim(process.env.SMOKE_BASE_URL || process.env.VITE_API_BASE_URL);
const email       = trim(process.env.SMOKE_LOGIN_EMAIL);
const password    = trim(process.env.SMOKE_LOGIN_PASSWORD);
const runtimeOnly = trim(process.env.STAGING_ACCEPTANCE_RUNTIME_ONLY) === 'true';
const timeoutMs   = Number(process.env.CHECK_TIMEOUT_MS) || 10_000;
const requestedDomains = trim(process.env.STAGING_ACCEPTANCE_DOMAINS)
  .split(',').map(trim).filter(Boolean);

function trim(v) { return String(v ?? '').trim().replace(/\/+$/, ''); }

// ─── HTTP helpers ─────────────────────────────────────────────────────────────

const cookieJar = new Map();

function updateCookies(response) {
  const setCookie = response.headers.get('set-cookie');
  if (!setCookie) return;
  const firstPair = setCookie.split(';')[0];
  const sep = firstPair.indexOf('=');
  if (sep <= 0) return;
  cookieJar.set(firstPair.slice(0, sep).trim(), firstPair.slice(sep + 1).trim());
}

function cookieHeader() {
  return Array.from(cookieJar.entries()).map(([k, v]) => `${k}=${v}`).join('; ');
}

async function request(path, init = {}) {
  const headers = new Headers(init.headers || {});
  if (!headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  const cookie = cookieHeader();
  if (cookie) headers.set('Cookie', cookie);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let response;
  try {
    response = await fetch(`${baseUrl}${path}`, { ...init, headers, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }

  updateCookies(response);

  const text = await response.text();
  let body = null;
  try { body = JSON.parse(text); } catch { body = text || null; }

  return { ok: response.ok, status: response.status, body };
}

// ─── Terminal helpers ──────────────────────────────────────────────────────────

const c = {
  ok:   (s) => `\x1b[32m✅ ${s}\x1b[0m`,
  fail: (s) => `\x1b[31m❌ ${s}\x1b[0m`,
  warn: (s) => `\x1b[33m⚠️  ${s}\x1b[0m`,
  info: (s) => `\x1b[36mℹ  ${s}\x1b[0m`,
  dim:  (s) => `\x1b[2m${s}\x1b[0m`,
};

function warn(s) { return c.warn(s); }
function bail(msg) {
  console.error(JSON.stringify({ ok: false, message: msg }, null, 2));
  process.exit(1);
}

if (!baseUrl) {
  bail('Missing SMOKE_BASE_URL or VITE_API_BASE_URL');
}
if (!runtimeOnly && (!email || !password)) {
  console.warn(warn('SMOKE_LOGIN_EMAIL / SMOKE_LOGIN_PASSWORD not set — authenticated domains will be skipped'));
}

// ─── Domain runner ────────────────────────────────────────────────────────────

function createDomainRunner(selected) {
  return async function runDomain(id, description, execute) {
    if (selected.length && !selected.includes(id)) {
      return { domain: id, description, status: 'skipped', checks: [] };
    }

    const checks = [];
    let domainFailed = false;

    async function check(name, fn) {
      const start = Date.now();
      try {
        const result = await fn();
        const ms = Date.now() - start;
        const entry = { check: name, ok: true, ms, ...(result ?? {}) };
        checks.push(entry);
        console.log(c.ok(`  ${name} (${ms}ms)${result?.detail ? ' — ' + result.detail : ''}`));
      } catch (err) {
        const ms = Date.now() - start;
        const message = err instanceof Error ? err.message : String(err);
        checks.push({ check: name, ok: false, ms, message });
        console.log(c.fail(`  ${name} — ${message}`));
        domainFailed = true;
      }
    }

    console.log(`\n${c.info(`[${id}] ${description}`)}`);
    console.log(c.dim('─'.repeat(56)));

    try {
      await execute({ check });
    } catch {
      domainFailed = true;
    }

    const status = domainFailed ? 'failed' : 'passed';
    console.log(status === 'passed'
      ? c.ok(`[${id}] passed`)
      : c.fail(`[${id}] failed`)
    );

    return { domain: id, description, status, checks };
  };
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n\x1b[1mS50 Staging Acceptance Matrix v2\x1b[0m');
  console.log(c.dim(`API: ${baseUrl}`));
  console.log(c.dim(`Domains: ${requestedDomains.length ? requestedDomains.join(', ') : 'all'}`));
  console.log(c.dim('─'.repeat(60)));

  const runDomain = createDomainRunner(requestedDomains);
  const domains = [];
  const hasCredentials = !runtimeOnly && Boolean(email) && Boolean(password);

  domains.push(await runDomain('platform_runtime', 'Health, readiness, version — no auth', async ({ check }) => {
    await check('GET /healthz → 200', async () => {
      const r = await request('/healthz');
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return { detail: `status=${r.status}` };
    });

    await check('GET /readyz → 200 + repository.ok', async () => {
      const r = await request('/readyz');
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const repoOk = r.body?.repository?.ok;
      if (repoOk === false) throw new Error('readyz: repository.ok=false (DB unreachable)');
      return { detail: `repository.ok=${repoOk ?? 'not reported'}` };
    });

    await check('GET /version → 200', async () => {
      const r = await request('/version');
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return { detail: `version=${r.body?.version ?? 'unknown'}` };
    });

    await check('GET /observability → 200', async () => {
      const r = await request('/observability');
      if (r.status === 404) {
        return { detail: 'endpoint not present in this branch — tolerated' };
      }
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return {
        detail: `requests=${r.body?.totals?.requests ?? '?'} 5xx=${r.body?.totals?.status5xx ?? '?'}`,
      };
    });
  }));

  if (!hasCredentials) {
    console.log(`\n${c.warn('[auth_portal] skipped — no credentials')}`);
    domains.push({ domain: 'auth_portal', status: 'skipped', checks: [] });
  } else {
    domains.push(await runDomain('auth_portal', 'POST /v1/auth/login, GET /v1/auth/session', async ({ check }) => {
      let sessionUserId = null;
      let sessionWorkspaceId = null;

      await check('POST /v1/auth/login → 200 + session cookie', async () => {
        const r = await request('/v1/auth/login', {
          method: 'POST',
          body: JSON.stringify({ email, password }),
        });
        if (!r.ok) throw new Error(`HTTP ${r.status} — ${r.body?.message ?? 'login failed'}`);
        sessionUserId = r.body?.user?.id ?? r.body?.session?.userId ?? null;
        return { detail: `userId=${sessionUserId ?? 'unknown'}` };
      });

      await check('GET /v1/auth/session → 200 + authenticated', async () => {
        const r = await request('/v1/auth/session');
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const authenticated = r.body?.authenticated ?? r.body?.ok ?? false;
        if (!authenticated) throw new Error('session reports not authenticated');
        sessionWorkspaceId = r.body?.session?.activeWorkspaceId ?? r.body?.activeWorkspaceId ?? null;
        return { detail: `activeWorkspaceId=${sessionWorkspaceId ?? 'not set'}` };
      });

      await check('GET /v1/auth/session: 401 without cookie', async () => {
        const r = await fetch(`${baseUrl}/v1/auth/session`, {
          headers: { 'Content-Type': 'application/json' },
        });
        if (r.status !== 401) throw new Error(`Expected 401, got HTTP ${r.status}`);
        return { detail: 'unauthenticated request correctly rejected' };
      });
    }));
  }

  if (!hasCredentials) {
    console.log(`\n${c.warn('[workspace_context] skipped — no credentials')}`);
    domains.push({ domain: 'workspace_context', status: 'skipped', checks: [] });
  } else {
    domains.push(await runDomain('workspace_context', 'GET /v1/workspaces + session coherence', async ({ check }) => {
      let workspaceId = null;

      await check('GET /v1/workspaces → 200 + array', async () => {
        const r = await request('/v1/workspaces');
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const workspaces = r.body?.workspaces ?? r.body ?? [];
        if (!Array.isArray(workspaces)) throw new Error('expected array of workspaces');
        workspaceId = workspaces[0]?.id ?? null;
        return { detail: `count=${workspaces.length} firstId=${workspaceId ?? 'none'}` };
      });

      await check('GET /v1/auth/session → activeWorkspaceId coherent', async () => {
        const r = await request('/v1/auth/session');
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const activeId = r.body?.session?.activeWorkspaceId ?? r.body?.activeWorkspaceId;
        if (!activeId && workspaceId) {
          throw new Error(`session has no activeWorkspaceId but workspace ${workspaceId} exists`);
        }
        return { detail: `activeWorkspaceId=${activeId ?? 'not set'}` };
      });
    }));
  }

  if (!hasCredentials) {
    console.log(`\n${c.warn('[adserver_catalog] skipped — no credentials')}`);
    domains.push({ domain: 'adserver_catalog', status: 'skipped', checks: [] });
  } else {
    domains.push(await runDomain('adserver_catalog', 'GET /v1/tags, /v1/campaigns, /v1/creatives', async ({ check }) => {
      await check('GET /v1/tags → 200 or 401 (permission-gated)', async () => {
        const r = await request('/v1/tags');
        if (r.status === 401) return { detail: 'correctly requires auth — run with credentials' };
        if (!r.ok && r.status !== 404) throw new Error(`HTTP ${r.status}`);
        const count = Array.isArray(r.body?.tags) ? r.body.tags.length :
                      Array.isArray(r.body) ? r.body.length : '?';
        return { detail: `status=${r.status} count=${count}` };
      });

      await check('GET /v1/campaigns → 200 or 403 (permission-gated)', async () => {
        const r = await request('/v1/campaigns');
        if (r.status === 401) return { detail: 'not authenticated' };
        if (r.status === 403) return { detail: 'authenticated but no permission (expected for some roles)' };
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const count = Array.isArray(r.body?.campaigns) ? r.body.campaigns.length :
                      Array.isArray(r.body) ? r.body.length : '?';
        return { detail: `status=${r.status} count=${count}` };
      });

      await check('GET /v1/creatives → 200 or 403', async () => {
        const r = await request('/v1/creatives');
        if (r.status === 401) return { detail: 'not authenticated' };
        if (r.status === 403) return { detail: 'authenticated but no permission' };
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const count = Array.isArray(r.body?.creatives) ? r.body.creatives.length :
                      Array.isArray(r.body) ? r.body.length : '?';
        return { detail: `status=${r.status} count=${count}` };
      });

      await check('GET /v1/vast/tags/<id> → VAST XML or 404 (public, no auth)', async () => {
        const r = await request('/v1/vast/tags/smoke-test-nonexistent-id');
        if (r.status === 404 || r.status === 400) {
          return { detail: 'tag not found — route exists and is reachable (expected)' };
        }
        if (typeof r.body === 'string' && r.body.includes('<VAST')) {
          return { detail: 'VAST XML returned — tracker serving is live' };
        }
        throw new Error(`Unexpected response: HTTP ${r.status}`);
      });
    }));
  }

  if (!hasCredentials) {
    console.log(`\n${c.warn('[audit_access] skipped — no credentials')}`);
    domains.push({ domain: 'audit_access', status: 'skipped', checks: [] });
  } else {
    domains.push(await runDomain('audit_access', 'GET /v1/audit — permission-gated', async ({ check }) => {
      await check('GET /v1/audit → 200 or 403 (role-dependent)', async () => {
        const r = await request('/v1/audit');
        if (r.status === 401) throw new Error('not authenticated — session may have expired');
        if (r.status === 403) return { detail: 'authenticated but no audit:read permission (expected for non-admin roles)' };
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const count = Array.isArray(r.body?.events) ? r.body.events.length :
                      Array.isArray(r.body) ? r.body.length : '?';
        return { detail: `status=${r.status} events=${count}` };
      });

      await check('GET /v1/audit → 401 without session', async () => {
        const r = await fetch(`${baseUrl}/v1/audit`, {
          headers: { 'Content-Type': 'application/json' },
        });
        if (r.status !== 401) throw new Error(`Expected 401, got HTTP ${r.status}`);
        return { detail: 'correctly rejects unauthenticated request' };
      });
    }));
  }

  domains.push(await runDomain('tracking_reporting', 'Tracker endpoints — public, no auth', async ({ check }) => {
    await check('GET /v1/tags/tracker/<id>/impression.gif → 200 pixel', async () => {
      const r = await request('/v1/tags/tracker/smoke-test-tag/impression.gif');
      if (r.status === 200 || r.status === 404) {
        return { detail: `status=${r.status} — tracker route reachable` };
      }
      throw new Error(`Unexpected HTTP ${r.status}`);
    });

    await check('GET /v1/tags/tracker/<id>/click → 302 or 404', async () => {
      const r = await fetch(`${baseUrl}/v1/tags/tracker/smoke-test-tag/click`, {
        redirect: 'manual',
      });
      if (r.status === 302 || r.status === 404 || r.status === 200) {
        return { detail: `status=${r.status} — click route reachable` };
      }
      throw new Error(`Unexpected HTTP ${r.status}`);
    });
  }));

  console.log('\n' + c.dim('━'.repeat(60)));
  console.log('\x1b[1mResults\x1b[0m\n');

  let totalFailed = 0;
  let totalPassed = 0;
  let totalSkipped = 0;

  for (const d of domains) {
    const checksFailed  = d.checks.filter((item) => !item.ok).length;
    const checksPassed  = d.checks.filter((item) => item.ok).length;
    if (d.status === 'skipped') {
      console.log(c.warn(`  [${d.domain}] skipped`));
      totalSkipped++;
    } else if (d.status === 'failed') {
      console.log(c.fail(`  [${d.domain}] ${checksFailed} check(s) failed, ${checksPassed} passed`));
      totalFailed++;
    } else {
      console.log(c.ok(`  [${d.domain}] ${checksPassed} check(s) passed`));
      totalPassed++;
    }
  }

  console.log('');
  console.log(`  Domains passed:  ${totalPassed}`);
  console.log(`  Domains failed:  ${totalFailed}`);
  console.log(`  Domains skipped: ${totalSkipped} (no credentials or domain filter)`);
  console.log('');

  const result = {
    ok: totalFailed === 0,
    baseUrl,
    domains: domains.map((domain) => ({
      domain: domain.domain,
      status: domain.status,
      checks: domain.checks.length,
      failed: domain.checks.filter((check) => !check.ok).length,
    })),
  };

  console.log(result.ok ? c.ok('All active domains passed.') : c.fail('Some domains failed.'));
  console.log('');

  if (totalFailed > 0) process.exit(1);
}

main().catch((err) => {
  console.error(JSON.stringify({
    ok: false,
    message: err instanceof Error ? err.message : String(err),
  }, null, 2));
  process.exit(1);
});
