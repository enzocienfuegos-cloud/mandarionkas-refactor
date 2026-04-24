import { mkdtemp, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFile as execFileCallback } from 'node:child_process';
import { promisify } from 'node:util';
import { getObjectBuffer, putObjectBuffer, sanitizeStorageFilename } from '../storage/object-storage.mjs';

const execFile = promisify(execFileCallback);

const MAX_EXTRACTED_FILES = 500;
const MAX_EXTRACTED_BYTES = 50 * 1024 * 1024;

const CONTENT_TYPES = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.htm', 'text/html; charset=utf-8'],
  ['.js', 'application/javascript; charset=utf-8'],
  ['.mjs', 'application/javascript; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.svg', 'image/svg+xml'],
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.gif', 'image/gif'],
  ['.webp', 'image/webp'],
  ['.ico', 'image/x-icon'],
  ['.woff', 'font/woff'],
  ['.woff2', 'font/woff2'],
  ['.ttf', 'font/ttf'],
  ['.otf', 'font/otf'],
  ['.mp4', 'video/mp4'],
  ['.txt', 'text/plain; charset=utf-8'],
]);

function inferContentType(relativePath) {
  const extension = path.extname(relativePath).toLowerCase();
  return CONTENT_TYPES.get(extension) ?? 'application/octet-stream';
}

function normalizeRelativePath(relativePath) {
  const normalized = relativePath.split(path.sep).join('/');
  return normalized.replace(/^\/+/, '');
}

async function collectFiles(rootDir, currentDir = rootDir, files = []) {
  const entries = await (await import('node:fs/promises')).readdir(currentDir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === '__MACOSX') continue;
    const absolutePath = path.join(currentDir, entry.name);
    if (entry.isDirectory()) {
      await collectFiles(rootDir, absolutePath, files);
      continue;
    }
    const relativePath = normalizeRelativePath(path.relative(rootDir, absolutePath));
    if (!relativePath || relativePath.startsWith('..')) continue;
    files.push({ absolutePath, relativePath });
  }
  return files;
}

function pickEntryHtml(files) {
  const htmlFiles = files
    .filter(file => path.basename(file.relativePath).toLowerCase() === 'index.html')
    .sort((a, b) => a.relativePath.split('/').length - b.relativePath.split('/').length || a.relativePath.localeCompare(b.relativePath));
  return htmlFiles[0] ?? null;
}

function parseStyleDimensions(styleValue) {
  if (!styleValue) return null;
  const widthMatch = styleValue.match(/width\s*:\s*(\d+)(?:px)?/i);
  const heightMatch = styleValue.match(/height\s*:\s*(\d+)(?:px)?/i);
  if (!widthMatch || !heightMatch) return null;
  return {
    width: Number(widthMatch[1]),
    height: Number(heightMatch[1]),
    source: 'inline_style',
  };
}

