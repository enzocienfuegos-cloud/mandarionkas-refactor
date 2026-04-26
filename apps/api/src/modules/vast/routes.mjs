import { getTagServingSnapshot, getTagServingSnapshotById } from '@smx/db/tags';
import {
  applyDspMacrosToDeliveryUrl,
  buildBasisNativeSnippet,
  buildDspLiteralClickUrl,
  buildDspTrackedClickUrl,
  DSP_DELIVERY_KINDS,
  getDspMacroConfig,
  normalizeDsp,
  readDspMacroValue,
  wrapTrackedClickUrlWithDspMacro,
} from '@smx/contracts/dsp-macros';
import { hasUploadStorageConfig } from '../storage/object-storage.mjs';
import { getRequestBaseUrl } from '../shared/request-base-url.mjs';
import {
  buildStaticVastProfile,
  buildStaticVastTemplateQuery,
  resolveLiveVastProfile,
} from './delivery-artifacts.mjs';
import { enqueueStaticVastPublish } from './publish-queue.mjs';
import {
  buildVastXml,
  publishStaticVastArtifactsForTag,
  readRequestedSize,
} from './xml-delivery.mjs';

function isTrackableDestinationUrl(value) {
  if (!value) return false;
  try {
    const parsed = new URL(String(value));
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function readRotationSeed(query = {}) {
  const isResolvedSeed = (value) => {
    const normalized = String(value ?? '').trim();
    if (!normalized) return false;
    if (/\[[^\]]+\]/.test(normalized)) return false;
    if (/[{}]/.test(normalized)) return false;
    if (/\$\{[^}]+\}/.test(normalized)) return false;
    return true;
  };
  const candidates = [
    query?.smx_rotation_seed,
    query?.tmp,
    query?.timestamp,
    query?.ord,
    query?.cb,
    query?.cachebuster,
    query?.CACHEBUSTING,
    query?.CACHEBUSTER,
  ];
  for (const candidate of candidates) {
    const normalized = String(candidate ?? '').trim();
    if (isResolvedSeed(normalized)) return normalized;
  }
  return '';
}

function buildCreativeIframeUrl(creativeUrl, clickTrackUrl, shouldInjectTrackedClick, dspClickMacro = '', engagementBase = '', injectLegacyBootstrap = true) {
  if (!creativeUrl) return '';
  try {
    const url = new URL(String(creativeUrl));
    if (shouldInjectTrackedClick && clickTrackUrl) {
      let creativeClickBaseUrl = clickTrackUrl;
      if (!injectLegacyBootstrap) {
        try {
          const clickUrl = new URL(String(clickTrackUrl));
          if (clickUrl.searchParams.has('url')) {
            clickUrl.searchParams.set('url', '');
            creativeClickBaseUrl = clickUrl.toString();
          }
        } catch {}
      }
      const creativeClickUrl = dspClickMacro
        ? buildDspLiteralClickUrl(creativeClickBaseUrl, dspClickMacro)
        : creativeClickBaseUrl;
      if (injectLegacyBootstrap) {
        url.searchParams.set('smx_click', clickTrackUrl);
        if (dspClickMacro) {
          url.searchParams.set('smx_dsp_click', dspClickMacro);
        }
      }
      url.searchParams.set('clickTag', creativeClickUrl);
      url.searchParams.set('clickTAG', creativeClickUrl);
      url.searchParams.set('bsClickTAG', creativeClickUrl);
      if (engagementBase) {
        url.searchParams.set('smx_engagement', engagementBase);
      }
    }
    return url.toString();
  } catch {
    return creativeUrl;
  }
}

const RUNTIME_DSP_CLICK_HELPER = `function applyDspClickMacro(url, macroValue) {
  if (!macroValue) return url;
  var decodedMacroValue = macroValue;
  try {
    decodedMacroValue = decodeURIComponent(macroValue);
  } catch (_error) {}
  return decodedMacroValue + encodeURIComponent(String(url));
}`;

const RUNTIME_TRACKING_HINT_HELPER = `function ensureSmxTrackingHints(url, sourceParams, deliveryKind) {
  if (!url) return url;
  try {
    var nextUrl = new URL(String(url), window.location.href);
    var dspValue = '';
    var dspClickValue = '';
    if (sourceParams && typeof sourceParams.get === 'function') {
      dspValue = sourceParams.get('smx_dsp') || sourceParams.get('dsp') || '';
      dspClickValue = sourceParams.get('smx_dsp_click') || sourceParams.get('cuu') || sourceParams.get('dsp_click') || '';
    }
    if (dspValue && !nextUrl.searchParams.get('smx_dsp')) nextUrl.searchParams.set('smx_dsp', dspValue);
    if (deliveryKind && !nextUrl.searchParams.get('smx_delivery_kind')) nextUrl.searchParams.set('smx_delivery_kind', deliveryKind);
    if (dspClickValue && !nextUrl.searchParams.get('smx_dsp_click')) nextUrl.searchParams.set('smx_dsp_click', dspClickValue);
    return nextUrl.toString();
  } catch (_error) {
    return url;
  }
}`;

