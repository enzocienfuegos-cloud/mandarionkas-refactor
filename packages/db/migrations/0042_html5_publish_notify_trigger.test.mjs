import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const MIGRATION_FILE = new URL('./0042_html5_publish_notify_trigger.sql', import.meta.url);

test('0042 creates the HTML5 publish NOTIFY trigger', async () => {
  const sql = await readFile(MIGRATION_FILE, 'utf8');

  assert.match(sql, /CREATE OR REPLACE FUNCTION notify_html5_publish_pending\(\)/);
  assert.match(sql, /NEW\.status = 'processing'/);
  assert.match(sql, /NEW\.source_kind = 'html5_zip'/);
  assert.match(sql, /NEW\.creative_version_id IS NOT NULL/);
  assert.match(sql, /pg_notify\('smx\.publish-html5-archive', NEW\.id::text\)/);
  assert.match(sql, /CREATE TRIGGER trg_html5_publish_notify/);
  assert.match(sql, /AFTER INSERT OR UPDATE ON creative_ingestions/);
  assert.match(sql, /EXECUTE FUNCTION notify_html5_publish_pending\(\)/);
});
