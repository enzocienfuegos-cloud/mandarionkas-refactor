const baseUrl = String(process.env.SMOKE_BASE_URL || '').replace(/\/+$/, '');
const endpoints = ['/', '/healthz', '/readyz', '/version', '/v1/auth/health', '/v1/assets/health'];

async function main() {
  if (!baseUrl) {
    throw new Error('Missing SMOKE_BASE_URL for smoke-check.');
  }
  const results = [];
  for (const path of endpoints) {
    const url = `${baseUrl}${path}`;
    const response = await fetch(url, { method: path === '/v1/assets/health' ? 'POST' : 'GET' });
    const text = await response.text();
    results.push({ path, status: response.status, ok: response.ok, bodyPreview: text.slice(0, 240) });
  }
  const failed = results.filter((entry) => !entry.ok);
  console.log(JSON.stringify({ baseUrl, ok: failed.length === 0, results }, null, 2));
  if (failed.length) process.exitCode = 1;
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, message: error.message, stack: error.stack }, null, 2));
  process.exitCode = 1;
});
