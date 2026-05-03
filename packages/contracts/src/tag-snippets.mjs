// packages/contracts/src/tag-snippets.mjs
//
// Pure functions for generating ad tag snippets.
// No React, no DOM, no side effects. Importable from API and web.
//
// The Basis native blob is the minified version of basis-runtime.mjs.
// When basis-runtime.mjs changes, regenerate with: npm run build:basis-runtime
// Then paste the result into BASIS_NATIVE_BLOB below.

import {
  applyDspMacrosToDeliveryUrl,
  buildVastWrapperSnippet,
  DSP_DELIVERY_KINDS,
  shouldUseBasisNativeDelivery,
} from './dsp-macros.mjs';

// ── Constants ──────────────────────────────────────────────────────────────

// Minified blob of basis-runtime.mjs.
// Source of truth: packages/contracts/src/basis-runtime.mjs
// Regenerate: npm run build:basis-runtime
// BEGIN BASIS_NATIVE_BLOB
const BASIS_NATIVE_BLOB = `(function(){function l(e,t){if(!e)return"";var n=e.indexOf("?")===-1?"?":"&";return e+n+t.join("&")}function P(){try{return window.top&&window.top.location&&window.top.location.href?window.top.location.href:window.location&&window.location.href?window.location.href:""}catch(e){try{return window.location&&window.location.href?window.location.href:""}catch(t){return""}}}function L(e){if(!e)return"";try{return new URL(e).hostname||""}catch(t){return""}}function N(e){try{var t=btoa(unescape(encodeURIComponent(e)));return t.replace(/\\+/g,"-").replace(/\\//g,"_").replace(/=+$/,"")}catch(n){return""}}function s(e,t){return e?t?l(e,["ctx="+encodeURIComponent(t)]):e:""}function f(e){try{var t=new Image;t.src=e}catch(n){}}var a=document.currentScript,h=a&&a.parentNode?a.parentNode:null;if(!h||!a)return;function k(){try{var e=a&&a.src?new URL(a.src,window.location.href):null;if(!e)return{};var t={};return e.searchParams.forEach(function(n,o){t[o]=n}),t}catch(n){return{}}}var d=k(),c=P();if(c&&(d.pu=c),!d.dom){var y=L(c);y&&(d.dom=y)}var m=N(JSON.stringify(d));function I(e,t,n){if(!e)return"";var o=[];return t&&o.push("event="+encodeURIComponent(t)),c&&o.push("pu="+encodeURIComponent(c)),typeof n=="number"&&n>=0&&o.push("hd="+encodeURIComponent(String(Math.round(n)))),s(l(e,o),m)}function U(e){return typeof crypto!="undefined"&&typeof crypto.randomUUID=="function"?crypto.randomUUID():e+"-"+Date.now()+"-"+Math.random().toString(16).slice(2)}function S(e){try{var t=document.cookie.match(new RegExp("(?:^|; )"+e.replace(/[.$?*|{}()[\\]\\\\/+^]/g,"\\\\$&")+"=([^;]*)"));return t?decodeURIComponent(t[1]):""}catch(n){return""}}function g(e,t,n){try{var o="";n&&(o="; max-age="+String(Math.floor(n*24*60*60))),document.cookie=e+"="+encodeURIComponent(t)+o+"; path=/; SameSite=None; Secure"}catch(w){}}function D(e){try{return window.localStorage?String(window.localStorage.getItem(e)||""):""}catch(t){return S(e)}}function _(e,t){try{window.localStorage&&window.localStorage.setItem(e,t)}catch(n){g(e,t,30)}}function C(e){var t=e==="device"?"did":"cid",n=e==="device"?"smx_device_id":"smx_cookie_id",o=d[t]||D(n)||S(n);if(o)return _(n,o),g(n,o,e==="device"?365:30),o;var w=U(e==="device"?"dev":"cid");return _(n,w),g(n,w,e==="device"?365:30),w}var $=d.imp||U("imp"),b=C("device"),R=C("cookie");function u(e){var t=e;return t&&(t+=(t.indexOf("?")===-1?"?":"&")+"imp="+encodeURIComponent(String($)),b&&(t+="&did="+encodeURIComponent(String(b))),R&&(t+="&cid="+encodeURIComponent(String(R))),t)}var H=u(s(l(displayHtmlUrl,["smx_no_imp=1"]),m)),r=document.createElement("iframe");r.src=H,r.width=width,r.height=height,r.scrolling="no",r.frameBorder="0",r.marginWidth="0",r.marginHeight="0",r.setAttribute("sandbox","allow-scripts allow-same-origin allow-popups allow-forms allow-top-navigation-by-user-activation"),r.style.border="0",r.style.overflow="hidden",r.style.position="relative",r.style.zIndex="1",r.style.width="100%",r.style.height="100%";var i=document.createElement("div");i.id=rootId,i.style.position="relative",i.style.display="inline-block",i.style.width=width+"px",i.style.height=height+"px",i.appendChild(r);var v=null;i.addEventListener("mouseenter",function(){v=Date.now();var e=u(I(engagementBase,"hover_start"));e&&f(e)}),i.addEventListener("mouseleave",function(){var e=v?Date.now()-v:0;v=null;var t=u(I(engagementBase,"hover_end",e));t&&f(t)});var x=u(s(impressionBase,m));x&&f(x);var E=!1,B=!1,p=null;function K(){return u(l(s(viewabilityBase,m),["state=viewable","vp=1","fmt=display","method=intersection_observer","ms=1000"].concat(c?["pu="+encodeURIComponent(c)]:[])))}function T(){return u(l(s(viewabilityBase,m),["state=measured","fmt=display","method=intersection_observer"].concat(c?["pu="+encodeURIComponent(c)]:[])))}if(typeof IntersectionObserver=="function"&&viewabilityBase){E||(E=!0,f(T()));var O=new IntersectionObserver(function(e){e.forEach(function(t){t.isIntersecting&&t.intersectionRatio>=.5?p||(p=window.setTimeout(function(){B||(B=!0,f(K()),O.disconnect())},1e3)):p&&(window.clearTimeout(p),p=null)})},{threshold:[.5]});O.observe(i)}h.insertBefore(i,a),h.removeChild(a)})()`;
// END BASIS_NATIVE_BLOB

