/**
 * Canonical HTML5 clickTag detector shared by the API in-process path
 * and the worker job. Single source of truth.
 *
 * Returns the first detected http(s) URL or null.
 */
export function detectClickTagInHtml(htmlSource) {
  if (!htmlSource || typeof htmlSource !== 'string') return null;

  const isHttpUrl = (v) => Boolean(v && /^https?:\/\/.{4,}/.test(v.trim()));
  const clean = (v) => {
    const s = String(v ?? '').trim();
    try { return decodeURIComponent(s); } catch { return s; }
  };

  const patterns = [
    [/(?:var\s+|window\.)clickTag\s*=\s*["'](https?:\/\/[^"'\\]{4,512})["']/i, 1],
    [/(?:var\s+|window\.)clickTAG\s*=\s*["'](https?:\/\/[^"'\\]{4,512})["']/i, 1],
    [/(?<![.\w])clickTag\s*=\s*["'](https?:\/\/[^"'\\]{4,512})["']/i, 1],
    [/Enabler\.exit\s*\(\s*["'][^"']{0,64}["']\s*,\s*["'](https?:\/\/[^"'\\]{4,512})["']/i, 1],
    [/ExitApi\.exit\s*\(\s*["'][^"']{0,64}["']\s*,\s*["'](https?:\/\/[^"'\\]{4,512})["']/i, 1],
    [/processedVars\s*:\s*\{[^}]{0,300}?["']?bsClickTAG["']?\s*:\s*["'](https?:\/\/[^"'\\]{4,512})["']/i, 1],
    [/var\s+bsClickTAG\s*=\s*dhtml\.getVar\s*\(\s*["'][^"']{0,64}["']\s*,\s*["'](https?:\/\/[^"'\\]{4,512})["']\s*\)/i, 1],
    [/dhtml\.getVar\s*\(\s*["'][^"']{0,32}(?:click|Click)[^"']{0,32}["']\s*,\s*["'](https?:\/\/[^"'\\]{4,512})["']/i, 1],
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
