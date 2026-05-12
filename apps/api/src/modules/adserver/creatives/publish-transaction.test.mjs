import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const ROUTES_FILE = new URL('./routes/router-ingestions.mjs', import.meta.url);

test('creative publish route wraps foreground and background publishing in transactions', async () => {
  const source = await readFile(ROUTES_FILE, 'utf8');
  const start = source.indexOf("if (method === 'POST' && /^\\/v1\\/creative-ingestions\\/[^/]+\\/publish$/.test(pathname))");
  const end = source.indexOf("if (method === 'POST' && /^\\/v1\\/creative-versions\\/[^/]+\\/assign\\/[^/]+$/.test(pathname))");
  const publishRoute = source.slice(start, end);

  assert.match(source, /\bwithTransaction\b/);
  assert.match(publishRoute, /const\s+client\s*=\s*await\s+pool\.connect\(\);/);
  assert.match(publishRoute, /withTransaction\(client,\s*\(tx\)\s*=>\s*\n\s*createPublishedCreative\(tx,/);
  assert.match(publishRoute, /finally\s*\{\s*\n\s*client\.release\(\);/);
  assert.match(publishRoute, /withTransaction\(session\.client,\s*\(tx\)\s*=>\s*\n\s*createPublishedCreative\(tx,/);
  assert.doesNotMatch(publishRoute, /createPublishedCreative\(pool,/);
  assert.doesNotMatch(publishRoute, /createPublishedCreative\(session\.client,/);
});