const OMID_VERIFICATION_SCRIPT = String.raw`(function () {
  var OMID_VENDOR_KEY = 'smx.co-omid';

  function safeJsonParse(value) {
    try {
      return value ? JSON.parse(String(value)) : {};
    } catch (_error) {
      return {};
    }
  }

  function readBool(value) {
    if (value === true || value === 1) return true;
    var text = String(value || '').trim().toLowerCase();
    return text === '1' || text === 'true' || text === 'yes';
  }

  function appendQuery(url, key, value) {
    if (!url || value === null || value === undefined || value === '') return url;
    return url + (url.indexOf('?') === -1 ? '?' : '&') + encodeURIComponent(String(key)) + '=' + encodeURIComponent(String(value));
  }

  function send(url) {
    try {
      var img = new Image();
      img.referrerPolicy = 'no-referrer-when-downgrade';
      img.src = url;
    } catch (_error) {}
  }

  function readPercentageInView(event) {
    var data = event && event.data ? event.data : {};
    var candidates = [
      data.percentageInView,
      data.percentage_in_view,
      data.adView && data.adView.percentageInView,
      data.geometry && data.geometry.percentageInView,
    ];
    for (var i = 0; i < candidates.length; i += 1) {
      var value = Number(candidates[i]);
      if (Number.isFinite(value)) return Math.max(0, Math.min(100, value));
    }
    return 0;
  }

  function readVolume(event) {
    var data = event && event.data ? event.data : {};
    var candidates = [
      data.volume,
      data.mediaPlayerVolume,
      data.playerVolume,
      data.deviceVolume,
      data.videoPlayerVolume,
    ];
    for (var i = 0; i < candidates.length; i += 1) {
      var value = Number(candidates[i]);
      if (Number.isFinite(value)) return value;
    }
    return null;
  }

  function readFullscreen(event) {
    var data = event && event.data ? event.data : {};
    if (typeof data.fullscreen === 'boolean') return data.fullscreen;
    var state = String(data.playerState || data.state || '').trim().toLowerCase();
    return state === 'fullscreen' || state === 'full_screen';
  }

  var omid = window.omid3p;
  if (!omid || typeof omid.registerSessionObserver !== 'function' || typeof omid.addEventListener !== 'function') {
    return;
  }

  var tracking = {
    viewabilityUrl: '',
    measuredSent: false,
    activeViewStartedAt: null,
    lastTimestamp: null,
    percentageInView: 0,
    audible: false,
    fullscreen: false,
  };

  function buildViewabilityUrl(state, durationMs) {
    if (!tracking.viewabilityUrl) return '';
    var url = tracking.viewabilityUrl;
    url = appendQuery(url, 'state', state);
    url = appendQuery(url, 'method', 'omid_verification');
    url = appendQuery(url, 'omid', '1');
    url = appendQuery(url, 'audible', tracking.audible ? '1' : '0');
    url = appendQuery(url, 'fullscreen', tracking.fullscreen ? '1' : '0');
    url = appendQuery(url, 'piv', Math.round(tracking.percentageInView));
    if (typeof durationMs === 'number' && durationMs > 0) {
      url = appendQuery(url, 'ms', Math.round(durationMs));
    }
    return url;
  }

  function ensureMeasured() {
    if (tracking.measuredSent || !tracking.viewabilityUrl) return;
    tracking.measuredSent = true;
    send(buildViewabilityUrl('measured'));
  }

  function flushActiveView(timestamp) {
    if (tracking.activeViewStartedAt === null) return;
    var endTs = Number(timestamp || Date.now());
    var durationMs = Math.max(0, Math.round(endTs - tracking.activeViewStartedAt));
    tracking.activeViewStartedAt = null;
    if (durationMs > 0) {
      send(buildViewabilityUrl('viewable', durationMs));
    }
  }

  omid.registerSessionObserver(function (event) {
    if (!event || !event.data) return;
    if (event.type === 'sessionStart') {
      var params = safeJsonParse(event.data.verificationParameters);
      tracking.viewabilityUrl = String(params.viewabilityUrl || '');
      ensureMeasured();
    }
    if (event.type === 'sessionFinish') {
      flushActiveView(event.timestamp);
    }
  }, OMID_VENDOR_KEY);

  omid.addEventListener('geometryChange', function (event) {
    var ts = Number(event && event.timestamp) || Date.now();
    tracking.lastTimestamp = ts;
    tracking.percentageInView = readPercentageInView(event);
    ensureMeasured();

    if (tracking.percentageInView >= 50) {
      if (tracking.activeViewStartedAt === null) {
        tracking.activeViewStartedAt = ts;
      }
    } else {
      flushActiveView(ts);
    }
  });

  omid.addEventListener('video', function (event) {
    var ts = Number(event && event.timestamp) || tracking.lastTimestamp || Date.now();
    var volume = readVolume(event);
    if (volume !== null) {
      tracking.audible = volume > 0;
    }
    tracking.fullscreen = readFullscreen(event) || tracking.fullscreen;
    var state = String(event && event.data && (event.data.playerState || event.data.state || event.data.type) || '').toLowerCase();
    if (state === 'pause' || state === 'buffering' || state === 'ended') {
      flushActiveView(ts);
    }
    if (state === 'fullscreen' || state === 'full_screen') {
      tracking.fullscreen = true;
    }
  });
}());`;

