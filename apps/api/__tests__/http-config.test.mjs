import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  buildCorsOriginMatcher,
  buildSessionCookieOptions,
  parseCorsOrigins,
} from '../src/config/http.mjs';

describe('http config helpers', () => {
  it('parses comma-separated CORS origins', () => {
    assert.deepEqual(
      parseCorsOrigins('https://app.example.com, https://studio.example.com'),
      ['https://app.example.com', 'https://studio.example.com'],
    );
  });

  it('allows configured origins and requests without Origin headers', async () => {
    const matcher = buildCorsOriginMatcher('https://app.example.com,https://studio.example.com');

    await new Promise((resolve, reject) => {
      matcher('https://studio.example.com', (error, allowed) => {
        try {
          assert.equal(error, null);
          assert.equal(allowed, true);
          resolve();
        } catch (err) {
          reject(err);
        }
      });
    });

    await new Promise((resolve, reject) => {
      matcher(undefined, (error, allowed) => {
        try {
          assert.equal(error, null);
          assert.equal(allowed, true);
          resolve();
        } catch (err) {
          reject(err);
        }
      });
    });
  });

  it('rejects origins that are not allow-listed', async () => {
    const matcher = buildCorsOriginMatcher('https://app.example.com');

    await new Promise((resolve, reject) => {
      matcher('https://evil.example.com', (error, allowed) => {
        try {
          assert.ok(error instanceof Error);
          assert.equal(allowed, false);
          resolve();
        } catch (err) {
          reject(err);
        }
      });
    });
  });

  it('builds cookie options with optional domain override', () => {
    const options = buildSessionCookieOptions({
      NODE_ENV: 'production',
      SESSION_COOKIE_SAME_SITE: 'none',
      SESSION_COOKIE_DOMAIN: '.duskplatform.co',
    });

    assert.deepEqual(options, {
      secure: true,
      httpOnly: true,
      sameSite: 'none',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      domain: '.duskplatform.co',
    });
  });
});
