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

test('Basis display-js: stays on standard JS tag and does not emit native blob', () => {
  const out = buildTagSnippet(TAG, 'display-js', BASE, 'Basis', null);
  assert.ok(out.includes('<script src='), 'Basis display-js should stay on standard script delivery');
  assert.ok(out.includes('/v1/tags/display/'), 'Basis display-js should still use display serving path');
  assert.ok(!out.startsWith('(function(){'), 'Basis display-js must not emit runtime blob');
});

test('Basis tracker-click stays a plain tracker URL with macros', () => {
  const out = buildTagSnippet(TAG, 'tracker-click', BASE, 'Basis', null);
  assert.ok(out.startsWith(`${BASE}/v1/tags/tracker/${TAG.id}/click`), 'tracker-click should be a click URL');
  assert.ok(out.includes('dsp=Basis'), 'tracker-click should retain Basis DSP macros');
  assert.ok(!out.startsWith('(function(){'), 'tracker-click must not emit runtime blob');
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
  const scriptMatch = out.match(/<script src="([^"]+)"/);
  assert.ok(scriptMatch, 'display-js should expose a standard script src');
  const displayUrl = scriptMatch[1];
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
  const impUrl = buildTagSnippet(TAG, 'tracker-impression', BASE, 'Basis', null);
  assert.ok(impUrl.includes('dsp=Basis'), 'impressionBase must have dsp=Basis');
  assert.ok(impUrl.includes('{domain}'), 'impressionBase must have {domain} macro');
  assert.ok(impUrl.includes('{pageUrlEnc}'), 'impressionBase must have {pageUrlEnc} macro');
});

test('Basis display-iframe stays a normal iframe tag', () => {
  const out = buildTagSnippet(TAG, 'display-iframe', BASE, 'Basis', null);
  assert.ok(out.includes('<iframe'), 'Basis iframe variant should stay a regular iframe tag');
  assert.ok(out.includes(`${BASE}/v1/tags/display/${TAG.id}.html`), 'Basis iframe should use the clean serving HTML URL');
  const iframeSrc = out.match(/src="([^"]+)"/)?.[1] ?? '';
  assert.ok(!iframeSrc.includes('dsp=Basis'), 'Basis iframe serving URL must not include DSP macros');
});

test('display-js with empty base URL produces relative URLs', () => {
  const out = buildTagSnippet(TAG, 'display-js', '', '', null);
  assert.ok(out.includes('/v1/tags/display/'), 'should produce relative URL when base is empty');
  assert.ok(!out.includes('undefined'), 'should not include undefined in URL');
});

test('display-js noscript fallback has sandbox attribute', () => {
  const out = buildTagSnippet(TAG, 'display-js', BASE, '', null);
  const noscriptMatch = out.match(/<noscript>([\s\S]*?)<\/noscript>/);
  assert.ok(noscriptMatch, 'display-js must have noscript fallback');
  assert.ok(
    noscriptMatch[1].includes('allow-top-navigation-by-user-activation'),
    'noscript iframe must have sandbox attribute',
  );
});

test('display-ins with Basis DSP stays standard INS tag without blob', () => {
  const out = buildTagSnippet(TAG, 'display-ins', BASE, 'Basis', null);
  assert.ok(out.includes('<ins '), 'Basis display-ins should be a standard INS tag');
  assert.ok(out.includes('smx-ad-slot-'), 'INS tag should have smx-ad-slot prefix');
  assert.ok(!out.includes('smx-basis-slot'), 'must not use basis slot prefix');
  assert.ok(!out.startsWith('(function(){'), 'must not emit runtime blob');
  assert.ok(!out.includes('engagementBase'), 'must not inject engagement tracker variable');
});

test('native-js produces correct SMX native loader snippet', () => {
  const out = buildTagSnippet(TAG, 'native-js', BASE, '', null);
  assert.ok(out.includes('window.SMX'), 'native-js should initialize window.SMX');
  assert.ok(out.includes('window.SMX.native'), 'native-js should push to native array');
  assert.ok(out.includes(TAG.id), 'native-js should include tag ID');
  assert.ok(out.includes('/v1/tags/native/'), 'native-js should use native serving path');
});

test('tracker-impression with Illumin has Illumin macros', () => {
  const out = buildTagSnippet(TAG, 'tracker-impression', BASE, 'illumin', null);
  assert.ok(out.includes('impression.gif'), 'should be impression tracker URL');
  assert.ok(out.includes('[CACHEBUSTER]'), 'should include Illumin cachebuster macro');
  assert.ok(!out.includes('{domain}'), 'must not include Basis-style macros');
});