function buildDisplaySnippet(tag, workspaceId, baseUrl, query = {}) {
  const tagId = tag.id;
  const servingCandidate = tag.servingCandidate ?? null;
  const servingFormat = servingCandidate?.servingFormat ?? '';
  const width = servingCandidate?.width ?? 300;
  const height = servingCandidate?.height ?? 250;
  const clickUrl = servingCandidate?.clickUrl ?? '#';
  const trackingParams = new URLSearchParams({ ws: String(workspaceId) });
  const trackingDsp = normalizeDsp(query?.smx_dsp ?? query?.dsp);
  if (trackingDsp) trackingParams.set('smx_dsp', String(trackingDsp));
  trackingParams.set('smx_delivery_kind', 'display_wrapper');
  if (servingCandidate?.creativeId) trackingParams.set('c', String(servingCandidate.creativeId));
  if (servingCandidate?.creativeSizeVariantId) trackingParams.set('csv', String(servingCandidate.creativeSizeVariantId));
  const impressionUrl = `${baseUrl}/track/impression/${tagId}?${trackingParams.toString()}`;
  const viewabilityUrl = `${baseUrl}/track/viewability/${tagId}?${trackingParams.toString()}`;
  const clickTrackParams = new URLSearchParams(trackingParams);
  clickTrackParams.set('url', clickUrl);
  const rawClickTrackUrl = `${baseUrl}/track/click/${tagId}?${clickTrackParams.toString()}`;
  const clickTrackUrl = wrapTrackedClickUrlWithDspMacro(rawClickTrackUrl, query, trackingDsp);
  const dspClickMacro = String(readDspMacroValue(query, 'clickMacro') ?? '');
  const engagementBase = `${baseUrl}/track/engagement/${tagId}?${trackingParams.toString()}`;
  const creativeUrl = servingCandidate?.publicUrl ?? '';
  const internalClickSignals = Array.isArray(servingCandidate?.internalClickSignals)
    ? servingCandidate.internalClickSignals
    : [];
  const shouldPreferInternalClickRuntime = Boolean(
    servingCandidate?.hasInternalClickTag
    && !internalClickSignals.includes('creatopy.runtime'),
  );
  const useTrackedClickWrapper = Boolean(
    isTrackableDestinationUrl(clickUrl)
    && (servingCandidate?.clickOverrideEnabled || !shouldPreferInternalClickRuntime),
  );
  const creativeIframeUrl = buildCreativeIframeUrl(
    creativeUrl,
    rawClickTrackUrl,
    !useTrackedClickWrapper && shouldPreferInternalClickRuntime,
    dspClickMacro,
    engagementBase,
    true,
  );

  return `(function() {
  var ws = ${JSON.stringify(workspaceId)};
  var tagId = ${JSON.stringify(tagId)};
  var baseUrl = ${JSON.stringify(baseUrl)};
  var w = ${width}, h = ${height};
  var servingFormat = ${JSON.stringify(servingFormat)};
  var clickUrl = ${JSON.stringify(rawClickTrackUrl)};
  var dspClickMacro = ${JSON.stringify(dspClickMacro)};
  var creativeUrl = ${JSON.stringify(creativeIframeUrl)};
  var impUrl = ${JSON.stringify(impressionUrl)};
  var viewabilityUrl = ${JSON.stringify(viewabilityUrl)};
  var engagementBase = ${JSON.stringify(engagementBase)};
  var pageUrl = (typeof window !== 'undefined' && window.location && window.location.href) ? window.location.href : '';
  var hoverStartedAt = null;
  var impressionId = (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function')
    ? crypto.randomUUID()
    : 'imp-' + Date.now() + '-' + Math.random().toString(16).slice(2);
  var currentScript = document.currentScript || (function() {
    var scripts = document.getElementsByTagName('script');
    return scripts[scripts.length - 1];
  })();
  var currentScriptSearch = (function() {
    try {
      if (currentScript && currentScript.src) return new URL(currentScript.src, window.location.href).searchParams;
    } catch (_error) {}
    return new URLSearchParams();
  })();
  function generateId(prefix) {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    return prefix + '-' + Date.now() + '-' + Math.random().toString(16).slice(2);
  }
  function readCookie(name) {
    try {
      var match = document.cookie.match(new RegExp('(?:^|; )' + name.replace(/[.$?*|{}()\\[\\]\\\\/+^]/g, '\\\\$&') + '=([^;]*)'));
      return match ? decodeURIComponent(match[1]) : '';
    } catch (_error) {
      return '';
    }
  }
  function writeCookie(name, value, maxAgeDays) {
    try {
      var expires = '';
      if (maxAgeDays) {
        expires = '; max-age=' + String(Math.floor(maxAgeDays * 24 * 60 * 60));
      }
      document.cookie = name + '=' + encodeURIComponent(value) + expires + '; path=/; SameSite=Lax';
    } catch (_error) {}
  }
  function readStorage(key) {
    try {
      return window.localStorage ? String(window.localStorage.getItem(key) || '') : '';
    } catch (_error) {
      return '';
    }
  }
  function writeStorage(key, value) {
    try {
      if (window.localStorage) window.localStorage.setItem(key, value);
    } catch (_error) {}
  }
  function resolveIdentity(kind) {
    var attrName = kind === 'device' ? 'data-device-id' : 'data-cookie-id';
    var globalName = kind === 'device' ? (window.SMX_DEVICE_ID || window.smxDeviceId) : (window.SMX_COOKIE_ID || window.smxCookieId);
    var storageKey = kind === 'device' ? 'smx_device_id' : 'smx_cookie_id';
    var cookieKey = storageKey;
    var explicit = (currentScript && currentScript.getAttribute && currentScript.getAttribute(attrName)) || globalName || '';
    var existing = explicit || readStorage(storageKey) || readCookie(cookieKey);
    if (existing) {
      writeStorage(storageKey, existing);
      writeCookie(cookieKey, existing, kind === 'device' ? 365 : 30);
      return existing;
    }
    var created = generateId(kind === 'device' ? 'dev' : 'cid');
    writeStorage(storageKey, created);
    writeCookie(cookieKey, created, kind === 'device' ? 365 : 30);
    return created;
  }
  var resolvedDeviceId = resolveIdentity('device');
  var resolvedCookieId = resolveIdentity('cookie');

  function firePixel(url) {
    var img = new Image();
    img.src = url;
  }

  function appendIdentity(url) {
    var nextUrl = url;
    nextUrl += '&imp=' + encodeURIComponent(String(impressionId));
    if (resolvedDeviceId) nextUrl += '&did=' + encodeURIComponent(String(resolvedDeviceId));
    if (resolvedCookieId) nextUrl += '&cid=' + encodeURIComponent(String(resolvedCookieId));
    return nextUrl;
  }

  ${RUNTIME_DSP_CLICK_HELPER}
  ${RUNTIME_TRACKING_HINT_HELPER}

  function hasUnresolvedDspMacro(value) {
    if (!value) return false;
    var decoded = value;
    try {
      decoded = decodeURIComponent(value);
    } catch (_error) {}
    return /[{}]/.test(decoded) || /\\$\\{[^}]+\\}/.test(decoded);
  }

  function resolveClickHref(url) {
    var hintedUrl = ensureSmxTrackingHints(url, currentScriptSearch, 'display_wrapper');
    var trackedUrl = appendIdentity(hintedUrl);
    return applyDspClickMacro(trackedUrl, dspClickMacro);
  }

  function buildEngagementUrl(eventType, extra) {
    var params = [];
    params.push('event=' + encodeURIComponent(eventType));
    if (pageUrl) params.push('pu=' + encodeURIComponent(pageUrl));
    if (extra && extra.hd != null) params.push('hd=' + encodeURIComponent(String(extra.hd)));
    return appendIdentity(engagementBase + '&' + params.join('&'));
  }

  // Record impression
  firePixel(appendIdentity(impUrl + (pageUrl ? '&pu=' + encodeURIComponent(pageUrl) : '')));

  var viewabilityTracked = false;
  var viewabilityMeasured = false;
  var visibilityTimer = null;
  function markMeasured() {
    if (viewabilityMeasured) return;
    viewabilityMeasured = true;
    firePixel(appendIdentity(viewabilityUrl + '&state=measured&fmt=display&method=intersection_observer' + (pageUrl ? '&pu=' + encodeURIComponent(pageUrl) : '')));
  }
  function markUndetermined(reason) {
    if (viewabilityMeasured || viewabilityTracked) return;
    firePixel(appendIdentity(viewabilityUrl + '&state=undetermined&fmt=display&method=' + encodeURIComponent(reason || 'unsupported') + (pageUrl ? '&pu=' + encodeURIComponent(pageUrl) : '')));
  }
  function trackViewability() {
    if (viewabilityTracked) return;
    viewabilityTracked = true;
    firePixel(appendIdentity(viewabilityUrl + '&state=viewable&vp=1&fmt=display&method=intersection_observer&ms=1000' + (pageUrl ? '&pu=' + encodeURIComponent(pageUrl) : '')));
  }

  // Build container
  var div = document.createElement('div');
  div.style.cssText = 'width:' + w + 'px;height:' + h + 'px;overflow:hidden;position:relative;display:inline-block;';
  div.addEventListener('mouseenter', function() {
    hoverStartedAt = Date.now();
    firePixel(buildEngagementUrl('hover_start'));
  });
  div.addEventListener('mouseleave', function() {
    var duration = hoverStartedAt ? Math.max(0, Date.now() - hoverStartedAt) : 0;
    hoverStartedAt = null;
    firePixel(buildEngagementUrl('hover_end', { hd: duration }));
  });

  var link = null;
  if (${useTrackedClickWrapper ? 'true' : 'false'}) {
    link = document.createElement('a');
    link.href = resolveClickHref(clickUrl);
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.addEventListener('click', function() {
      firePixel(buildEngagementUrl('interaction'));
      if (!hasUnresolvedDspMacro(dspClickMacro)) return;
      var fallbackHref = appendIdentity(ensureSmxTrackingHints(clickUrl, currentScriptSearch, 'display_wrapper'));
      window.setTimeout(function() {
        try {
          if (document.visibilityState === 'hidden') return;
        } catch (_error) {}
        try {
          window.location.href = fallbackHref;
        } catch (_error) {}
      }, 350);
    });
  }

  if (creativeUrl && servingFormat === 'display_html') {
    var iframe = document.createElement('iframe');
    iframe.src = creativeUrl;
    iframe.width = String(w);
    iframe.height = String(h);
    iframe.scrolling = 'no';
    iframe.frameBorder = '0';
    iframe.style.border = '0';
    iframe.style.overflow = 'hidden';
    if (link) {
      iframe.style.pointerEvents = 'none';
      link.style.cssText = 'display:block;width:100%;height:100%;';
      link.appendChild(iframe);
    } else {
      iframe.style.pointerEvents = 'auto';
      div.appendChild(iframe);
    }
  } else if (creativeUrl) {
    var img = document.createElement('img');
    img.src = creativeUrl;
    img.width = w;
    img.height = h;
    img.alt = '';
    img.style.display = 'block';
    if (link) {
      link.appendChild(img);
    } else {
      div.appendChild(img);
    }
  } else {
    var placeholder = document.createElement('div');
    placeholder.style.cssText = 'width:' + w + 'px;height:' + h + 'px;background:#eee;display:flex;align-items:center;justify-content:center;font-family:sans-serif;color:#999;font-size:12px;';
    placeholder.textContent = 'Advertisement';
    if (link) {
      link.appendChild(placeholder);
    } else {
      div.appendChild(placeholder);
    }
  }

  if (link) div.appendChild(link);

  if (typeof IntersectionObserver === 'function') {
    markMeasured();
    var observer = new IntersectionObserver(function(entries) {
      entries.forEach(function(entry) {
        if (entry.isIntersecting && entry.intersectionRatio >= 0.5) {
          if (!visibilityTimer) {
            visibilityTimer = window.setTimeout(function() {
              trackViewability();
              observer.disconnect();
            }, 1000);
          }
        } else if (visibilityTimer) {
          window.clearTimeout(visibilityTimer);
          visibilityTimer = null;
        }
      });
    }, { threshold: [0.5] });
    observer.observe(div);
  } else {
    markUndetermined('no_intersection_observer');
  }

  // Inject into current script's parent
  if (currentScript && currentScript.parentNode) {
    currentScript.parentNode.insertBefore(div, currentScript);
  }
})();`;
}

