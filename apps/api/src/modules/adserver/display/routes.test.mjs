import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildCreativeAssetProxyUrl,
  buildDisplayHtml,
  buildDisplayJs,
  pickWeightedCreativeRow,
  resolveCreativeAssetStorageKey,
} from './routes.mjs';

test('pickWeightedCreativeRow ignores rows without public_url', () => {
  const row = pickWeightedCreativeRow([
    { binding_id: 'a', weight: 10, public_url: '' },
    { binding_id: 'b', weight: 5, public_url: 'https://cdn.example.com/b.html' },
  ], () => 0.25);

  assert.equal(row?.binding_id, 'b');
});

test('pickWeightedCreativeRow selects the only valid candidate', () => {
  const row = pickWeightedCreativeRow([
    { binding_id: 'a', weight: 1, public_url: 'https://cdn.example.com/a.html' },
  ], () => 0.99);

  assert.equal(row?.binding_id, 'a');
});

test('pickWeightedCreativeRow distributes by weight bands', () => {
  const rows = [
    { binding_id: 'a', weight: 80, public_url: 'https://cdn.example.com/a.html' },
    { binding_id: 'b', weight: 20, public_url: 'https://cdn.example.com/b.html' },
  ];

  assert.equal(pickWeightedCreativeRow(rows, () => 0.00)?.binding_id, 'a');
  assert.equal(pickWeightedCreativeRow(rows, () => 0.79)?.binding_id, 'a');
  assert.equal(pickWeightedCreativeRow(rows, () => 0.80)?.binding_id, 'b');
  assert.equal(pickWeightedCreativeRow(rows, () => 0.99)?.binding_id, 'b');
});

test('pickWeightedCreativeRow treats invalid weights as 1', () => {
  const rows = [
    { binding_id: 'a', weight: 0, public_url: 'https://cdn.example.com/a.html' },
    { binding_id: 'b', weight: null, public_url: 'https://cdn.example.com/b.html' },
  ];

  assert.equal(pickWeightedCreativeRow(rows, () => 0.10)?.binding_id, 'a');
  assert.equal(pickWeightedCreativeRow(rows, () => 0.90)?.binding_id, 'b');
});

test('buildDisplayHtml passes tracker URL as clickTag to the creative iframe', () => {
  const html = buildDisplayHtml({
    creativeUrl: 'https://cdn.example.com/index.html',
    width: 300,
    height: 250,
    clickTrackerUrl: 'https://api.example.com/v1/tags/tracker/tag-1/click',
    engagementTrackerUrl: '',
    impressionUrl: '',
    clickUrl: 'https://advertiser.com/landing',
    omidVerification: {},
  });

  assert.ok(
    html.includes('clickTag=https%3A%2F%2Fapi.example.com%2Fv1%2Ftags%2Ftracker%2Ftag-1%2Fclick'),
    'iframeSrc should route through the click tracker',
  );
  assert.ok(
    !html.includes('clickTag=https%3A%2F%2Fadvertiser.com'),
    'iframeSrc must NOT expose the raw advertiser URL as clickTag',
  );
  assert.ok(
    html.includes('url%3Dhttps%253A%252F%252Fadvertiser.com'),
    'tracker URL should include the destination as encoded ?url= param',
  );
  assert.ok(
    html.includes('allow-popups-to-escape-sandbox'),
    'HTML wrapper sandbox should let click popups open outside inherited sandbox restrictions',
  );
  assert.ok(
    html.includes("window.open(navigateTo, '_blank', 'noopener')"),
    'HTML wrapper should prefer a clean new tab after click',
  );
});

test('buildDisplayHtml uses tracker URL as clickTag even when clickUrl is empty', () => {
  const html = buildDisplayHtml({
    creativeUrl: 'https://cdn.example.com/index.html',
    width: 300,
    height: 250,
    clickTrackerUrl: 'https://api.example.com/v1/tags/tracker/tag-1/click',
    engagementTrackerUrl: '',
    impressionUrl: '',
    clickUrl: '',
    omidVerification: {},
  });

  assert.ok(
    html.includes('clickTag=https%3A%2F%2Fapi.example.com%2Fv1%2Ftags%2Ftracker%2Ftag-1%2Fclick'),
    'iframeSrc should still route through the tracker when clickUrl is empty',
  );
});