function escapeScriptContext(jsonStr) {
  return jsonStr.replace(/<\//g, '<\\/');
}

export function buildDisplayJsSnippet({ displayJsUrl, displayHtmlUrl, width, height }) {
  return `<script src="${displayJsUrl}" async></script>\n<noscript>\n  <iframe src="${displayHtmlUrl}" width="${width}" height="${height}" scrolling="no" frameborder="0" style="border:0;overflow:hidden;"></iframe>\n</noscript>`;
}

export function buildDisplayIframeSnippet({ displayHtmlUrl, width, height }) {
  return `<iframe\n  src="${displayHtmlUrl}"\n  width="${width}"\n  height="${height}"\n  scrolling="no"\n  frameborder="0"\n  marginwidth="0"\n  marginheight="0"\n  style="border:0;overflow:hidden;"\n  sandbox="allow-scripts allow-same-origin allow-popups allow-forms allow-top-navigation-by-user-activation"\n></iframe>`;
}

export function buildDisplayInsSnippet({ displayHtmlUrl, tagId, width, height }) {
  const slotId = `smx-ad-slot-${tagId}`;
  const safeUrl = escapeScriptContext(JSON.stringify(displayHtmlUrl));
  const safeSlotId = escapeScriptContext(JSON.stringify(slotId));

  return `<ins id="${slotId}" style="display:inline-block;width:${width}px;height:${height}px;"></ins>\n<script>\n(function(){\n  var SLOT_ID = ${safeSlotId};\n  var SRC     = ${safeUrl};\n  var W = '${width}'; var H = '${height}';\n\n  function mount(slot) {\n    if (!slot || slot.dataset.smxMounted) return;\n    slot.dataset.smxMounted = '1';\n    var iframe = document.createElement('iframe');\n    iframe.src = SRC; iframe.width = W; iframe.height = H;\n    iframe.scrolling = 'no'; iframe.frameBorder = '0';\n    iframe.style.cssText = 'border:0;overflow:hidden;display:block;';\n    iframe.setAttribute('sandbox','allow-scripts allow-same-origin allow-popups allow-forms allow-top-navigation-by-user-activation');\n    slot.replaceWith(iframe);\n    if (observer) observer.disconnect();\n  }\n\n  var slot = document.getElementById(SLOT_ID);\n  if (slot) { mount(slot); return; }\n\n  var observer = typeof MutationObserver === 'function'\n    ? new MutationObserver(function() { mount(document.getElementById(SLOT_ID)); })\n    : null;\n  if (observer) observer.observe(document.body || document.documentElement, { childList: true, subtree: true });\n})();\n</script>`;
}

export function buildNativeJsSnippet({ nativeJsUrl, tagId }) {
  return `<script>\n  window.SMX = window.SMX || {};\n  window.SMX.native = window.SMX.native || [];\n  window.SMX.native.push({ tagId: "${tagId}", format: "native" });\n</script>\n<script src="${nativeJsUrl}" async></script>`;
}

export function buildBasisNativeDisplaySnippet({
  tagId,
  displayHtmlUrl,
  trackerEngagementUrl,
  trackerImpressionUrl,
  trackerViewabilityUrl = '',
  width,
  height,
}) {
  const vars = [
    `var rootId=${escapeScriptContext(JSON.stringify(`smx-basis-slot-${tagId}`))};`,
    `var width=${escapeScriptContext(JSON.stringify(String(width)))};`,
    `var height=${escapeScriptContext(JSON.stringify(String(height)))};`,
    `var displayHtmlUrl=${escapeScriptContext(JSON.stringify(displayHtmlUrl))};`,
    `var engagementBase=${escapeScriptContext(JSON.stringify(trackerEngagementUrl))};`,
    `var impressionBase=${escapeScriptContext(JSON.stringify(trackerImpressionUrl))};`,
    `var viewabilityBase=${escapeScriptContext(JSON.stringify(trackerViewabilityUrl))};`,
  ].join('');
  return `(function(){${vars}${BASIS_NATIVE_BLOB
    .replace(/^\(function\(\)\{/, '')
    .replace(/\}\(\)\);?$|\}\)\(\);?$/, '')}})();`;
}

export function normalizeServingBaseUrl(value) {
  return String(value ?? '').replace(/\/+$/, '').replace(/\/v1$/, '');
}

export function buildTagSnippet(tag, variant, servingBaseUrl, campaignDsp = '', diagnostics = null) {
  const useBasisNative = shouldUseBasisNativeDelivery(campaignDsp);
  const base = normalizeServingBaseUrl(servingBaseUrl);
  const id = tag.id;
  const width = tag.width ?? 300;
  const height = tag.height ?? 250;

  // Serving URLs are static — they deliver the HTML wrapper or JS loader to the browser.
  // They must NOT carry DSP macros because:
  //   1. The serving endpoint does not resolve macros ({domain}, {pageUrlEnc}, etc.)
  //   2. The Basis blob enriches displayHtmlUrl at runtime via appendCtx(ctxToken)
  //   3. Macro-laden URLs cannot be CDN-cached (every placement generates a unique URL)
  //   4. URLs exceed 600 chars with 26 unused params — risk of truncation in some DSPs
  // DSP macros belong only on tracker URLs (impression.gif, click, engagement).
  const displayJsUrl   = `${base}/v1/tags/display/${id}.js`;
  const displayHtmlUrl = `${base}/v1/tags/display/${id}.html`;
  const nativeJsUrl    = `${base}/v1/tags/native/${id}.js`;

  const trackerClickUrl = applyDspMacrosToDeliveryUrl(`${base}/v1/tags/tracker/${id}/click`, campaignDsp, DSP_DELIVERY_KINDS.TRACKER_CLICK);
  const trackerImpressionUrl = applyDspMacrosToDeliveryUrl(`${base}/v1/tags/tracker/${id}/impression.gif`, campaignDsp, DSP_DELIVERY_KINDS.TRACKER_IMPRESSION);
  const trackerEngagementUrl = applyDspMacrosToDeliveryUrl(`${base}/v1/tags/tracker/${id}/engagement`, campaignDsp, DSP_DELIVERY_KINDS.TRACKER_IMPRESSION);

  const vastLiveProfiles = diagnostics?.deliveryDiagnostics?.vast?.liveProfiles ?? {};
  const basisDynamicVastUrl = vastLiveProfiles.basis || `${base}/v1/vast/tags/${id}/basis.xml`;
  const illuminDynamicVastUrl = vastLiveProfiles.illumin || `${base}/v1/vast/tags/${id}/illumin.xml`;
  const vast4DynamicUrl = vastLiveProfiles.vast4 || vastLiveProfiles.default || `${base}/v1/vast/tags/${id}/vast4.xml`;
  const basisMacroVastUrl = applyDspMacrosToDeliveryUrl(basisDynamicVastUrl, 'basis', DSP_DELIVERY_KINDS.VIDEO);
  const illuminMacroVastUrl = applyDspMacrosToDeliveryUrl(illuminDynamicVastUrl, 'illumin', DSP_DELIVERY_KINDS.VIDEO);
  const campaignVastUrl = (campaignDsp === 'basis' ? vastLiveProfiles.basis : campaignDsp === 'illumin' ? vastLiveProfiles.illumin : vastLiveProfiles.default) || vast4DynamicUrl;

  switch (variant) {
    case 'vast-url-basis-dynamic':
      return basisDynamicVastUrl;
    case 'vast-url-basis-macro':
      return basisMacroVastUrl;
    case 'vast-url-illumin-dynamic':
      return illuminDynamicVastUrl;
    case 'vast-url-illumin-macro':
      return illuminMacroVastUrl;
    case 'vast-url-vast4-dynamic':
      return vast4DynamicUrl;
    case 'vast-xml':
      return buildVastWrapperSnippet(id, campaignVastUrl);
    case 'display-iframe':
      if (useBasisNative) return buildBasisNativeDisplaySnippet({ tagId: id, displayHtmlUrl, trackerEngagementUrl, trackerImpressionUrl, width, height });
      return buildDisplayIframeSnippet({ displayHtmlUrl, width, height });
    case 'display-ins':
      if (useBasisNative) return buildBasisNativeDisplaySnippet({ tagId: id, displayHtmlUrl, trackerEngagementUrl, trackerImpressionUrl, width, height });
      return buildDisplayInsSnippet({ displayHtmlUrl, tagId: id, width, height });
    case 'native-js':
      return buildNativeJsSnippet({ nativeJsUrl, tagId: id });
    case 'tracker-impression':
      return useBasisNative ? buildBasisNativeDisplaySnippet({ tagId: id, displayHtmlUrl, trackerEngagementUrl, trackerImpressionUrl, width, height }) : trackerImpressionUrl;
    case 'tracker-click':
      return useBasisNative ? buildBasisNativeDisplaySnippet({ tagId: id, displayHtmlUrl, trackerEngagementUrl, trackerImpressionUrl, width, height }) : trackerClickUrl;
    case 'display-js':
    default:
      if (useBasisNative) return buildBasisNativeDisplaySnippet({ tagId: id, displayHtmlUrl, trackerEngagementUrl, trackerImpressionUrl, width, height });
      return buildDisplayJsSnippet({ displayJsUrl, displayHtmlUrl, width, height });
  }
}