function buildDisplayDocument(tag, workspaceId, baseUrl, query = {}) {
  const tagId = tag.id;
  const servingCandidate = tag.servingCandidate ?? null;
  const servingFormat = servingCandidate?.servingFormat ?? '';
  const width = servingCandidate?.width ?? 300;
  const height = servingCandidate?.height ?? 250;
  const clickUrl = servingCandidate?.clickUrl ?? '#';
  const trackingParams = new URLSearchParams({ ws: String(workspaceId) });
  const trackingDsp = normalizeDsp(query?.smx_dsp ?? query?.dsp);
  if (trackingDsp) trackingParams.set('smx_dsp', String(trackingDsp));
  trackingParams.set('smx_delivery_kind', 'display_wrapper');
  if (servingCandidate?.creativeId) trackingParams.set('c', String(servingCandidate.creativeId));
  if (servingCandidate?.creativeSizeVariantId) trackingParams.set('csv', String(servingCandidate.creativeSizeVariantId));
  const impressionUrl = `${baseUrl}/track/impression/${tagId}?${trackingParams.toString()}`;
  const viewabilityUrl = `${baseUrl}/track/viewability/${tagId}?${trackingParams.toString()}`;
  const clickTrackParams = new URLSearchParams(trackingParams);
  clickTrackParams.set('url', clickUrl);
  const rawClickTrackUrl = `${baseUrl}/track/click/${tagId}?${clickTrackParams.toString()}`;
  const clickTrackUrl = wrapTrackedClickUrlWithDspMacro(rawClickTrackUrl, query, trackingDsp);
  const dspClickMacro = String(readDspMacroValue(query, 'clickMacro') ?? '');
  const engagementBase = `${baseUrl}/track/engagement/${tagId}?${trackingParams.toString()}`;
  const useBasisNative = trackingDsp === 'basis';
  const creativeUrl = servingCandidate?.publicUrl ?? '';
  const internalClickSignals = Array.isArray(servingCandidate?.internalClickSignals)
    ? servingCandidate.internalClickSignals
    : [];
  const shouldPreferInternalClickRuntime = Boolean(
    servingCandidate?.hasInternalClickTag
    && !internalClickSignals.includes('creatopy.runtime'),
  );
  const useTrackedClickWrapper = Boolean(
    isTrackableDestinationUrl(clickUrl)
    && (servingCandidate?.clickOverrideEnabled || !shouldPreferInternalClickRuntime),
  );
  const creativeIframeUrl = buildCreativeIframeUrl(
    creativeUrl,
    rawClickTrackUrl,
    useBasisNative ? Boolean(creativeUrl && servingFormat === 'display_html') : (!useTrackedClickWrapper && shouldPreferInternalClickRuntime),
    dspClickMacro,
    engagementBase,
    !useBasisNative,
  );

  const basisClickHref = buildDspLiteralClickUrl(rawClickTrackUrl, dspClickMacro);
  const body = useBasisNative
    ? (creativeUrl && servingFormat === 'display_html'
      ? `<iframe src="${escapeXml(creativeIframeUrl)}" width="${width}" height="${height}" scrolling="no" frameborder="0" style="display:block;border:0;overflow:hidden;width:100%;height:100%;"></iframe>`
      : creativeUrl
      ? `<a href="${escapeXml(basisClickHref || rawClickTrackUrl)}" target="_blank" rel="noopener noreferrer" style="display:block;width:100%;height:100%;">
  <img src="${escapeXml(creativeUrl)}" width="${width}" height="${height}" alt="" style="display:block;border:0;width:100%;height:100%;" />
</a>`
      : `<a href="${escapeXml(basisClickHref || rawClickTrackUrl)}" target="_blank" rel="noopener noreferrer" style="display:flex;align-items:center;justify-content:center;width:100%;height:100%;background:#eee;color:#999;font:12px sans-serif;text-decoration:none;">
  Advertisement
</a>`)
    : creativeUrl && servingFormat === 'display_html'
    ? useTrackedClickWrapper
      ? `<a href="${escapeXml(rawClickTrackUrl)}" data-smx-click="${escapeXml(rawClickTrackUrl)}" data-smx-dsp-click="${escapeXml(dspClickMacro)}" target="_blank" rel="noopener noreferrer" style="display:block;width:100%;height:100%;">
  <iframe src="${escapeXml(creativeIframeUrl)}" width="${width}" height="${height}" scrolling="no" frameborder="0" style="display:block;border:0;overflow:hidden;width:100%;height:100%;pointer-events:none;"></iframe>
</a>`
      : `<iframe src="${escapeXml(creativeIframeUrl)}" width="${width}" height="${height}" scrolling="no" frameborder="0" style="display:block;border:0;overflow:hidden;width:100%;height:100%;"></iframe>`
    : creativeUrl
    ? `<a href="${escapeXml(rawClickTrackUrl)}" data-smx-click="${escapeXml(rawClickTrackUrl)}" data-smx-dsp-click="${escapeXml(dspClickMacro)}" target="_blank" rel="noopener noreferrer" style="display:block;width:100%;height:100%;">
  <img src="${escapeXml(creativeUrl)}" width="${width}" height="${height}" alt="" style="display:block;border:0;width:100%;height:100%;" />
</a>`
    : `<a href="${escapeXml(rawClickTrackUrl)}" data-smx-click="${escapeXml(rawClickTrackUrl)}" data-smx-dsp-click="${escapeXml(dspClickMacro)}" target="_blank" rel="noopener noreferrer" style="display:flex;align-items:center;justify-content:center;width:100%;height:100%;background:#eee;color:#999;font:12px sans-serif;text-decoration:none;">
  Advertisement
</a>`;

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeXml(tag.name)}</title>
  </head>
  <body style="margin:0;padding:0;overflow:hidden;width:${width}px;height:${height}px;">
    ${body}
    <img id="smx-imp-pixel" src="${escapeXml(impressionUrl)}" alt="" width="1" height="1" style="position:absolute;left:-9999px;top:-9999px;" />
    <script>
      (function() {
        var pageUrl = document.referrer || ((window.location && window.location.href) ? window.location.href : '');
        var search = new URLSearchParams(window.location.search);
        var impressionId = search.get('imp')
          || ((typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function')
            ? crypto.randomUUID()
            : 'imp-' + Date.now() + '-' + Math.random().toString(16).slice(2));
        function generateId(prefix) {
          if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
            return crypto.randomUUID();
          }
          return prefix + '-' + Date.now() + '-' + Math.random().toString(16).slice(2);
        }
        function readCookie(name) {
          try {
            var match = document.cookie.match(new RegExp('(?:^|; )' + name.replace(/[.$?*|{}()\\[\\]\\\\/+^]/g, '\\\\$&') + '=([^;]*)'));
            return match ? decodeURIComponent(match[1]) : '';
          } catch (_error) {
            return '';
          }
        }
        function writeCookie(name, value, maxAgeDays) {
          try {
            var expires = '';
            if (maxAgeDays) expires = '; max-age=' + String(Math.floor(maxAgeDays * 24 * 60 * 60));
            document.cookie = name + '=' + encodeURIComponent(value) + expires + '; path=/; SameSite=None; Secure';
          } catch (_error) {}
        }
        function readStorage(key) {
          try {
            return window.localStorage ? String(window.localStorage.getItem(key) || '') : '';
          } catch (_error) {
            return '';
          }
        }
        function writeStorage(key, value) {
          try {
            if (window.localStorage) window.localStorage.setItem(key, value);
          } catch (_error) {}
        }
        function resolveIdentity(kind) {
          var queryKey = kind === 'device' ? 'did' : 'cid';
          var storageKey = kind === 'device' ? 'smx_device_id' : 'smx_cookie_id';
          var existing = search.get(queryKey) || readStorage(storageKey) || readCookie(storageKey);
          if (existing) {
            writeStorage(storageKey, existing);
            writeCookie(storageKey, existing, kind === 'device' ? 365 : 30);
            return existing;
          }
          var created = generateId(kind === 'device' ? 'dev' : 'cid');
          writeStorage(storageKey, created);
          writeCookie(storageKey, created, kind === 'device' ? 365 : 30);
          return created;
        }
        var resolvedDeviceId = resolveIdentity('device');
        var resolvedCookieId = resolveIdentity('cookie');
        var hoverStartedAt = null;
        function fire(url) {
          var img = new Image();
          img.src = url;
        }
        function appendIdentity(url) {
          var nextUrl = url;
          nextUrl += '&imp=' + encodeURIComponent(String(impressionId));
          if (resolvedDeviceId) nextUrl += '&did=' + encodeURIComponent(String(resolvedDeviceId));
          if (resolvedCookieId) nextUrl += '&cid=' + encodeURIComponent(String(resolvedCookieId));
          return nextUrl;
        }
        var impPixel = document.getElementById('smx-imp-pixel');
        if (impPixel && pageUrl) {
          impPixel.src = appendIdentity(${JSON.stringify(impressionUrl)} + '&pu=' + encodeURIComponent(pageUrl));
        } else if (impPixel) {
          impPixel.src = appendIdentity(${JSON.stringify(impressionUrl)});
        }
        var viewabilityTracked = false;
        var viewabilityMeasured = false;
        var visibilityTimer = null;
        function markMeasured() {
          if (viewabilityMeasured) return;
          viewabilityMeasured = true;
          fire(appendIdentity(${JSON.stringify(viewabilityUrl)} + '&state=measured&fmt=display&method=intersection_observer' + (pageUrl ? '&pu=' + encodeURIComponent(pageUrl) : '')));
        }
        function markUndetermined(reason) {
          if (viewabilityMeasured || viewabilityTracked) return;
          fire(appendIdentity(${JSON.stringify(viewabilityUrl)} + '&state=undetermined&fmt=display&method=' + encodeURIComponent(reason || 'unsupported') + (pageUrl ? '&pu=' + encodeURIComponent(pageUrl) : '')));
        }
        function trackViewability() {
          if (viewabilityTracked) return;
          viewabilityTracked = true;
          fire(appendIdentity(${JSON.stringify(viewabilityUrl)} + '&state=viewable&vp=1&fmt=display&method=intersection_observer&ms=1000' + (pageUrl ? '&pu=' + encodeURIComponent(pageUrl) : '')));
        }
        ${useBasisNative ? '' : RUNTIME_DSP_CLICK_HELPER}
        ${useBasisNative ? '' : RUNTIME_TRACKING_HINT_HELPER}
        function hasUnresolvedDspMacro(value) {
          if (!value) return false;
          var decoded = value;
          try {
            decoded = decodeURIComponent(value);
          } catch (_error) {}
          return /[{}]/.test(decoded) || /\\$\\{[^}]+\\}/.test(decoded);
        }
        function resolveClickHref(url, macroOverride) {
          var hintedUrl = ensureSmxTrackingHints(url, search, 'display_wrapper');
          var trackedUrl = appendIdentity(hintedUrl);
          var macroValue = macroOverride || search.get('smx_dsp_click') || search.get('cuu') || '';
          return applyDspClickMacro(trackedUrl, macroValue);
        }
        if (!${JSON.stringify(useBasisNative)}) {
          Array.prototype.forEach.call(document.querySelectorAll('a[href]'), function(anchor) {
            var baseClick = anchor.getAttribute('data-smx-click') || anchor.href;
            var macroOverride = anchor.getAttribute('data-smx-dsp-click') || '';
            anchor.href = resolveClickHref(baseClick, macroOverride);
            anchor.addEventListener('click', function() {
              if (!hasUnresolvedDspMacro(macroOverride || search.get('smx_dsp_click') || search.get('cuu') || '')) return;
              var fallbackHref = appendIdentity(ensureSmxTrackingHints(baseClick, search, 'display_wrapper'));
              window.setTimeout(function() {
                try {
                  if (document.visibilityState === 'hidden') return;
                } catch (_error) {}
                try {
                  window.location.href = fallbackHref;
                } catch (_error) {}
              }, 350);
            });
          });
        }
        function engagementUrl(eventType, hoverDurationMs) {
          var params = ['event=' + encodeURIComponent(eventType)];
          if (pageUrl) params.push('pu=' + encodeURIComponent(pageUrl));
          if (hoverDurationMs != null) params.push('hd=' + encodeURIComponent(String(hoverDurationMs)));
          return appendIdentity(${JSON.stringify(engagementBase)} + '&' + params.join('&'));
        }
        if (!${JSON.stringify(useBasisNative)}) {
          document.body.addEventListener('mouseenter', function() {
            hoverStartedAt = Date.now();
            fire(engagementUrl('hover_start'));
          });
          document.body.addEventListener('mouseleave', function() {
            var duration = hoverStartedAt ? Math.max(0, Date.now() - hoverStartedAt) : 0;
            hoverStartedAt = null;
            fire(engagementUrl('hover_end', duration));
          });
          document.body.addEventListener('click', function() {
            fire(engagementUrl('interaction'));
          });
        }
        if (typeof IntersectionObserver === 'function') {
          markMeasured();
          var observer = new IntersectionObserver(function(entries) {
            entries.forEach(function(entry) {
              if (entry.isIntersecting && entry.intersectionRatio >= 0.5) {
                if (!visibilityTimer) {
                  visibilityTimer = window.setTimeout(function() {
                    trackViewability();
                    observer.disconnect();
                  }, 1000);
                }
              } else if (visibilityTimer) {
                window.clearTimeout(visibilityTimer);
                visibilityTimer = null;
              }
            });
          }, { threshold: [0.5] });
          observer.observe(document.body);
        } else {
          markUndetermined('no_intersection_observer');
        }
      })();
    </script>
  </body>
