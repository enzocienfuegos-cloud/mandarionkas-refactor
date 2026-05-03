import assert from 'node:assert/strict';
import { test } from 'node:test';
import { detectClickTagInHtml, detectDimensionsInHtml } from './html5-detector.mjs';

test('returns null for empty input', () => {
  assert.equal(detectClickTagInHtml(''), null);
  assert.equal(detectClickTagInHtml(null), null);
});

test('detects var clickTag = "..."', () => {
  const html = `<script>var clickTag = "https://example.com/landing";</script>`;
  assert.equal(detectClickTagInHtml(html), 'https://example.com/landing');
});

test('detects window.clickTag = "..."', () => {
  const html = `<script>window.clickTag = "https://example.com";</script>`;
  assert.equal(detectClickTagInHtml(html), 'https://example.com');
});

test('detects clickTAG uppercase', () => {
  const html = `<script>var clickTAG = "https://example.com";</script>`;
  assert.equal(detectClickTagInHtml(html), 'https://example.com');
});

test('detects Enabler.exit pattern (CM360/GWD)', () => {
  const html = `<script>Enabler.exit('clickTAG', 'https://brand.com/offer');</script>`;
  assert.equal(detectClickTagInHtml(html), 'https://brand.com/offer');
});

test('detects Adform bsClickTAG getVar pattern', () => {
  const html = `<script>var bsClickTAG = dhtml.getVar("ClickTAG", "https://adform.com/click");</script>`;
  assert.equal(detectClickTagInHtml(html), 'https://adform.com/click');
});

test('detects Xandr-style bsClickTAG fallback assignment after getClickTagValue', () => {
  const html = `<script>var bsClickTAG = decodeURIComponent(getClickTagValue()); if(bsClickTAG === '') {bsClickTAG = "https://wa.me/50325058000"} else {var encUrl = encodeURIComponent("https://wa.me/50325058000"); if (bsClickTAG.indexOf("https://wa.me/50325058000") === -1) bsClickTAG += encUrl; } window.bannerURL = "bsClickTAG";</script>`;
  assert.equal(detectClickTagInHtml(html), 'https://wa.me/50325058000');
});

test('rejects non-http values', () => {
  const html = `<script>var clickTag = "javascript:void(0)";</script>`;
  assert.equal(detectClickTagInHtml(html), null);
});

test('detects IAB ad.size meta tag', () => {
  const html = `<meta name="ad.size" content="width=300,height=250">`;
  assert.deepEqual(detectDimensionsInHtml(html), { width: 300, height: 250 });
});

test('detects body style dimensions', () => {
  const html = `<body style="width:728px;height:90px;margin:0">`;
  assert.deepEqual(detectDimensionsInHtml(html), { width: 728, height: 90 });
});

test('returns null when no dimensions found', () => {
  assert.equal(detectDimensionsInHtml('<html><body></body></html>'), null);
});

test('detects Creatopy processedVars bsClickTAG tight (no spaces, no key quotes)', () => {
  const html = `window.creatopyEmbed={designData:{processedVars:{bsClickTAG:"https://www.brand.com/offer/"},soasLayersSlideLocation:[]}};`;
  assert.equal(detectClickTagInHtml(html), 'https://www.brand.com/offer/');
});

test('detects Creatopy bsClickTAG with deeply nested objects before it', () => {
  const html = `processedVars:{animations:[{id:1,elements:[{id:2,from:0}]}],bsClickTAG:"https://brand.com/lp"}`;
  assert.equal(detectClickTagInHtml(html), 'https://brand.com/lp');
});

test('detects bsClickTAG with single-quoted key', () => {
  const html = `processedVars:{'bsClickTAG':'https://brand.com/single'}`;
  assert.equal(detectClickTagInHtml(html), 'https://brand.com/single');
});

test('does NOT match notBsClickTAG (false positive guard)', () => {
  const html = `{notBsClickTAG:"https://shouldnotmatch.com"}`;
  assert.equal(detectClickTagInHtml(html), null);
});
