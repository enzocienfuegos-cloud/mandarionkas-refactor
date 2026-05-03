import test from 'node:test';
import assert from 'node:assert/strict';

import { buildDisplayHtml, pickWeightedCreativeRow } from './routes.mjs';

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
    html.includes('event=viewable'),
    'HTML should beacon viewable event',
  );
  assert.ok(
    html.includes('event=hover_end'),
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