</html>`;
}

async function loadDisplayTag(req, reply, pool) {
  const { workspaceId } = req.authSession ?? req.apiKeyAuth ?? {};
  const { tagId } = req.params;
  const tag = workspaceId
    ? await getTagServingSnapshot(pool, workspaceId, tagId, {
        requestedSize: readRequestedSize(req.query),
        rotationSeed: readRotationSeed(req.query),
      })
    : await getTagServingSnapshotById(pool, tagId, {
        requestedSize: readRequestedSize(req.query),
        rotationSeed: readRotationSeed(req.query),
      });
  if (!tag) {
    reply.status(404).send({ error: 'Not Found', message: 'Tag not found' });
    return null;
  }

  if (tag.format === 'vast' || tag.format === 'vast_video') {
    reply.status(400).send({
      error: 'Bad Request',
      message: 'Display endpoints cannot serve VAST tags',
    });
    return null;
  }

  return { tag, workspaceId: tag.workspace_id ?? workspaceId };
}

export function handleVastRoutes(app, { requireWorkspace, requireApiKey, pool }) {
  // Middleware that accepts session or api key when present, but does not require either.
  async function optionalAuth(req, reply) {
    // Try session first
    if (req.session?.userId && req.session?.workspaceId) {
      await requireWorkspace(req, reply);
      return;
    }
    // Fall back to API key
    const authHeader = req.headers['authorization'] ?? '';
    if (authHeader.startsWith('Bearer ')) {
      await requireApiKey(req, reply);
      if (req.apiKeyAuth) {
        // Synthesize authSession for downstream handlers
        req.authSession = {
          userId: null,
          workspaceId: req.apiKeyAuth.workspaceId,
          role: 'member',
          email: null,
        };
      }
      return;
    }
  }

  // GET /v1/vast/tags/:tagId — serve VAST XML for a tag
  app.get('/v1/vast/tags/:tagId', { preHandler: optionalAuth }, async (req, reply) => {
    const baseUrl = getRequestBaseUrl(req, ['VAST_LIVE_PUBLIC_BASE_URL']);
    const { workspaceId } = req.authSession ?? req.apiKeyAuth ?? {};
    const { tagId } = req.params;

    const tag = workspaceId
      ? await getTagServingSnapshot(pool, workspaceId, tagId, {
          requestedSize: readRequestedSize(req.query),
          rotationSeed: readRotationSeed(req.query),
        })
      : await getTagServingSnapshotById(pool, tagId, {
          requestedSize: readRequestedSize(req.query),
          rotationSeed: readRotationSeed(req.query),
        });
    if (!tag) {
      return reply.status(404).send({ error: 'Not Found', message: 'Tag not found' });
    }

    if (tag.format !== 'vast' && tag.format !== 'vast_video') {
      return reply.status(400).send({
        error: 'Bad Request',
        message: `Tag format is "${tag.format}", not a VAST format`,
      });
    }

    const xml = buildVastXml(tag, tag.workspace_id ?? workspaceId, baseUrl, req.query);

    reply.header('Access-Control-Allow-Origin', '*');
    reply.header('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    reply.header('Content-Type', 'application/xml; charset=utf-8');
    reply.header('Cache-Control', 'no-cache, no-store, must-revalidate');
    reply.header('X-Content-Type-Options', 'nosniff');
    return reply.send(xml);
  });

  // GET /v1/vast/tags/:tagId/:profile.xml — serve a stable, profile-based VAST XML for a tag
  app.get('/v1/vast/tags/:tagId/:profile', {
    onSend: async (_req, reply, payload) => {
      reply.removeHeader('set-cookie');
      reply.removeHeader('vary');
      reply.removeHeader('access-control-allow-credentials');
      reply.removeHeader('access-control-allow-origin');
      reply.removeHeader('access-control-allow-methods');
      return payload;
    },
  }, async (req, reply) => {
    const baseUrl = getRequestBaseUrl(req, ['VAST_LIVE_PUBLIC_BASE_URL']);
    const { tagId, profile: requestedProfile } = req.params;
    const profile = resolveLiveVastProfile(requestedProfile);

    if (!profile) {
      return reply.status(404).send({ error: 'Not Found', message: 'Unsupported VAST profile' });
    }

    const tag = await getTagServingSnapshotById(pool, tagId, {
      requestedSize: readRequestedSize(req.query),
      rotationSeed: readRotationSeed(req.query),
    });
    if (!tag) {
      return reply.status(404).send({ error: 'Not Found', message: 'Tag not found' });
    }

    if (tag.format !== 'vast' && tag.format !== 'vast_video') {
      return reply.status(400).send({
        error: 'Bad Request',
        message: `Tag format is "${tag.format}", not a VAST format`,
      });
    }

    const xml = buildVastXml(
      tag,
      tag.workspace_id,
      baseUrl,
      {
        ...buildStaticVastTemplateQuery(profile.dsp),
        ...req.query,
      },
    );

    reply.header('Access-Control-Allow-Origin', '*');
    reply.header('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    reply.header('Content-Type', 'application/xml; charset=utf-8');
    reply.header('Cache-Control', 'no-cache, no-store, must-revalidate');
    reply.header('Pragma', 'no-cache');
    reply.header('Expires', '0');
    reply.header('X-Content-Type-Options', 'nosniff');
    return reply.send(xml);
  });

  // POST /v1/vast/tags/:tagId/publish-static — materialize a public XML delivery artifact in R2
  app.post('/v1/vast/tags/:tagId/publish-static', { preHandler: requireWorkspace }, async (req, reply) => {
    const { workspaceId } = req.authSession;
    const { tagId } = req.params;
    const requestedDsp = String(req.body?.dsp ?? req.query?.dsp ?? '').trim();
    const normalizedDsp = requestedDsp.toLowerCase() === 'default'
      ? ''
      : normalizeDsp(requestedDsp);
    const profile = buildStaticVastProfile(normalizedDsp);

    if (!hasUploadStorageConfig()) {
      return reply.status(503).send({
        error: 'Service Unavailable',
        message: 'Object storage is not configured for static VAST publishing',
      });
    }

    if (normalizedDsp && !getDspMacroConfig(normalizedDsp)) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: `Unsupported DSP profile "${requestedDsp}"`,
      });
    }
    const [deliveryArtifact] = await publishStaticVastArtifactsForTag({
      pool,
      workspaceId,
      tagId,
      baseUrl: getRequestBaseUrl(req),
      requestedSize: readRequestedSize(req.query),
      dspProfiles: [normalizedDsp],
      trigger: 'manual_publish_static',
    });
    if (!deliveryArtifact) {
      return reply.status(404).send({ error: 'Not Found', message: 'Tag not found or not a VAST tag' });
    }

    return reply.send({
      deliveryArtifact,
    });
  });

  // POST /v1/vast/tags/:tagId/queue-static-publish — enqueue a background static VAST publish job
  app.post('/v1/vast/tags/:tagId/queue-static-publish', { preHandler: requireWorkspace }, async (req, reply) => {
    const { workspaceId } = req.authSession;
    const { tagId } = req.params;
    const requestedDsp = String(req.body?.dsp ?? req.query?.dsp ?? '').trim();
    const normalizedDsp = normalizeDsp(requestedDsp);

    if (!hasUploadStorageConfig()) {
      return reply.status(503).send({
        error: 'Service Unavailable',
        message: 'Object storage is not configured for static VAST publishing',
      });
    }

    if (normalizedDsp && !getDspMacroConfig(normalizedDsp)) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: `Unsupported DSP profile "${requestedDsp}"`,
      });
    }

    const job = await enqueueStaticVastPublish(pool, {
      workspaceId,
      tagId,
      baseUrl: getRequestBaseUrl(req),
      trigger: 'manual_queue_static_publish',
      requestedSize: readRequestedSize(req.query),
      dspProfiles: normalizedDsp ? [normalizedDsp] : ['', 'basis', 'illumin'],
      priority: 10,
    });

    if (!job) {
      return reply.status(404).send({ error: 'Not Found', message: 'Tag not found or not a VAST tag' });
    }

    return reply.send({
      queued: true,
      job: {
        id: job.id,
        status: job.status,
        priority: job.priority,
        createdAt: job.created_at ?? null,
        updatedAt: job.updated_at ?? null,
      },
    });
  });

  app.get('/v1/vast/omid-verification.js', { preHandler: optionalAuth }, async (_req, reply) => {
    reply.header('Content-Type', 'application/javascript; charset=utf-8');
    reply.header('Cache-Control', 'public, max-age=300');
    reply.header('X-Content-Type-Options', 'nosniff');
    return reply.send(OMID_VERIFICATION_SCRIPT);
  });

  async function serveDisplayJavascript(req, reply) {
    const baseUrl = getRequestBaseUrl(req);
    const loaded = await loadDisplayTag(req, reply, pool);
    if (!loaded) return;

    const snippet = buildDisplaySnippet(loaded.tag, loaded.workspaceId, baseUrl, req.query);
    reply.header('Content-Type', 'application/javascript; charset=utf-8');
    reply.header('Cache-Control', 'no-cache, no-store, must-revalidate');
    return reply.send(snippet);
  }

  async function serveNativeJavascript(req, reply) {
    const baseUrl = getRequestBaseUrl(req);
    const loaded = await loadDisplayTag(req, reply, pool);
    if (!loaded) return;

    const dsp = normalizeDsp(req.query?.smx_dsp ?? req.query?.dsp);
    if (dsp === 'basis') {
      const width = Number(loaded.tag.serving_width ?? 0) || 300;
      const height = Number(loaded.tag.serving_height ?? 0) || 250;
      const tagId = loaded.tag.id;
      const nativeJsUrl = applyDspMacrosToDeliveryUrl(`${baseUrl}/v1/tags/native/${tagId}.js`, dsp, DSP_DELIVERY_KINDS.DISPLAY_WRAPPER);
      const vastUrl = applyDspMacrosToDeliveryUrl(`${baseUrl}/v1/vast/tags/${tagId}`, dsp, DSP_DELIVERY_KINDS.VIDEO);
      const servingCandidate = loaded.tag.servingCandidate ?? null;
      const trackingParams = new URLSearchParams({ ws: String(loaded.workspaceId) });
      trackingParams.set('smx_dsp', String(dsp));
      trackingParams.set('smx_delivery_kind', 'display_wrapper');
      if (servingCandidate?.creativeId) trackingParams.set('c', String(servingCandidate.creativeId));
      if (servingCandidate?.creativeSizeVariantId) trackingParams.set('csv', String(servingCandidate.creativeSizeVariantId));
      const rawClickTrackUrl = `${baseUrl}/track/click/${tagId}?${trackingParams.toString()}${servingCandidate?.clickUrl ? `&url=${encodeURIComponent(String(servingCandidate.clickUrl))}` : ''}`;
      const trackerClickUrl = applyDspMacrosToDeliveryUrl(`${baseUrl}/v1/tags/tracker/${tagId}/click`, dsp, DSP_DELIVERY_KINDS.TRACKER_CLICK);
      const trackerEngagementUrl = `${baseUrl}/track/engagement/${tagId}?${trackingParams.toString()}`;
      const trackerImpressionUrl = `${baseUrl}/track/impression/${tagId}?${trackingParams.toString()}`;
      const trackerViewabilityUrl = `${baseUrl}/track/viewability/${tagId}?${trackingParams.toString()}`;
      const dspClickMacro = String(readDspMacroValue(req.query, 'clickMacro', dsp) ?? '');
      const directCreativeIframeUrl = buildCreativeIframeUrl(
        servingCandidate?.publicUrl ?? '',
        rawClickTrackUrl,
        true,
        dspClickMacro,
        trackerEngagementUrl,
        false,
      );
      const displayHtmlUrl = servingCandidate?.publicUrl && servingCandidate?.servingFormat === 'display_html'
        ? directCreativeIframeUrl
        : applyDspMacrosToDeliveryUrl(`${baseUrl}/v1/tags/display/${tagId}.html`, dsp, DSP_DELIVERY_KINDS.DISPLAY_WRAPPER);
      const snippet = buildBasisNativeSnippet({
        variant: 'native-js',
        tagId,
        displayHtmlUrl,
        nativeJsUrl,
        vastUrl,
        trackerClickUrl,
        trackerEngagementUrl,
        trackerImpressionUrl,
        trackerViewabilityUrl,
        width,
        height,
      });
      reply.header('Content-Type', 'application/javascript; charset=utf-8');
      reply.header('Cache-Control', 'no-cache, no-store, must-revalidate');
      return reply.send(snippet);
    }

    return serveDisplayJavascript(req, reply);
  }

  async function serveDisplayDocument(req, reply) {
    const baseUrl = getRequestBaseUrl(req);
    const loaded = await loadDisplayTag(req, reply, pool);
    if (!loaded) return;

    const html = buildDisplayDocument(loaded.tag, loaded.workspaceId, baseUrl, req.query);
    reply.header('Content-Type', 'text/html; charset=utf-8');
    reply.header('Cache-Control', 'no-cache, no-store, must-revalidate');
    reply.removeHeader('X-Frame-Options');
    reply.header('Content-Security-Policy', "default-src 'self' data: blob: https:; img-src * data: blob:; media-src * data: blob:; script-src 'unsafe-inline' https:; style-src 'unsafe-inline' https:;");
    return reply.send(html);
  }

  // Legacy JS endpoint kept for compatibility.
  app.get('/v1/vast/display/:tagId', { preHandler: optionalAuth }, serveDisplayJavascript);
  // Semantically clearer display endpoints for embed snippets.
  app.get('/v1/tags/display/:tagId.js', { preHandler: optionalAuth }, serveDisplayJavascript);
  app.get('/v1/tags/display/:tagId.html', { preHandler: optionalAuth }, serveDisplayDocument);
  app.get('/v1/tags/native/:tagId.js', { preHandler: optionalAuth }, serveNativeJavascript);
}
