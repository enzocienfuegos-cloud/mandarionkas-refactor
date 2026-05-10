import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  detectClickTagInHtml,
  detectDimensionsInHtml,
  extractReferencedAssetPathsFromCss,
  extractReferencedAssetPathsFromHtml,
  validateHtml5Bundle,
} from './html5-detector.mjs';

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

test('extracts html asset references including srcset and inline styles', () => {
  const html = `
    <link rel="stylesheet" href="./styles/app.css?v=1">
    <img src="./media/frame.png" srcset="./media/frame.png 1x, ./media/frame2x.png 2x">
    <div style="background-image:url('./media/bg.png')"></div>
  `;
  assert.deepEqual(
    extractReferencedAssetPathsFromHtml(html, { fromPath: 'index.html' }).sort(),
    [
      'media/bg.png',
      'media/frame.png',
      'media/frame2x.png',
      'styles/app.css',
    ],
  );
});

test('extracts css asset references including image-set', () => {
  const css = `
    .hero {
      background-image: image-set(url("../media/card.png") 1x, url("../media/card2x.png") 2x);
    }
  `;
  assert.deepEqual(
    extractReferencedAssetPathsFromCss(css, { fromPath: 'styles/app.css' }).sort(),
    ['media/card.png', 'media/card2x.png'],
  );
});

test('validateHtml5Bundle reports missing nested 2x assets', () => {
  const html = `
    <html>
      <head>
        <link rel="stylesheet" href="./styles/app.css">
      </head>
      <body>
        <img src="./media/hero.png" srcset="./media/hero.png 1x, ./media/hero2x.png 2x">
      </body>
    </html>
  `;
  const result = validateHtml5Bundle(html, {
    entryPath: 'index.html',
    assetPaths: [
      'index.html',
      'styles/app.css',
      'media/hero.png',
      'media/card.png',
    ],
    assetSources: {
      'styles/app.css': '.card{background-image:image-set(url("../media/card.png") 1x, url("../media/card2x.png") 2x)}',
    },
  });
  assert.equal(result.ok, false);
  assert.deepEqual(result.missingPaths, ['media/card2x.png', 'media/hero2x.png']);
});

test('validateHtml5Bundle passes when all referenced local assets exist', () => {
  const html = `
    <html>
      <head><style>.root{background:url("./media/bg.png")}</style></head>
      <body><script src="./scripts/app.js"></script></body>
    </html>
  `;
  const result = validateHtml5Bundle(html, {
    entryPath: 'index.html',
    assetPaths: ['index.html', 'media/bg.png', 'scripts/app.js'],
  });
  assert.equal(result.ok, true);
  assert.deepEqual(result.missingPaths, []);
});

test('validateHtml5Bundle does not treat meta content values as asset paths', () => {
  const html = `
    <html>
      <head>
        <meta name="ad.size" content="width=300,height=250">
      </head>
      <body><img src="./media/frame.png"></body>
    </html>
  `;
  const result = validateHtml5Bundle(html, {
    entryPath: 'index.html',
    assetPaths: ['index.html', 'media/frame.png'],
  });
  assert.equal(result.ok, true);
  assert.deepEqual(result.missingPaths, []);
});
