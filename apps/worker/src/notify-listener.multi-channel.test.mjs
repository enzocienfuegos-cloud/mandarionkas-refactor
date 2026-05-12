import test from 'node:test';
import assert from 'node:assert/strict';

import { createNotificationHandler } from './notify-listener.mjs';

test('notify listener bridges transcode and HTML5 publish channels', async () => {
  const calls = [];
  const handler = createNotificationHandler({
    'smx.transcode-video': {
      payloadKey: 'creativeVersionId',
      send: async (payload) => {
        calls.push({ channel: 'smx.transcode-video', payload });
        return 'job-transcode';
      },
    },
    'smx.publish-html5-archive': {
      payloadKey: 'ingestionId',
      send: async (payload) => {
        calls.push({ channel: 'smx.publish-html5-archive', payload });
        return 'job-html5';
      },
    },
  });

  await handler({ channel: 'smx.transcode-video', payload: 'creative-version-1' });
  await handler({ channel: 'smx.publish-html5-archive', payload: 'ingestion-1' });
  await handler({ channel: 'unknown-channel', payload: 'ignored' });
  await handler({ channel: 'smx.transcode-video', payload: '' });

  assert.deepEqual(calls, [
    { channel: 'smx.transcode-video', payload: 'creative-version-1' },
    { channel: 'smx.publish-html5-archive', payload: 'ingestion-1' },
  ]);
});
