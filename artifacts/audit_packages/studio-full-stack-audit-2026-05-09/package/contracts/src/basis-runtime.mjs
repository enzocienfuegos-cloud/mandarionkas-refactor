// packages/contracts/src/basis-runtime.mjs
//
// Basis native display runtime — publisher-side execution environment.
//
// This file is the SOURCE of the minified blob embedded in buildBasisNativeSnippet().
// Edit here, then run `npm run build:basis-runtime` to regenerate the blob in
// basis-runtime.generated.mjs. Never edit the generated file directly.
//
// Inputs (injected at snippet-generation time as JS variable declarations
// before this IIFE executes):
//   rootId        — unique DOM id for the container div
//   width         — creative width in px (string)
//   height        — creative height in px (string)
//   displayHtmlUrl — URL of the .html serving endpoint
//   engagementBase — URL base for hover/engagement tracker
//   impressionBase — URL base for impression tracker
//   viewabilityBase — URL base for viewability tracker (empty string = disabled)

(function () {
  // ── URL utilities ─────────────────────────────────────────────────────────

  function withParams(base, params) {
    if (!base) return '';
    var sep = base.indexOf('?') === -1 ? '?' : '&';
    return base + sep + params.join('&');
  }

  function currentPageUrl() {
    try {
      return (window.top && window.top.location && window.top.location.href)
        ? window.top.location.href
        : (window.location && window.location.href)
          ? window.location.href
          : '';
    } catch (_e1) {
      try { return window.location && window.location.href ? window.location.href : ''; }
      catch (_e2) { return ''; }
    }
  }

  function currentDomain(pageUrl) {
    if (!pageUrl) return '';
    try { return new URL(pageUrl).hostname || ''; } catch (_e) { return ''; }
  }

  function base64UrlEncode(text) {
    try {
      var encoded = btoa(unescape(encodeURIComponent(text)));
      return encoded.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    } catch (_e) { return ''; }
  }

  function appendCtx(url, ctxToken) {
    if (!url) return '';
    if (!ctxToken) return url;
    return withParams(url, ['ctx=' + encodeURIComponent(ctxToken)]);
  }

  function fire(url) {
    try { var img = new Image(); img.src = url; } catch (_e) {}
  }

  // ── Source params (passed via script.src query string) ────────────────────

  var script = document.currentScript;
  var parent = script && script.parentNode ? script.parentNode : null;
  if (!parent || !script) return;

  function readSourceParams() {
    try {
      var src = script && script.src ? new URL(script.src, window.location.href) : null;
      if (!src) return {};
      var out = {};
      src.searchParams.forEach(function (value, key) { out[key] = value; });
      return out;
    } catch (_e) { return {}; }
  }

  var sourceParams = readSourceParams();
  var pageUrl = currentPageUrl();
  if (pageUrl) sourceParams.pu = pageUrl;
  if (!sourceParams.dom) {
    var resolvedDomain = currentDomain(pageUrl);
    if (resolvedDomain) sourceParams.dom = resolvedDomain;
  }

  var ctxToken = base64UrlEncode(JSON.stringify(sourceParams));

  // ── Event URL builder ─────────────────────────────────────────────────────

  function buildEventUrl(base, eventType, hoverDurationMs) {
    if (!base) return '';
    var params = [];
    if (eventType) params.push('event=' + encodeURIComponent(eventType));
    if (pageUrl) params.push('pu=' + encodeURIComponent(pageUrl));
    if (typeof hoverDurationMs === 'number' && hoverDurationMs >= 0) {
      params.push('hd=' + encodeURIComponent(String(Math.round(hoverDurationMs))));
    }
    return appendCtx(withParams(base, params), ctxToken);
  }

  // ── Identity graph ────────────────────────────────────────────────────────

  function generateId(prefix) {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    return prefix + '-' + Date.now() + '-' + Math.random().toString(16).slice(2);
  }

  function readCookie(name) {
    try {
      var match = document.cookie.match(
        new RegExp('(?:^|; )' + name.replace(/[.$?*|{}()[\]\\/+^]/g, '\\$&') + '=([^;]*)')
      );
      return match ? decodeURIComponent(match[1]) : '';
    } catch (_e) { return ''; }
  }

  function writeCookie(name, value, maxAgeDays) {
    try {
      var expires = '';
      if (maxAgeDays) expires = '; max-age=' + String(Math.floor(maxAgeDays * 24 * 60 * 60));
      document.cookie = name + '=' + encodeURIComponent(value) + expires + '; path=/; SameSite=None; Secure';
    } catch (_e) {}
  }

  // localStorage with cookie fallback (Safari ITP / Firefox ETP compat)
  function readStorage(key) {
    try { return window.localStorage ? String(window.localStorage.getItem(key) || '') : ''; }
    catch (_e) { return readCookie(key); }
  }

  function writeStorage(key, value) {
    try { if (window.localStorage) window.localStorage.setItem(key, value); }
    catch (_e) { writeCookie(key, value, 30); }
  }

  function resolveIdentity(kind) {
    var queryKey = kind === 'device' ? 'did' : 'cid';
    var storageKey = kind === 'device' ? 'smx_device_id' : 'smx_cookie_id';
    var existing = sourceParams[queryKey] || readStorage(storageKey) || readCookie(storageKey);
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

  var impressionId = sourceParams.imp || generateId('imp');
  var resolvedDeviceId = resolveIdentity('device');
  var resolvedCookieId = resolveIdentity('cookie');

  function appendIdentity(url) {
    var next = url;
    if (!next) return next;
    next += (next.indexOf('?') === -1 ? '?' : '&') + 'imp=' + encodeURIComponent(String(impressionId));
    if (resolvedDeviceId) next += '&did=' + encodeURIComponent(String(resolvedDeviceId));
    if (resolvedCookieId) next += '&cid=' + encodeURIComponent(String(resolvedCookieId));
    return next;
  }

  function collectDeviceSignals() {
    var signals = {};
    try {
      signals.sf_tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
      signals.sf_lang = navigator.language || '';
      signals.sf_scr = String(screen.width) + 'x' + String(screen.height) + 'x' + String(window.devicePixelRatio || 1);
      signals.sf_touch = String(navigator.maxTouchPoints > 0 ? 1 : 0);
      if ('deviceMemory' in navigator && navigator.deviceMemory) signals.sf_mem = String(navigator.deviceMemory);
      if ('hardwareConcurrency' in navigator && navigator.hardwareConcurrency) signals.sf_cpu = String(navigator.hardwareConcurrency);
    } catch (_e) {}
    return signals;
  }

  function appendDeviceSignals(url) {
    if (!url) return url;
    var next = url;
    var signals = collectDeviceSignals();
    Object.keys(signals).forEach(function (key) {
      var value = signals[key];
      if (!value) return;
      next += (next.indexOf('?') === -1 ? '?' : '&') + encodeURIComponent(key) + '=' + encodeURIComponent(value);
    });
    return next;
  }

  // ── DOM: iframe + container ───────────────────────────────────────────────
  //
  // smx_no_imp=1 tells the .html serving endpoint to suppress its own impression
  // pixel — the blob fires impression directly via impressionBase below, so the
  // .html wrapper must not double-count.

  var iframeSrc = appendIdentity(
    appendCtx(withParams(displayHtmlUrl, ['smx_no_imp=1']), ctxToken)
  );

  var iframe = document.createElement('iframe');
  iframe.src = iframeSrc;
  iframe.width = width;
  iframe.height = height;
  iframe.scrolling = 'no';
  iframe.frameBorder = '0';
  iframe.marginWidth = '0';
  iframe.marginHeight = '0';
  iframe.setAttribute(
    'sandbox',
    'allow-scripts allow-same-origin allow-popups allow-forms allow-top-navigation-by-user-activation'
  );
  iframe.style.border = '0';
  iframe.style.overflow = 'hidden';
  iframe.style.position = 'relative';
  iframe.style.zIndex = '1';
  iframe.style.width = '100%';
  iframe.style.height = '100%';

  var root = document.createElement('div');
  root.id = rootId;
  root.style.position = 'relative';
  root.style.display = 'inline-block';
  root.style.width = width + 'px';
  root.style.height = height + 'px';
  root.appendChild(iframe);

  // ── Engagement (hover) tracking ───────────────────────────────────────────

  var hoverStartedAt = null;

  root.addEventListener('mouseenter', function () {
    hoverStartedAt = Date.now();
    var url = appendIdentity(buildEventUrl(engagementBase, 'hover_start'));
    if (url) fire(url);
  });

  root.addEventListener('mouseleave', function () {
    var duration = hoverStartedAt ? (Date.now() - hoverStartedAt) : 0;
    hoverStartedAt = null;
    var url = appendIdentity(buildEventUrl(engagementBase, 'hover_end', duration));
    if (url) fire(url);
  });

  // ── Impression fire ───────────────────────────────────────────────────────

  var impressionUrl = appendDeviceSignals(appendIdentity(appendCtx(impressionBase, ctxToken)));
  if (impressionUrl) fire(impressionUrl);

  // ── Viewability (MRC: 50% for 1000ms continuous) ──────────────────────────

  var measured = false;
  var tracked = false;
  var visibilityTimer = null;

  function viewableUrl() {
    return appendIdentity(withParams(appendCtx(viewabilityBase, ctxToken), [
      'state=viewable', 'vp=1', 'fmt=display',
      'method=intersection_observer', 'ms=1000',
    ].concat(pageUrl ? ['pu=' + encodeURIComponent(pageUrl)] : [])));
  }

  function measuredStateUrl() {
    return appendIdentity(withParams(appendCtx(viewabilityBase, ctxToken), [
      'state=measured', 'fmt=display', 'method=intersection_observer',
    ].concat(pageUrl ? ['pu=' + encodeURIComponent(pageUrl)] : [])));
  }

  if (typeof IntersectionObserver === 'function' && viewabilityBase) {
    if (!measured) { measured = true; fire(measuredStateUrl()); }
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting && entry.intersectionRatio >= 0.5) {
          if (!visibilityTimer) {
            visibilityTimer = window.setTimeout(function () {
              if (tracked) return;
              tracked = true;
              fire(viewableUrl());
              observer.disconnect();
            }, 1000);
          }
        } else if (visibilityTimer) {
          window.clearTimeout(visibilityTimer);
          visibilityTimer = null;
        }
      });
    }, { threshold: [0.5] });
    observer.observe(root);
  }

  // ── Mount ─────────────────────────────────────────────────────────────────

  parent.insertBefore(root, script);
  parent.removeChild(script);
}());