test('buildDisplayHtml prefers explicit clickTag override when provided', () => {
  const html = buildDisplayHtml({
    creativeUrl: 'https://cdn.example.com/index.html',
    width: 300,
    height: 250,
    clickTrackerUrl: 'https://api.example.com/v1/tags/tracker/tag-1/click',
    engagementTrackerUrl: '',
    impressionUrl: '',
    clickUrl: 'https://advertiser.com/landing',
    clickTag: 'https://basis.example/click?redir=https%3A%2F%2Fapi.example.com%2Fv1%2Ftags%2Ftracker%2Ftag-1%2Fclick%3Furl%3Dhttps%253A%252F%252Fadvertiser.com%252Flanding',
    omidVerification: {},
  });

  assert.ok(
    html.includes('clickTag=https%3A%2F%2Fbasis.example%2Fclick'),
    'iframeSrc should honor explicit macro-wrapped clickTag override',
  );
  assert.ok(
    !html.includes('clickTag=https%3A%2F%2Fapi.example.com%2Fv1%2Ftags%2Ftracker%2Ftag-1%2Fclick'),
    'explicit clickTag override should replace the default tracker URL',
  );
});

test('buildDisplayHtml does not double-encode click URL when resolvedClickUrl is already a tracker URL', () => {
  const html = buildDisplayHtml({
    creativeUrl: 'https://cdn.example.com/index.html',
    width: 300,
    height: 250,
    clickTrackerUrl: 'https://api.example.com/v1/tags/tracker/tag-1/click',
    engagementTrackerUrl: '',
    impressionUrl: '',
    clickUrl: 'https://advertiser.com/new-landing',
    clickTag: 'https://api.example.com/v1/tags/tracker/tag-1/click?url=https%3A%2F%2Fadvertiser.com%2Fnew-landing',
    omidVerification: {},
  });

  const trackerUrlParamCount = (html.match(/%3Furl%3D/g) || []).length;
  assert.equal(
    trackerUrlParamCount,
    1,
    'clickTag should contain exactly one encoded ?url= segment, not double-encoded',
  );
  assert.ok(
    !html.includes('%253Furl%253D'),
    'clickTag should not contain a doubly encoded nested ?url= segment',
  );
});

test('buildDisplayHtml uses updated click URL after override — not stale value', () => {
  const newUrl = 'https://advertiser.com/new-campaign';
  const html = buildDisplayHtml({
    creativeUrl: 'https://cdn.example.com/index.html',
    width: 300,
    height: 250,
    clickTrackerUrl: 'https://api.example.com/v1/tags/tracker/tag-1/click',
    engagementTrackerUrl: '',
    impressionUrl: '',
    clickUrl: newUrl,
    clickTag: `https://api.example.com/v1/tags/tracker/tag-1/click?url=${encodeURIComponent(newUrl)}`,
    omidVerification: {},
  });

  assert.ok(
    html.includes(encodeURIComponent(encodeURIComponent(newUrl))),
    'iframeSrc clickTag must include the new destination URL, not a stale one',
  );
  assert.ok(
    !html.includes(encodeURIComponent('https://advertiser.com/old')),
    'iframeSrc must not contain any reference to a previously stored URL',
  );
});

test('buildDisplayHtml includes engagementTracker variable when engagementTrackerUrl is provided', () => {
  const html = buildDisplayHtml({
    creativeUrl: 'https://cdn.example.com/index.html',
    width: 300,
    height: 250,
    clickTrackerUrl: 'https://api.example.com/v1/tags/tracker/tag-1/click',
    engagementTrackerUrl: 'https://api.example.com/v1/tags/tracker/tag-1/engagement',
    impressionUrl: '',
    clickUrl: 'https://advertiser.com',
    omidVerification: {},
  });

  assert.ok(
    html.includes('engagementTracker') && html.includes('/engagement'),
    'HTML should contain engagementTracker variable pointing to engagement endpoint',
  );
  assert.ok(
    html.includes('IntersectionObserver'),
    'HTML should contain IntersectionObserver for viewability measurement',
  );
  assert.ok(
    html.includes("'event', 'viewable'"),
    'HTML should beacon viewable event',
  );
  assert.ok(
    html.includes("'event', 'hover_end'"),
    'HTML should beacon hover_end event for attention time',
  );
});

test('buildDisplayHtml does not add measurement block when engagementTrackerUrl is empty', () => {
  const html = buildDisplayHtml({
    creativeUrl: 'https://cdn.example.com/index.html',
    width: 300,
    height: 250,
    clickTrackerUrl: 'https://api.example.com/v1/tags/tracker/tag-1/click',
    engagementTrackerUrl: '',
    impressionUrl: '',
    clickUrl: '',
    omidVerification: {},
  });

  assert.ok(
    html.includes('var engagementTracker = null'),
    'engagementTracker should be null when no URL provided',
  );
});