test('buildTagSnippet never returns undefined or null', () => {
  const variants = [
    'display-js', 'display-iframe', 'display-ins', 'native-js',
    'tracker-click', 'tracker-impression',
  ];
  for (const variant of variants) {
    const out = buildTagSnippet(TAG, variant, BASE, 'Basis', null);
    assert.ok(typeof out === 'string' && out.length > 0, `variant ${variant} must return non-empty string`);
  }
});

test('display-js with Basis DSP prepends macro tracker URL comments', () => {
  const out = buildTagSnippet(TAG, 'display-js', BASE, 'Basis', null);
  assert.ok(
    out.startsWith('<!-- Basis impression tracker'),
    'display-js with Basis must start with impression tracker comment',
  );
  assert.ok(out.includes('{domain}'), 'impression tracker comment must contain Basis {domain} macro');
  assert.ok(out.includes('{pageUrlEnc}'), 'impression tracker comment must contain {pageUrlEnc}');
  assert.ok(out.includes('{clickMacroEnc}'), 'click tracker comment must contain Basis click macro');
  assert.ok(out.includes('<!-- Basis click tracker'), 'must include click tracker comment');
  const scriptSrc = out.match(/<script src="([^"]+)"/)?.[1] ?? '';
  assert.ok(scriptSrc.startsWith(`${BASE}/v1/tags/display/`), 'script src must use serving path');
  assert.ok(!scriptSrc.includes('{domain}'), 'script src must be macro-free');
  assert.ok(!scriptSrc.includes('dsp=Basis'), 'script src must not have dsp param');
});

test('display-iframe with Basis DSP prepends macro tracker URL comments', () => {
  const out = buildTagSnippet(TAG, 'display-iframe', BASE, 'Basis', null);
  assert.ok(
    out.startsWith('<!-- Basis impression tracker'),
    'display-iframe with Basis must start with impression tracker comment',
  );
  assert.ok(out.includes('<iframe'), 'must still contain the iframe element');
  const iframeSrc = out.match(/src="([^"]+)"/)?.[1] ?? '';
  assert.ok(!iframeSrc.includes('{domain}'), 'iframe src must be macro-free');
});

test('display-ins with Basis DSP prepends macro tracker URL comments', () => {
  const out = buildTagSnippet(TAG, 'display-ins', BASE, 'Basis', null);
  assert.ok(
    out.startsWith('<!-- Basis impression tracker'),
    'display-ins with Basis must start with impression tracker comment',
  );
  assert.ok(out.includes('<ins '), 'must still contain the ins element');
});

test('display-js with Illumin DSP prepends Illumin macro tracker URL comments', () => {
  const out = buildTagSnippet(TAG, 'display-js', BASE, 'illumin', null);
  assert.ok(
    out.startsWith('<!-- Illumin impression tracker'),
    'display-js with Illumin must start with Illumin impression tracker comment',
  );
  assert.ok(out.includes('[CLICK_URL_ENCODED]'), 'click tracker comment must contain Illumin click macro');
  assert.ok(out.includes('[EXCHANGE_ID]'), 'impression tracker comment must contain Illumin exchange macro');
});

test('display-js without DSP does not prepend tracker comments', () => {
  const out = buildTagSnippet(TAG, 'display-js', BASE, '', null);
  assert.ok(!out.startsWith('<!--'), 'display-js without DSP must not prepend any comment');
  assert.ok(out.startsWith('<script'), 'display-js without DSP must start directly with script tag');
});

test('tracker-impression with Basis DSP returns raw URL without comment wrapper', () => {
  const out = buildTagSnippet(TAG, 'tracker-impression', BASE, 'Basis', null);
  assert.ok(!out.startsWith('<!--'), 'tracker-impression must return raw URL without comment wrapper');
  assert.ok(out.includes('impression.gif'), 'must be impression pixel URL');
  assert.ok(out.includes('{domain}'), 'must contain Basis domain macro');
});

test('Basis display-js existing test still passes — script src stays macro-free', () => {
  const out = buildTagSnippet(TAG, 'display-js', BASE, 'Basis', null);
  assert.ok(out.includes('<script src='), 'Basis display-js should have script tag');
  assert.ok(out.includes('/v1/tags/display/'), 'Basis display-js should use display path');
  const scriptSrc = out.match(/<script src="([^"]+)"/)?.[1] ?? '';
  assert.ok(!scriptSrc.includes('dsp=Basis'), 'script src must not have dsp param');
  assert.ok(scriptSrc.length < 120, 'script src must be short');
});
