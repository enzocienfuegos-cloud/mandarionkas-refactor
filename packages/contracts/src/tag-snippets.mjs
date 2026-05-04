// packages/contracts/src/tag-snippets.mjs
//
// Pure functions for generating ad tag snippets.
// No React, no DOM, no side effects. Importable from API and web.
//
import {
  applyDspMacrosToDeliveryUrl,
  applyDspMacrosToUrl,
  buildVastWrapperSnippet,
  DSP_DELIVERY_KINDS,
  getDspMacroConfig,
} from './dsp-macros.mjs';

// ── Constants ──────────────────────────────────────────────────────────────

function escapeScriptContext(jsonStr) {
  return jsonStr.replace(/<\//g, '<\\/');
}

export function buildDisplayJsSnippet({ displayJsUrl, displayHtmlUrl, width, height }) {
  return `<script src="${displayJsUrl}" async></script>\n<noscript>\n  <iframe src="${displayHtmlUrl}" width="${width}" height="${height}" scrolling="no" frameborder="0" style="border:0;overflow:hidden;" sandbox="allow-scripts allow-same-origin allow-popups allow-forms allow-top-navigation-by-user-activation"></iframe>\n</noscript>`;
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

export function normalizeServingBaseUrl(value) {
  return String(value ?? '').replace(/\/+$/, '').replace(/\/v1$/, '');
}

function getDefaultDisplayClickMacroValue(config) {
  if (!config) return '';
  const clickMacroKey = config.aliases?.clickMacro?.find((key) => key in (config.queryParams || {}));
  return clickMacroKey ? String(config.queryParams[clickMacroKey] ?? '').trim() : '';
}

export function buildTagSnippet(tag, variant, servingBaseUrl, campaignDsp = '', diagnostics = null) {
  const base = normalizeServingBaseUrl(servingBaseUrl);
  const id = tag.id;
  const width = tag.width ?? 300;
  const height = tag.height ?? 250;

  // Display serving URLs can carry DSP macros so the DSP resolves them before
  // handing the tag to the publisher. The .js loader then forwards the resolved
  // values to the .html iframe, which appends them to impression/click trackers.
  // Non-display tracker URLs still receive macro enrichment directly here.
  const displayJsUrl   = `${base}/v1/tags/display/${id}.js`;
  const displayHtmlUrl = `${base}/v1/tags/display/${id}.html`;
  const nativeJsUrl    = `${base}/v1/tags/native/${id}.js`;
  const dspConfig = getDspMacroConfig(campaignDsp);
  const displayClickMacroValue = getDefaultDisplayClickMacroValue(dspConfig);
  const displayJsMacroUrl = dspConfig
    ? applyDspMacrosToUrl(displayJsUrl, campaignDsp, {
        includeDspHint: true,
        includeClickMacro: true,
        clickMacroValue: displayClickMacroValue,
      })
    : displayJsUrl;
  const displayHtmlMacroUrl = dspConfig
    ? applyDspMacrosToUrl(displayHtmlUrl, campaignDsp, {
        includeDspHint: true,
        includeClickMacro: true,
        clickMacroValue: displayClickMacroValue,
      })
    : displayHtmlUrl;

  const trackerClickUrl = applyDspMacrosToDeliveryUrl(`${base}/v1/tags/tracker/${id}/click`, campaignDsp, DSP_DELIVERY_KINDS.TRACKER_CLICK);
  const trackerImpressionUrl = applyDspMacrosToDeliveryUrl(`${base}/v1/tags/tracker/${id}/impression.gif`, campaignDsp, DSP_DELIVERY_KINDS.TRACKER_IMPRESSION);

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
      return buildDisplayIframeSnippet({ displayHtmlUrl: displayHtmlMacroUrl, width, height });
    case 'display-ins':
      return buildDisplayInsSnippet({ displayHtmlUrl: displayHtmlMacroUrl, tagId: id, width, height });
    case 'native-js':
      return buildNativeJsSnippet({ nativeJsUrl, tagId: id });
    case 'tracker-impression':
      return trackerImpressionUrl;
    case 'tracker-click':
      return trackerClickUrl;
    case 'display-js-no-macro':
      return buildDisplayJsSnippet({ displayJsUrl, displayHtmlUrl, width, height });
    case 'display-js':
    default:
      return buildDisplayJsSnippet({ displayJsUrl: displayJsMacroUrl, displayHtmlUrl: displayHtmlMacroUrl, width, height });
  }
}
