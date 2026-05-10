/**
 * Canonical HTML5 clickTag detector shared by the API in-process path
 * and the worker job. Single source of truth.
 *
 * Returns the first detected http(s) URL or null.
 *
 * Platform coverage:
 *   IAB standard        — var clickTag / window.clickTag / var clickTAG
 *   CM360 / GWD         — Enabler.exit('name', 'https://...')
 *   Celtra              — ExitApi.exit('name', 'https://...')
 *   Adform DHTML        — dhtml.getVar(...) / processedVars:{bsClickTAG:"..."}
 *   Creatopy            — processedVars:{bsClickTAG:"..."} (any nesting depth)
 *   Xandr / generic     — window.bannerURL = "https://..."
 *   Xandr fallback      — if (bsClickTAG === '') { bsClickTAG = "https://..." }
 */
export function detectClickTagInHtml(htmlSource) {
  if (!htmlSource || typeof htmlSource !== 'string') return null;

  const isHttpUrl = (v) => Boolean(v && /^https?:\/\/.{4,}/.test(v.trim()));
  const clean = (v) => {
    const s = String(v ?? '').trim();
    try { return decodeURIComponent(s); } catch { return s; }
  };

  const patterns = [
    // IAB standard: var clickTag = "https://..."  /  window.clickTag = "https://..."
    [/(?:var\s+|window\.)clickTag\s*=\s*["'](https?:\/\/[^"'\\]{4,512})["']/i, 1],
    // IAB uppercase variant: var clickTAG = "https://..."
    [/(?:var\s+|window\.)clickTAG\s*=\s*["'](https?:\/\/[^"'\\]{4,512})["']/i, 1],
    // Bare assignment without var/window (GWD and similar)
    [/(?<![.\w])clickTag\s*=\s*["'](https?:\/\/[^"'\\]{4,512})["']/i, 1],
    // CM360 / GWD: Enabler.exit('exitName', 'https://...')
    [/Enabler\.exit\s*\(\s*["'][^"']{0,64}["']\s*,\s*["'](https?:\/\/[^"'\\]{4,512})["']/i, 1],
    // Celtra / Connected Stories: ExitApi.exit('exitName', 'https://...')
    [/ExitApi\.exit\s*\(\s*["'][^"']{0,64}["']\s*,\s*["'](https?:\/\/[^"'\\]{4,512})["']/i, 1],
    // Adform / Creatopy: bsClickTAG:"https://..." or bsClickTAG:'https://...'
    // Works at any nesting depth. Negative lookbehind prevents matching notBsClickTAG.
    [/(?<!\w)bsClickTAG["']?\s*:\s*["'](https?:\/\/[^"'\\]{4,512})["']/i, 1],
    // Adform DHTML explicit: var bsClickTAG = dhtml.getVar('bsClickTAG', 'https://...')
    [/var\s+bsClickTAG\s*=\s*dhtml\.getVar\s*\(\s*["'][^"']{0,64}["']\s*,\s*["'](https?:\/\/[^"'\\]{4,512})["']\s*\)/i, 1],
    // Xandr / Creatopy runtime fallback: if (bsClickTAG === '') { bsClickTAG = "https://..." }
    [/if\s*\(\s*bsClickTAG\s*===\s*["']{2}\s*\)\s*\{\s*bsClickTAG\s*=\s*["'](https?:\/\/[^"'\\]{4,512})["']/i, 1],
    // Adform DHTML generic getVar with click/Click in the key name
    [/dhtml\.getVar\s*\(\s*["'][^"']{0,32}(?:click|Click)[^"']{0,32}["']\s*,\s*["'](https?:\/\/[^"'\\]{4,512})["']/i, 1],
    // Xandr / generic: window.bannerURL = "https://..."
    [/window\.bannerURL\s*=\s*["'](https?:\/\/[^"'\\]{4,512})["']/i, 1],
  ];

  for (const [pattern, group] of patterns) {
    const match = htmlSource.match(pattern);
    if (match?.[group]) {
      const candidate = clean(match[group]);
      if (isHttpUrl(candidate)) return candidate;
    }
  }
  return null;
}

/**
 * Extracts banner dimensions (width x height) from an HTML5 index.html.
 *
 * Returns { width, height } or null if not detected.
 */
export function detectDimensionsInHtml(htmlSource) {
  if (!htmlSource || typeof htmlSource !== 'string') return null;

  const adSizeMeta = htmlSource.match(/<meta[^>]+name=["']ad\.size["'][^>]+content=["']([^"']+)["']/i)
    || htmlSource.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']ad\.size["']/i);
  if (adSizeMeta) {
    const wMatch = adSizeMeta[1].match(/width\s*=\s*(\d+)/i);
    const hMatch = adSizeMeta[1].match(/height\s*=\s*(\d+)/i);
    if (wMatch && hMatch) {
      const width = parseInt(wMatch[1], 10);
      const height = parseInt(hMatch[1], 10);
      if (width > 0 && height > 0) return { width, height };
    }
  }

  const metaW = htmlSource.match(/<meta[^>]+name=["']width["'][^>]+content=["'](\d+)["']/i);
  const metaH = htmlSource.match(/<meta[^>]+name=["']height["'][^>]+content=["'](\d+)["']/i);
  if (metaW && metaH) {
    const width = parseInt(metaW[1], 10);
    const height = parseInt(metaH[1], 10);
    if (width > 0 && height > 0) return { width, height };
  }

  const styleMatch = htmlSource.match(/<(?:body|div)[^>]+style=["'][^"']*width\s*:\s*(\d+)px[^"']*height\s*:\s*(\d+)px/i)
    || htmlSource.match(/<(?:body|div)[^>]+style=["'][^"']*height\s*:\s*(\d+)px[^"']*width\s*:\s*(\d+)px/i);
  if (styleMatch) {
    const a = parseInt(styleMatch[1], 10);
    const b = parseInt(styleMatch[2], 10);
    if (a > 0 && b > 0) {
      const widthFirst = /width\s*:\s*\d+px[^"']*height/.test(styleMatch[0]);
      return widthFirst ? { width: a, height: b } : { width: b, height: a };
    }
  }

  const jsW = htmlSource.match(/(?:var|let|const)\s+width\s*=\s*(\d+)/);
  const jsH = htmlSource.match(/(?:var|let|const)\s+height\s*=\s*(\d+)/);
  if (jsW && jsH) {
    const width = parseInt(jsW[1], 10);
    const height = parseInt(jsH[1], 10);
    if (width > 0 && height > 0) return { width, height };
  }

  return null;
}

function trimText(value) {
  return String(value ?? '').trim();
}

function normalizeBundlePath(value) {
  const normalized = trimText(value).replace(/\\/g, '/').replace(/^\/+/, '');
  if (!normalized) return null;
  const parts = [];
  for (const segment of normalized.split('/')) {
    if (!segment || segment === '.') continue;
    if (segment === '..') {
      if (!parts.length) return null;
      parts.pop();
      continue;
    }
    parts.push(segment);
  }
  return parts.join('/');
}

function dirnameBundlePath(value) {
  const normalized = normalizeBundlePath(value);
  if (!normalized || !normalized.includes('/')) return '';
  return normalized.slice(0, normalized.lastIndexOf('/'));
}

function resolveBundleAssetPath(fromPath, rawReference) {
  const reference = trimText(rawReference);
  if (!reference) return null;
  if (
    reference.startsWith('#')
    || reference.startsWith('data:')
    || reference.startsWith('blob:')
    || reference.startsWith('mailto:')
    || reference.startsWith('tel:')
    || reference.startsWith('javascript:')
    || /^[a-z]+:\/\//i.test(reference)
    || reference.startsWith('//')
  ) {
    return null;
  }

  const withoutFragment = reference.split('#')[0];
  const withoutQuery = withoutFragment.split('?')[0];
  if (!withoutQuery) return null;

  if (withoutQuery.startsWith('/')) {
    return normalizeBundlePath(withoutQuery);
  }

  const parentDir = dirnameBundlePath(fromPath);
  const joined = parentDir ? `${parentDir}/${withoutQuery}` : withoutQuery;
  return normalizeBundlePath(joined);
}

function extractStyleTagBodies(htmlSource) {
  const bodies = [];
  const regex = /<style\b[^>]*>([\s\S]*?)<\/style>/gi;
  for (const match of htmlSource.matchAll(regex)) {
    if (match[1]) bodies.push(match[1]);
  }
  return bodies;
}

function extractHtmlAttributeReferences(htmlSource, fromPath) {
  const references = new Set();
  const directReferencePattern = /\b(?:src|href|poster)\s*=\s*(["'])([\s\S]*?)\1/gi;
  const srcsetPattern = /\bsrcset\s*=\s*(["'])([\s\S]*?)\1/gi;
  const stylePattern = /\bstyle\s*=\s*(["'])([\s\S]*?)\1/gi;

  for (const match of htmlSource.matchAll(directReferencePattern)) {
    const resolved = resolveBundleAssetPath(fromPath, match[2]);
    if (resolved) references.add(resolved);
  }

  for (const match of htmlSource.matchAll(srcsetPattern)) {
    const candidates = String(match[2] || '')
      .split(',')
      .map((part) => trimText(part).split(/\s+/)[0])
      .filter(Boolean);
    for (const candidate of candidates) {
      const resolved = resolveBundleAssetPath(fromPath, candidate);
      if (resolved) references.add(resolved);
    }
  }

  for (const match of htmlSource.matchAll(stylePattern)) {
    for (const resolved of extractReferencedAssetPathsFromCss(match[2], { fromPath })) {
      references.add(resolved);
    }
  }

  return references;
}

export function extractReferencedAssetPathsFromCss(cssSource, { fromPath = 'index.html' } = {}) {
  if (!cssSource || typeof cssSource !== 'string') return [];

  const references = new Set();
  const cssPatterns = [
    /url\(\s*(['"]?)([^)'"]+)\1\s*\)/gi,
    /@import\s+(?:url\(\s*)?(['"])([^'"]+)\1\s*\)?/gi,
    /image-set\(([\s\S]*?)\)/gi,
  ];

  for (const match of cssSource.matchAll(cssPatterns[0])) {
    const resolved = resolveBundleAssetPath(fromPath, match[2]);
    if (resolved) references.add(resolved);
  }

  for (const match of cssSource.matchAll(cssPatterns[1])) {
    const resolved = resolveBundleAssetPath(fromPath, match[2]);
    if (resolved) references.add(resolved);
  }

  for (const match of cssSource.matchAll(cssPatterns[2])) {
    const block = String(match[1] || '');
    const candidates = [...block.matchAll(/(?:url\(\s*(['"]?)([^)'"]+)\1\s*\)|(['"])([^'"]+)\3)/gi)];
    for (const candidate of candidates) {
      const rawReference = candidate[2] || candidate[4] || '';
      const resolved = resolveBundleAssetPath(fromPath, rawReference);
      if (resolved) references.add(resolved);
    }
  }

  return [...references];
}

export function extractReferencedAssetPathsFromHtml(htmlSource, { fromPath = 'index.html' } = {}) {
  if (!htmlSource || typeof htmlSource !== 'string') return [];

  const references = extractHtmlAttributeReferences(htmlSource, fromPath);
  for (const styleBody of extractStyleTagBodies(htmlSource)) {
    for (const resolved of extractReferencedAssetPathsFromCss(styleBody, { fromPath })) {
      references.add(resolved);
    }
  }
  return [...references];
}

export function validateHtml5Bundle(entryHtmlSource, {
  entryPath = 'index.html',
  assetPaths = [],
  assetSources = {},
} = {}) {
  if (!entryHtmlSource || typeof entryHtmlSource !== 'string') {
    return {
      ok: false,
      missingPaths: [],
      referencedPaths: [],
      visitedCssPaths: [],
      error: 'missing_entry_html',
    };
  }

  const normalizedEntryPath = normalizeBundlePath(entryPath) || 'index.html';
  const normalizedAssetPaths = new Set(
    assetPaths
      .map((value) => normalizeBundlePath(value))
      .filter(Boolean),
  );

  const normalizedAssetSources = Object.fromEntries(
    Object.entries(assetSources || {})
      .map(([key, value]) => [normalizeBundlePath(key), value])
      .filter(([key]) => Boolean(key)),
  );

  const referencedPaths = new Set();
  const missingPaths = new Set();
  const cssQueue = [];
  const visitedCssPaths = new Set();

  const collectReferences = (references, sourcePath) => {
    for (const reference of references) {
      const normalizedReference = normalizeBundlePath(reference);
      if (!normalizedReference) continue;
      referencedPaths.add(normalizedReference);
      if (!normalizedAssetPaths.has(normalizedReference)) {
        missingPaths.add(normalizedReference);
        continue;
      }
      if (normalizedReference.toLowerCase().endsWith('.css') && !visitedCssPaths.has(normalizedReference)) {
        cssQueue.push({ assetPath: normalizedReference, sourcePath });
      }
    }
  };

  collectReferences(extractReferencedAssetPathsFromHtml(entryHtmlSource, { fromPath: normalizedEntryPath }), normalizedEntryPath);

  while (cssQueue.length) {
    const { assetPath } = cssQueue.shift();
    if (visitedCssPaths.has(assetPath)) continue;
    visitedCssPaths.add(assetPath);
    const cssSource = normalizedAssetSources[assetPath];
    if (typeof cssSource !== 'string') continue;
    collectReferences(extractReferencedAssetPathsFromCss(cssSource, { fromPath: assetPath }), assetPath);
  }

  return {
    ok: missingPaths.size === 0,
    missingPaths: [...missingPaths].sort(),
    referencedPaths: [...referencedPaths].sort(),
    visitedCssPaths: [...visitedCssPaths].sort(),
    error: null,
  };
}
