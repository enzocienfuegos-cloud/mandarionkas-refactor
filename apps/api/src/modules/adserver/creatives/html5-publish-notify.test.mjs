import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const ROUTES_FILE = new URL('./routes.mjs', import.meta.url);

test('HTML5 publish route relies on NOTIFY trigger instead of direct pg-boss insert', async () => {
  const source = await readFile(ROUTES_FILE, 'utf8');
  const start = source.indexOf("if (method === 'POST' && /^\\/v1\\/creative-ingestions\\/[^/]+\\/publish$/.test(pathname))");
  const end = source.indexOf("if (method === 'POST' && /^\\/v1\\/creative-versions\\/[^/]+\\/assign\\/[^/]+$/.test(pathname))");
  const publishRoute = source.slice(start, end);

  assert.doesNotMatch(source, /job-dispatch\.mjs/);
  assert.doesNotMatch(source, /dispatchHtml5ArchivePublishJob/);
  assert.match(publishRoute, /html5_publish_dispatched_via_notify/);
  assert.doesNotMatch(publishRoute, /html5_publish_pgboss_unavailable/);
});