test('buildDisplayJs fires impression pixel immediately when impressionUrl is provided', () => {
  const js = buildDisplayJs({
    creativeUrl: 'https://cdn.example.com/banner/index.html',
    impressionUrl: 'https://api.example.com/v1/tags/tracker/tag-1/impression.gif',
    clickTrackerUrl: 'https://api.example.com/v1/tags/tracker/tag-1/click',
    engagementTrackerUrl: '',
    clickTag: 'https://api.example.com/v1/tags/tracker/tag-1/click?url=https%3A%2F%2Fadvertiser.com',
    width: 300,
    height: 250,
  });

  assert.ok(
    js.includes('if (impressionUrl) (new Image()).src = impressionUrl;'),
    'JS should fire impression pixel immediately',
  );
  assert.ok(
    js.includes('var impressionUrl     = "https://api.example.com/v1/tags/tracker/tag-1/impression.gif";'),
    'JS should embed the provided impression tracker URL',
  );
  assert.ok(
    js.includes('smxWithRuntimeContext') && js.includes("url.searchParams.set('dom', domain)"),
    'JS should add runtime page/domain context when DSP macros are absent or unresolved',
  );
});

test('buildDisplayJs creates iframe pointing directly to creative public_url', () => {
  const js = buildDisplayJs({
    creativeUrl: 'https://cdn.example.com/banner/index.html',
    impressionUrl: '',
    clickTrackerUrl: '',
    engagementTrackerUrl: '',
    clickTag: '',
    width: 300,
    height: 250,
  });

  assert.ok(
    js.includes('var src = creativeUrl;'),
    'JS should derive iframe src from the creative URL directly',
  );
  assert.ok(
    js.includes('iframe.src = src;'),
    'iframe should be assigned from the derived creative src',
  );
  assert.ok(
    !js.includes('/v1/tags/display/') ,
    'JS should not point iframe to display/{id}.html wrapper',
  );
});

test('buildDisplayJs appends clickTag query param to creative URL', () => {
  const js = buildDisplayJs({
    creativeUrl: 'https://cdn.example.com/banner/index.html',
    impressionUrl: '',
    clickTrackerUrl: 'https://api.example.com/v1/tags/tracker/tag-1/click',
    engagementTrackerUrl: '',
    clickTag: 'https://api.example.com/v1/tags/tracker/tag-1/click?url=https%3A%2F%2Fadvertiser.com',
    width: 300,
    height: 250,
  });

  assert.ok(
    js.includes('clickTag='),
    'creative iframe URL should contain clickTag query param',
  );
  assert.ok(
    js.includes('smxAppendClickParams(creativeUrl, clickTag);'),
    'clickTag should be appended through the shared runtime helper',
  );
  assert.ok(
    js.includes("return withoutHash + separator + 'clickTag=' + encodeURIComponent(value) + hash;"),
    'standard runtime helper should append only clickTag by default',
  );
});

test('buildDisplayJs adds Adform/Creatopy click aliases only for Illumin', () => {
  const js = buildDisplayJs({
    creativeUrl: 'https://cdn.example.com/banner/index.html',
    impressionUrl: '',
    clickTrackerUrl: 'https://api.example.com/v1/tags/tracker/tag-1/click?dsp=Illumin',
    engagementTrackerUrl: '',
    clickTag: 'https://api.example.com/v1/tags/tracker/tag-1/click?dsp=Illumin&url=https%3A%2F%2Fadvertiser.com',
    width: 300,
    height: 250,
  });

  assert.ok(
    js.includes("'clickTag=' + encoded + '&clickTAG=' + encoded + '&bsClickTAG=' + encoded"),
    'Illumin creative URLs should receive clickTag, clickTAG, and bsClickTAG aliases',
  );
});

test('buildDisplayHtml keeps Basis on standard clickTag only', () => {
  const html = buildDisplayHtml({
    creativeUrl: 'https://cdn.example.com/index.html',
    width: 300,
    height: 250,
    clickTrackerUrl: 'https://api.example.com/v1/tags/tracker/tag-1/click',
    engagementTrackerUrl: '',
    impressionUrl: '',
    clickUrl: 'https://advertiser.com/landing',
    clickTag: 'https://api.example.com/v1/tags/tracker/tag-1/click?dsp=Basis&url=https%3A%2F%2Fadvertiser.com%2Flanding',
    omidVerification: {},
  });

  assert.ok(
    html.includes('clickTag=https%3A%2F%2Fapi.example.com%2Fv1%2Ftags%2Ftracker%2Ftag-1%2Fclick'),
    'Basis iframe should still receive the standard clickTag param',
  );
  assert.equal(
    html.includes('bsClickTAG='),
    false,
    'Basis iframe must not receive the Illumin-only bsClickTAG alias',
  );
});

