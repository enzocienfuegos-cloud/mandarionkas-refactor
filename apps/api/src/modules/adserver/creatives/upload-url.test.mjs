import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const ROUTES_FILE = new URL('./routes/router-ingestions.mjs', import.meta.url);

test('upload-url response exposes presigned primary path and API proxy fallback', async () => {
  const source = await readFile(ROUTES_FILE, 'utf8');
  const start = source.indexOf("if (method === 'POST' && pathname === '/v1/creative-ingestions/upload-url')");
  const end = source.indexOf("if (method === 'POST' && /^\\/v1\\/creative-ingestions\\/[^/]+\\/upload-proxy$/.test(pathname))");
  const uploadUrlHandler = source.slice(start, end);

  assert.match(uploadUrlHandler, /const\s+uploadProxyUrl\s*=\s*buildCreativeUploadProxyUrl\(ctx,\s*ingestionId,\s*workspaceId\);/);
  assert.match(uploadUrlHandler, /const\s+presignedUrl\s*=\s*await\s+signUploadUrl\(ctx\.env,/);
  assert.match(uploadUrlHandler, /presignedUrl:\s*presignedUrl\s*\?\?\s*null/);
  assert.match(uploadUrlHandler, /presignedMethod:\s*'PUT'/);
  assert.match(uploadUrlHandler, /presignedExpiresAt:/);
  assert.match(uploadUrlHandler, /proxyUrl:\s*uploadProxyUrl/);
  assert.match(uploadUrlHandler, /proxyMethod:\s*'POST'/);
  assert.match(uploadUrlHandler, /uploadUrl:\s*uploadProxyUrl/);
  assert.match(uploadUrlHandler, /uploadMethod:\s*'POST'/);
});
