import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildTagSnippet, buildDisplayIframeSnippet } from './tag-snippets.mjs';
import { listSupportedDsps } from './dsp-macros.mjs';

const BASE = 'https://api-staging.duskplatform.co';
const TAG = { id: '11111111-1111-1111-1111-111111111111', format: 'display', width: 300, height: 250 };

test('display-js non-Basis: contains async script tag', () => {
  const out = buildTagSnippet(TAG, 'display-js', BASE, '', null);
  assert.ok(out.includes('<script src='), 'should have script tag');
  assert.ok(out.includes('async'), 'should be async');
  assert.ok(out.includes('/v1/tags/display/'), 'should have display path');
  assert.ok(!out.includes('portal-staging'), 'should not have wrong host');
});

test('display-iframe: has sandbox attribute', () => {
  const out = buildDisplayIframeSnippet({ displayHtmlUrl: `${BASE}/v1/tags/display/x.html`, width: 300, height: 250 });
  assert.ok(out.includes('allow-top-navigation-by-user-activation'), 'sandbox must have correct nav token');
  assert.ok(!out.includes('allow-top-navigation"'), 'must not have deprecated token');
});

test('Basis display-js: generates native blob, not script src', () => {
  const out = buildTagSnippet(TAG, 'display-js', BASE, 'Basis', null);
  assert.ok(out.startsWith('(function(){'), 'Basis should generate IIFE blob');
  assert.ok(out.includes('smx_no_imp=1'), 'Basis blob must have smx_no_imp');
  assert.ok(out.includes('allow-top-navigation-by-user-activation'), 'Basis blob must have correct sandbox');
});

test('engagement URL has no cuu macro', () => {
  const out = buildTagSnippet(TAG, 'display-js', BASE, 'Basis', null);
  const engIdx = out.indexOf('engagementBase=');
  const engEnd = out.indexOf(';', engIdx);
  const engUrl = out.slice(engIdx, engEnd);
  assert.ok(!engUrl.includes('cuu='), 'engagement URL must not have click macro');
});

test('tagId injection does not produce XSS', () => {
  const maliciousTag = { ...TAG, id: '11111111-1111-1111-1111-111111111111' };
  const out = buildTagSnippet(maliciousTag, 'display-js', BASE, '', null);
  assert.ok(!out.includes('<script>alert'), 'no XSS');
});

test('INS tag includes MutationObserver fallback', () => {
  const out = buildTagSnippet(TAG, 'display-ins', BASE, '', null);
  assert.ok(out.includes('MutationObserver'), 'INS tag should watch for deferred slot mount');
  assert.ok(out.includes('dataset.smxMounted'), 'INS tag should prevent duplicate mounts');
});

test('supported DSP list includes Basis, Illumin, TTD, DV360, and Xandr', () => {
  const values = listSupportedDsps().map((entry) => entry.value).sort();
  assert.deepEqual(values, ['basis', 'dv360', 'illumin', 'ttd', 'xandr']);
});

test('displayHtmlUrl must not carry DSP macros for Basis', () => {
  const out = buildTagSnippet(TAG, 'display-js', BASE, 'Basis', null);
  const match = out.match(/var displayHtmlUrl="([^"]+)"/);
  assert.ok(match, 'displayHtmlUrl var must be present in blob');
  const displayUrl = match[1];
  assert.ok(displayUrl.startsWith(`${BASE}/v1/tags/display/`), 'displayHtmlUrl must use serving base URL');
  assert.ok(!displayUrl.includes('{domain}'), 'displayHtmlUrl must not have {domain} macro');
  assert.ok(!displayUrl.includes('{pageUrlEnc}'), 'displayHtmlUrl must not have {pageUrlEnc} macro');
  assert.ok(!displayUrl.includes('cuu='), 'displayHtmlUrl must not have click macro');
  assert.ok(!displayUrl.includes('dsp=Basis'), 'displayHtmlUrl must not have dsp param');
  assert.ok(displayUrl.length < 120, `displayHtmlUrl must be short, got ${displayUrl.length} chars`);
});

test('displayHtmlUrl must not carry DSP macros for TTD', () => {
  const out = buildTagSnippet(TAG, 'display-js', BASE, 'ttd', null);
  const displayUrl = out.match(/src="([^"]+)"/)?.at(1) ?? '';
  assert.ok(!displayUrl.includes('%%TTD_CLICK_URL%%'), 'displayJsUrl must not have TTD macros');
  assert.ok(!displayUrl.includes('%%TTD_CACHEBUSTER%%'), 'displayJsUrl must not have TTD macros');
  assert.ok(displayUrl.startsWith(`${BASE}/v1/tags/display/`), 'displayJsUrl must use serving base URL');
});

test('tracker URLs still carry DSP macros for Basis', () => {
  const out = buildTagSnippet(TAG, 'display-js', BASE, 'Basis', null);
  const impMatch = out.match(/var impressionBase="([^"]+)"/);
  assert.ok(impMatch, 'impressionBase must be present');
  const impUrl = impMatch[1];
  assert.ok(impUrl.includes('dsp=Basis'), 'impressionBase must have dsp=Basis');
  assert.ok(impUrl.includes('{domain}'), 'impressionBase must have {domain} macro');
  assert.ok(impUrl.includes('{pageUrlEnc}'), 'impressionBase must have {pageUrlEnc} macro');
});
