import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const CREATIVES_FILE = new URL('./creatives.mjs', import.meta.url);

test('createPublishedCreative uses the transaction client supplied by the caller', async () => {
  const source = await readFile(CREATIVES_FILE, 'utf8');
  const start = source.indexOf('export async function createPublishedCreative(');
  const end = source.indexOf('export async function finalizePublishedHtml5Version(');
  const publishSource = source.slice(start, end);

  assert.match(publishSource, /export async function createPublishedCreative\(client, input = \{\}\)/);
  assert.doesNotMatch(publishSource, /\bpool\b/, 'createPublishedCreative must not use the shared pool internally');
  assert.match(publishSource, /client\.query\(/, 'createPublishedCreative must issue queries through the provided client');
  assert.match(publishSource, /regenerateVideoRenditions\(client,/);
  assert.match(publishSource, /queueVideoTranscodeForCreativeVersion\(client,/);
  assert.match(publishSource, /updateCreativeIngestion\(client,/);
  assert.match(publishSource, /getCreative\(client,/);
  assert.match(publishSource, /getCreativeVersion\(client,/);
});
