import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const ROUTES_FILE = new URL('./routes/router-ingestions.mjs', import.meta.url);

test('upload proxy handler reads from the request object provided by route context', async () => {
  const source = await readFile(ROUTES_FILE, 'utf8');

  assert.match(
    source,
    /const\s+\{\s*method,\s*pathname,\s*req,\s*res,\s*requestId,\s*url\s*\}\s*=\s*ctx;/,
    'handleCreativeIngestionRoutes must destructure req from ctx',
  );
  assert.match(source, /readBinaryBody\(req\)/, 'upload-proxy must pass req into readBinaryBody');
  assert.match(source, /req\.headers\['content-type'\]/, 'upload-proxy must read content-type from req.headers');
  assert.doesNotMatch(source, /readBinaryBody\(request\)/, 'upload-proxy must not reference an undefined request variable');
  assert.doesNotMatch(source, /request\.headers\['content-type'\]/, 'upload-proxy must not reference undefined request.headers');
});

test('upload URL creates pending ingestions and proxy completion marks them uploaded', async () => {
  const source = await readFile(ROUTES_FILE, 'utf8');
  const uploadUrlHandler = source.slice(
    source.indexOf("pathname === '/v1/creative-ingestions/upload-url'"),
    source.indexOf("if (method === 'POST' && /^\\/v1\\/creative-ingestions\\/[^/]+\\/upload-proxy$/.test(pathname))"),
  );
  const uploadProxyHandler = source.slice(
    source.indexOf("if (method === 'POST' && /^\\/v1\\/creative-ingestions\\/[^/]+\\/upload-proxy$/.test(pathname))"),
    source.indexOf("if (method === 'POST' && /^\\/v1\\/creative-ingestions\\/[^/]+\\/complete$/.test(pathname))"),
  );

  assert.match(uploadUrlHandler, /status:\s*'pending_upload'/);
  assert.match(uploadProxyHandler, /status:\s*'uploaded'/);
});