test('buildDisplayJs includes postMessage listener for smx:exit', () => {
  const js = buildDisplayJs({
    creativeUrl: 'https://cdn.example.com/banner/index.html',
    impressionUrl: '',
    clickTrackerUrl: 'https://api.example.com/v1/tags/tracker/tag-1/click',
    engagementTrackerUrl: '',
    clickTag: 'https://api.example.com/v1/tags/tracker/tag-1/click?url=https%3A%2F%2Fadvertiser.com',
    width: 300,
    height: 250,
  });

  assert.ok(
    js.includes("window.addEventListener('message'"),
    'JS should listen for postMessage events from the banner',
  );
  assert.ok(
    js.includes("data.type !== 'smx:exit'"),
    'JS should handle smx:exit protocol',
  );
  assert.ok(
    js.includes("window.open(navigateTo, '_blank', 'noopener')"),
    'JS should prefer a clean new tab after click',
  );
  assert.ok(
    js.includes('window.top.location.href = navigateTo'),
    'JS should keep top-window navigation as a fallback',
  );
});

test('buildDisplayJs lets popup clicks escape the iframe sandbox', () => {
  const js = buildDisplayJs({
    creativeUrl: 'https://cdn.example.com/banner/index.html',
    impressionUrl: '',
    clickTrackerUrl: '',
    engagementTrackerUrl: '',
    clickTag: 'https://api.example.com/v1/tags/tracker/tag-1/click?url=https%3A%2F%2Fadvertiser.com',
    width: 300,
    height: 250,
  });

  assert.ok(
    js.includes('allow-popups-to-escape-sandbox'),
    'sandbox should allow click popups to open outside inherited sandbox restrictions',
  );
});

test('buildDisplayJs includes engagement tracking when engagementTrackerUrl is provided', () => {
  const js = buildDisplayJs({
    creativeUrl: 'https://cdn.example.com/banner/index.html',
    impressionUrl: '',
    clickTrackerUrl: '',
    engagementTrackerUrl: 'https://api.example.com/v1/tags/tracker/tag-1/engagement',
    clickTag: '',
    width: 300,
    height: 250,
  });

  assert.ok(
    js.includes('IntersectionObserver'),
    'JS should include IntersectionObserver for viewability tracking',
  );
  assert.ok(
    js.includes("'event', 'viewable'"),
    'JS should send viewable event beacons',
  );
  assert.ok(
    js.includes("'event', 'hover_end'"),
    'JS should send hover_end event beacons',
  );
});

test('buildDisplayJs skips impression pixel when impressionUrl is empty', () => {
  const js = buildDisplayJs({
    creativeUrl: 'https://cdn.example.com/banner/index.html',
    impressionUrl: '',
    clickTrackerUrl: '',
    engagementTrackerUrl: '',
    clickTag: '',
    width: 300,
    height: 250,
  });

  assert.ok(
    js.includes('var impressionUrl     = null;'),
    'JS should null out impression tracking when no impressionUrl is provided',
  );
});

test('buildDisplayJs removes the script tag and inserts the iframe in its place', () => {
  const js = buildDisplayJs({
    creativeUrl: 'https://cdn.example.com/banner/index.html',
    impressionUrl: '',
    clickTrackerUrl: '',
    engagementTrackerUrl: '',
    clickTag: '',
    width: 300,
    height: 250,
  });

  assert.ok(
    js.includes('document.currentScript'),
    'JS should locate the currently executing script tag',
  );
  assert.ok(
    js.includes('parent.insertBefore(iframe, script)'),
    'JS should insert iframe before script tag',
  );
  assert.ok(
    js.includes('parent.removeChild(script)'),
    'JS should remove the original script tag',
  );
});

test('buildCreativeAssetProxyUrl keeps HTML5 bundle serving on the API host', () => {
  const url = buildCreativeAssetProxyUrl('https://api.example.com', 'tag-1', {
    binding_id: 'binding-1',
    public_url: 'https://cdn.example.com/workspaces/ws/creative-versions/ver/html5/index.html',
    entry_path: 'index.html',
  });

  assert.equal(
    url,
    'https://api.example.com/v1/tags/display/tag-1/bindings/binding-1/index.html',
  );
});

test('resolveCreativeAssetStorageKey maps HTML5 bundle assets from the entry URL', () => {
  const storageKey = resolveCreativeAssetStorageKey(
    { assetsPublicBaseUrl: 'https://cdn.example.com' },
    {
      public_url: 'https://cdn.example.com/workspaces/ws-1/creative-versions/ver-1/html5/index.html',
      entry_path: 'index.html',
    },
    'scripts/main.js',
  );

  assert.equal(
    storageKey,
    'workspaces/ws-1/creative-versions/ver-1/html5/scripts/main.js',
  );
});