function extractHtml5Dimensions(htmlSource) {
  if (!htmlSource) return null;

  const metaTags = htmlSource.match(/<meta\b[^>]*>/gi) ?? [];
  for (const metaTag of metaTags) {
    if (!/name\s*=\s*["']ad\.size["']/i.test(metaTag)) continue;
    const contentMatch = metaTag.match(/content\s*=\s*["']([^"']+)["']/i);
    const sizeMatch = contentMatch?.[1]?.match(/width\s*=\s*(\d+)\s*,\s*height\s*=\s*(\d+)/i);
    if (sizeMatch) {
      return {
        width: Number(sizeMatch[1]),
        height: Number(sizeMatch[2]),
        source: 'meta_ad_size',
      };
    }
  }

  const attributeMatch = htmlSource.match(/<(?:body|div|canvas|iframe|img|svg)\b[^>]*\bwidth=["']?(\d{2,4})["']?[^>]*\bheight=["']?(\d{2,4})["']?[^>]*>/i)
    ?? htmlSource.match(/<(?:body|div|canvas|iframe|img|svg)\b[^>]*\bheight=["']?(\d{2,4})["']?[^>]*\bwidth=["']?(\d{2,4})["']?[^>]*>/i);
  if (attributeMatch) {
    const [first, second] = attributeMatch.slice(1, 3).map(Number);
    const width = /width=["']?/.test(attributeMatch[0]) && attributeMatch.indexOf('width') < attributeMatch.indexOf('height') ? first : second;
    const height = width === first ? second : first;
    return { width, height, source: 'html_attributes' };
  }

  const styleTags = htmlSource.match(/<(?:body|div|canvas|iframe)\b[^>]*\bstyle=["'][^"']+["'][^>]*>/gi) ?? [];
  for (const styleTag of styleTags) {
    const styleMatch = styleTag.match(/style\s*=\s*["']([^"']+)["']/i);
    const dimensions = parseStyleDimensions(styleMatch?.[1] ?? '');
    if (dimensions) return dimensions;
  }

  const genericMatch = htmlSource.match(/width\s*=\s*(\d+)\s*,\s*height\s*=\s*(\d+)/i);
  if (genericMatch) {
    return {
      width: Number(genericMatch[1]),
      height: Number(genericMatch[2]),
      source: 'generic_assignment',
    };
  }

  return null;
}

function detectInternalClickBehavior(htmlSource) {
  if (!htmlSource) {
    return { hasInternalClickTag: false, signals: [] };
  }

  const checks = [
    { name: 'clickTag', pattern: /\bclickTag\b/i },
    { name: 'clicktag', pattern: /\bclicktag\b/i },
    { name: 'exit', pattern: /\bexit\b/i },
    { name: 'enabler.exit', pattern: /\bEnabler\.exit\b/i },
    { name: 'adform.clicktag', pattern: /\bAdform\.clickTag\b/i },
    { name: 'sizmek.clickthrough', pattern: /\bEB\.clickthrough\b/i },
    { name: 'creatopy.runtime', pattern: /\bcreatopyEmbed\b|\bbsClickTAG\b|\bbsOpenURL\b|\bbsClickFunc\b|\bbannerURL\b/i },
  ];

  const signals = checks
    .filter(check => check.pattern.test(htmlSource))
    .map(check => check.name);

  return {
    hasInternalClickTag: signals.length > 0,
    signals,
  };
}

function extractClickDestinationFromHtml(htmlSource) {
  if (!htmlSource) return null;

  const patterns = [
    /processedVars\s*:\s*\{[^}]*bsClickTAG\s*:\s*"([^"]+)"/i,
    /processedVars\s*:\s*\{[^}]*clickTag\s*:\s*"([^"]+)"/i,
    /var\s+bsClickTAG\s*=\s*["'](https?:\/\/[^"']+)["']/i,
    /bsClickTAG\s*===\s*['"]{2}\)\s*\{bsClickTAG\s*=\s*"([^"]+)"/i,
    /window\.bannerURL\s*=\s*["'](https?:\/\/[^"']+)["']/i,
    /window\.clickTag\s*=\s*["'](https?:\/\/[^"']+)["']/i,
    /window\.clickTAG\s*=\s*["'](https?:\/\/[^"']+)["']/i,
  ];

  for (const pattern of patterns) {
    const match = htmlSource.match(pattern);
    const value = match?.[1]?.trim();
    if (!value) continue;
    try {
      const parsed = new URL(value);
      if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
        return parsed.toString();
      }
    } catch (_) {
      // ignore invalid URL candidate
    }
  }

  return null;
}

function buildClickTrackingBootstrap() {
  return `<script>
(function() {
  try {
    var params = new URLSearchParams(window.location.search || '');
    var trackedClickUrl = params.get('smx_click');
    var dspClickMacro = params.get('smx_dsp_click') || '';
    if (!trackedClickUrl) return;
    var originalOpen = typeof window.open === 'function' ? window.open.bind(window) : null;
    var parsedTrackedBase = null;

    try {
      parsedTrackedBase = new URL(trackedClickUrl, window.location.href);
    } catch (_) {}

    function isHttpUrl(value) {
      if (!value) return false;
      try {
        var parsed = new URL(String(value), window.location.href);
        return parsed.protocol === 'http:' || parsed.protocol === 'https:';
      } catch (_) {
        return false;
      }
    }

    function buildTrackedUrl(destination) {
      if (!parsedTrackedBase) return trackedClickUrl;
      try {
        var nextUrl = new URL(parsedTrackedBase.toString());
        if (isHttpUrl(destination)) {
          nextUrl.searchParams.set('url', new URL(String(destination), window.location.href).toString());
        }
        return nextUrl.toString();
      } catch (_) {
        return trackedClickUrl;
      }
    }

    function wrapWithResolvedDspMacro(url, macroValue) {
      if (!macroValue) return url;
      var decodedMacroValue = macroValue;
      try {
        decodedMacroValue = decodeURIComponent(macroValue);
      } catch (_) {}
      if (/[{}]/.test(decodedMacroValue) || /\\$\\{[^}]+\\}/.test(decodedMacroValue)) return url;
      return decodedMacroValue + encodeURIComponent(String(url));
    }

    function wrapWithDspMacro(url) {
      return wrapWithResolvedDspMacro(url, dspClickMacro);
    }

    function navigateTracked(target, features, destination) {
      var nextTrackedUrl = wrapWithDspMacro(buildTrackedUrl(destination));
      if (originalOpen) {
        return originalOpen(nextTrackedUrl, target || '_blank', features);
      }
      window.location.href = nextTrackedUrl;
      return null;
    }

    function defineTrackedProperty(name) {
      try {
        Object.defineProperty(window, name, {
          configurable: true,
          enumerable: true,
          get: function() {
            return wrapWithDspMacro(trackedClickUrl);
          },
          set: function() {},
        });
      } catch (_) {
        window[name] = wrapWithDspMacro(trackedClickUrl);
      }
    }

    function resolveCreatopyDestination(urlOrKey) {
      if (!urlOrKey) return null;
      try {
        var candidate = String(urlOrKey);
        if (window.creatopyEmbed && window.creatopyEmbed.designData && window.creatopyEmbed.designData.processedVars) {
          var processedVars = window.creatopyEmbed.designData.processedVars;
          if (processedVars && typeof processedVars === 'object' && processedVars[candidate]) {
            return processedVars[candidate];
          }
        }
        if (window.processedVars && typeof window.processedVars === 'object' && window.processedVars[candidate]) {
          return window.processedVars[candidate];
        }
        return candidate;
      } catch (_) {
        return null;
      }
    }

    function enforceTrackedBindings() {
      defineTrackedProperty('clickTag');
      defineTrackedProperty('clicktag');
      defineTrackedProperty('bsClickTAG');
      defineTrackedProperty('bannerURL');
      window.open = function(url, target, features) {
        return navigateTracked(target, features, url);
      };

      if (window.Enabler && typeof window.Enabler === 'object') {
        window.Enabler.exit = function(name, url) {
          return navigateTracked('_blank', undefined, url);
        };
        window.Enabler.exitOverride = function(name, url) {
          return navigateTracked('_blank', undefined, url);
        };
      }

      if (window.Adform && typeof window.Adform === 'object') {
        window.Adform.clickTag = trackedClickUrl;
      }

      if (window.EB && typeof window.EB === 'object') {
        window.EB.clickthrough = function(url) {
          return navigateTracked('_blank', undefined, url);
        };
      }

      window.bsOpenURL = function(url, target) {
        return navigateTracked(target || '_blank', undefined, resolveCreatopyDestination(url));
      };

      window.bsClickFunc = function(url, target, urlKey) {
        return navigateTracked(target || '_blank', undefined, resolveCreatopyDestination(url || urlKey));
      };
    }

    document.addEventListener('click', function(event) {
      try {
        var node = event.target;
        if (!node || typeof node.closest !== 'function') return;
        var anchor = node.closest('a[href]');
        if (!anchor) return;
        var href = anchor.getAttribute('href') || anchor.href || '';
        if (!isHttpUrl(href)) return;
        event.preventDefault();
        event.stopPropagation();
        navigateTracked(anchor.target || '_blank', undefined, href);
      } catch (_) {}
    }, true);

    enforceTrackedBindings();
    document.addEventListener('DOMContentLoaded', enforceTrackedBindings, { once: true });
    window.addEventListener('load', enforceTrackedBindings, { once: true });
    setTimeout(enforceTrackedBindings, 250);
  } catch (_) {}
})();
</script>`;
}

function injectClickTrackingBootstrap(htmlSource) {
  const bootstrap = buildClickTrackingBootstrap();
  if (/<head\b[^>]*>/i.test(htmlSource)) {
    return htmlSource.replace(/<head\b[^>]*>/i, match => `${match}\n${bootstrap}`);
  }
  if (/<body\b[^>]*>/i.test(htmlSource)) {
    return htmlSource.replace(/<body\b[^>]*>/i, match => `${match}\n${bootstrap}`);
  }
  return `${bootstrap}\n${htmlSource}`;
}

export async function expandAndPublishHtml5Archive({
  sourceStorageKey,
  workspaceId,
  creativeVersionId,
}) {
  const archiveBuffer = await getObjectBuffer(sourceStorageKey);
  if (!archiveBuffer) {
    throw new Error('Could not download source HTML5 archive from object storage');
  }

  const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'smx-html5-'));
  const archivePath = path.join(tempRoot, 'source.zip');
  const extractDir = path.join(tempRoot, 'extract');

  try {
    await mkdir(extractDir, { recursive: true });
    await writeFile(archivePath, archiveBuffer);
    await execFile('unzip', ['-qq', archivePath, '-d', extractDir]);

    const files = await collectFiles(extractDir);
    if (!files.length) {
      throw new Error('HTML5 archive did not contain any publishable files');
    }
    if (files.length > MAX_EXTRACTED_FILES) {
      throw new Error(`HTML5 archive exceeds file limit (${MAX_EXTRACTED_FILES})`);
    }

    let totalBytes = 0;
    for (const file of files) {
      const fileStat = await stat(file.absolutePath);
      totalBytes += fileStat.size;
      file.sizeBytes = fileStat.size;
    }
    if (totalBytes > MAX_EXTRACTED_BYTES) {
      throw new Error('HTML5 archive exceeds extracted size limit');
    }

    const entryFile = pickEntryHtml(files);
    if (!entryFile) {
      throw new Error('HTML5 archive must contain an index.html entrypoint');
    }
    const entryHtmlSource = await readFile(entryFile.absolutePath, 'utf8');
    const detectedDimensions = extractHtml5Dimensions(entryHtmlSource);
    const clickBehavior = detectInternalClickBehavior(entryHtmlSource);
    const clickDestinationUrl = extractClickDestinationFromHtml(entryHtmlSource);

    const publishedPrefix = `${workspaceId}/creative-published/${creativeVersionId}`;
    const publishedArtifacts = [];
    const instrumentedEntryHtmlSource = clickBehavior.hasInternalClickTag
      ? injectClickTrackingBootstrap(entryHtmlSource)
      : entryHtmlSource;

    for (const file of files) {
      const fileBuffer = file.relativePath === entryFile.relativePath
        ? Buffer.from(instrumentedEntryHtmlSource, 'utf8')
        : await readFile(file.absolutePath);
      const destinationKey = `${publishedPrefix}/${file.relativePath.split('/').map(segment => sanitizeStorageFilename(segment, segment)).join('/')}`;
      const upload = await putObjectBuffer({
        storageKey: destinationKey,
        buffer: fileBuffer,
        contentType: inferContentType(file.relativePath),
      });
      publishedArtifacts.push({
        kind: file.relativePath === entryFile.relativePath ? 'published_html' : 'published_asset',
        storageKey: destinationKey,
        publicUrl: upload?.publicUrl ?? null,
        mimeType: inferContentType(file.relativePath),
        sizeBytes: file.sizeBytes,
        checksum: null,
        metadata: {
          relativePath: file.relativePath,
          isEntrypoint: file.relativePath === entryFile.relativePath,
        },
      });
    }

    const entryArtifact = publishedArtifacts.find(artifact => artifact.kind === 'published_html') ?? null;
    return {
      entryPath: entryFile.relativePath,
      entryPublicUrl: entryArtifact?.publicUrl ?? null,
      filesPublished: publishedArtifacts.length,
      totalBytes,
      width: detectedDimensions?.width ?? null,
      height: detectedDimensions?.height ?? null,
      dimensionSource: detectedDimensions?.source ?? null,
      hasInternalClickTag: clickBehavior.hasInternalClickTag,
      internalClickSignals: clickBehavior.signals,
      clickDestinationUrl,
      artifacts: publishedArtifacts,
    };
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
}
