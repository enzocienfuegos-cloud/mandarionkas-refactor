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
const BASIS_NATIVE_BLOB = `(function(){function withParams(base,params){if(!base)return'';var sep=base.indexOf('?')===-1?'?':'&';return base+sep+params.join('&');}function currentPageUrl(){try{return window.top&&window.top.location&&window.top.location.href?window.top.location.href:window.location&&window.location.href?window.location.href:'';}catch(_e1){try{return window.location&&window.location.href?window.location.href:'';}catch(_e2){return'';}}}function currentDomain(pageUrl){if(!pageUrl)return'';try{return new URL(pageUrl).hostname||'';}catch(_e){return'';}}function base64UrlEncode(text){try{var encoded=btoa(unescape(encodeURIComponent(text)));return encoded.replace(/\\+/g,'-').replace(/\\//g,'_').replace(/=+$/,'');}catch(_e){return'';}}function appendCtx(url,ctxToken){if(!url)return'';if(!ctxToken)return url;return withParams(url,['ctx='+encodeURIComponent(ctxToken)]);}function fire(url){try{var img=new Image();img.src=url;}catch(_e){}}var script=document.currentScript;var parent=script&&script.parentNode?script.parentNode:null;if(!parent||!script)return;function readSourceParams(){try{var src=script&&script.src?new URL(script.src,window.location.href):null;if(!src)return{};var out={};src.searchParams.forEach(function(value,key){out[key]=value;});return out;}catch(_e){return{};}}var sourceParams=readSourceParams();var pageUrl=currentPageUrl();if(pageUrl)sourceParams.pu=pageUrl;if(!sourceParams.dom){var resolvedDomain=currentDomain(pageUrl);if(resolvedDomain)sourceParams.dom=resolvedDomain;}var ctxToken=base64UrlEncode(JSON.stringify(sourceParams));function buildEventUrl(base,eventType,hoverDurationMs){if(!base)return'';var params=[];if(eventType)params.push('event='+encodeURIComponent(eventType));if(pageUrl)params.push('pu='+encodeURIComponent(pageUrl));if(typeof hoverDurationMs==='number'&&hoverDurationMs>=0){params.push('hd='+encodeURIComponent(String(Math.round(hoverDurationMs))));}return appendCtx(withParams(base,params),ctxToken);}function generateId(prefix){if(typeof crypto!=='undefined'&&typeof crypto.randomUUID==='function'){return crypto.randomUUID();}return prefix+'-'+Date.now()+'-'+Math.random().toString(16).slice(2);}function readCookie(name){try{var match=document.cookie.match(new RegExp('(?:^|; )'+name.replace(/[.$?*|{}()[\\]\\/+^]/g,'\\\\$&')+'=([^;]*)'));return match?decodeURIComponent(match[1]):'';}catch(_e){return'';}}function writeCookie(name,value,maxAgeDays){try{var expires='';if(maxAgeDays)expires='; max-age='+String(Math.floor(maxAgeDays*24*60*60));document.cookie=name+'='+encodeURIComponent(value)+expires+'; path=/; SameSite=None; Secure';}catch(_e){}}function readStorage(key){try{return window.localStorage?String(window.localStorage.getItem(key)||''):'';}catch(_e){return readCookie(key);}}function writeStorage(key,value){try{if(window.localStorage)window.localStorage.setItem(key,value);}catch(_e){writeCookie(key,value,30);}}function resolveIdentity(kind){var queryKey=kind==='device'?'did':'cid';var storageKey=kind==='device'?'smx_device_id':'smx_cookie_id';var existing=sourceParams[queryKey]||readStorage(storageKey)||readCookie(storageKey);if(existing){writeStorage(storageKey,existing);writeCookie(storageKey,existing,kind==='device'?365:30);return existing;}var created=generateId(kind==='device'?'dev':'cid');writeStorage(storageKey,created);writeCookie(storageKey,created,kind==='device'?365:30);return created;}var impressionId=sourceParams.imp||generateId('imp');var resolvedDeviceId=resolveIdentity('device');var resolvedCookieId=resolveIdentity('cookie');function appendIdentity(url){var next=url;if(!next)return next;next+=(next.indexOf('?')===-1?'?':'&')+'imp='+encodeURIComponent(String(impressionId));if(resolvedDeviceId)next+='&did='+encodeURIComponent(String(resolvedDeviceId));if(resolvedCookieId)next+='&cid='+encodeURIComponent(String(resolvedCookieId));return next;}var iframeSrc=appendIdentity(appendCtx(withParams(displayHtmlUrl,['smx_no_imp=1']),ctxToken));var iframe=document.createElement('iframe');iframe.src=iframeSrc;iframe.width=width;iframe.height=height;iframe.scrolling='no';iframe.frameBorder='0';iframe.marginWidth='0';iframe.marginHeight='0';iframe.setAttribute('sandbox','allow-scripts allow-same-origin allow-popups allow-forms allow-top-navigation-by-user-activation');iframe.style.border='0';iframe.style.overflow='hidden';iframe.style.position='relative';iframe.style.zIndex='1';iframe.style.width='100%';iframe.style.height='100%';var root=document.createElement('div');root.id=rootId;root.style.position='relative';root.style.display='inline-block';root.style.width=width+'px';root.style.height=height+'px';root.appendChild(iframe);var hoverStartedAt=null;root.addEventListener('mouseenter',function(){hoverStartedAt=Date.now();var url=appendIdentity(buildEventUrl(engagementBase,'hover_start'));if(url)fire(url);});root.addEventListener('mouseleave',function(){var duration=hoverStartedAt?(Date.now()-hoverStartedAt):0;hoverStartedAt=null;var url=appendIdentity(buildEventUrl(engagementBase,'hover_end',duration));if(url)fire(url);});var impressionUrl=appendIdentity(appendCtx(impressionBase,ctxToken));if(impressionUrl)fire(impressionUrl);var measured=false;var tracked=false;var visibilityTimer=null;function viewableUrl(){return appendIdentity(withParams(appendCtx(viewabilityBase,ctxToken),['state=viewable','vp=1','fmt=display','method=intersection_observer','ms=1000'].concat(pageUrl?['pu='+encodeURIComponent(pageUrl)]:[])));}function measuredStateUrl(){return appendIdentity(withParams(appendCtx(viewabilityBase,ctxToken),['state=measured','fmt=display','method=intersection_observer'].concat(pageUrl?['pu='+encodeURIComponent(pageUrl)]:[])));}if(typeof IntersectionObserver==='function'&&viewabilityBase){if(!measured){measured=true;fire(measuredStateUrl());}var observer=new IntersectionObserver(function(entries){entries.forEach(function(entry){if(entry.isIntersecting&&entry.intersectionRatio>=0.5){if(!visibilityTimer){visibilityTimer=window.setTimeout(function(){if(tracked)return;tracked=true;fire(viewableUrl());observer.disconnect();},1000);}}else if(visibilityTimer){window.clearTimeout(visibilityTimer);visibilityTimer=null;}});},{threshold:[0.5]});observer.observe(root);}parent.insertBefore(root,script);parent.removeChild(script);}())`;

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
  return `(function(){${vars}${BASIS_NATIVE_BLOB.replace(/^\(function\(\)\{/, '').replace(/\}\(\)\);?$/, '')}})();`;
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

  const displayJsUrl = applyDspMacrosToDeliveryUrl(`${base}/v1/tags/display/${id}.js`, campaignDsp, DSP_DELIVERY_KINDS.DISPLAY_WRAPPER);
  const displayHtmlUrl = applyDspMacrosToDeliveryUrl(`${base}/v1/tags/display/${id}.html`, campaignDsp, DSP_DELIVERY_KINDS.DISPLAY_WRAPPER);
  const nativeJsUrl = applyDspMacrosToDeliveryUrl(`${base}/v1/tags/native/${id}.js`, campaignDsp, DSP_DELIVERY_KINDS.DISPLAY_WRAPPER);

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
