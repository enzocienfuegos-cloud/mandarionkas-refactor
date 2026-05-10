
// ═══════════════════════════════════════════════════════════════════════════
// S50 — Permission Hardening: session.mjs centralization
// ═══════════════════════════════════════════════════════════════════════════

async function auditS50() {
  console.log('\x1b[1m\x1b[37m\n── S50: Permission Hardening ──────────────────────────────\x1b[0m');

  // Check that public endpoints still work (health, readyz)
  const healthRes = await rawFetch(`${API_URL}/healthz`).catch(() => null);
  healthRes?.ok
    ? console.log('\x1b[32m✅ [S50] /healthz still accessible without auth\x1b[0m')
    : console.log('\x1b[31m❌ [S50] /healthz unreachable\x1b[0m');

  // Check that protected endpoints return 401 without auth
  const protectedEndpoints = [
    '/v1/campaigns',
    '/v1/tags',
    '/v1/assets',
    '/v1/projects',
  ];
  for (const endpoint of protectedEndpoints) {
    const res = await rawFetch(`${API_URL}${endpoint}`).catch(() => null);
    if (res?.status === 401) {
      console.log(`\x1b[32m✅ [S50] ${endpoint} returns 401 without auth\x1b[0m`);
    } else if (res?.status === 200) {
      console.log(`\x1b[31m❌ [S50] ${endpoint} accessible without auth! (status=${res.status})\x1b[0m`);
      failures++;
    } else {
      console.log(`\x1b[33m⚠️  [S50] ${endpoint} returned ${res?.status} (expected 401)\x1b[0m`);
    }
  }
}
