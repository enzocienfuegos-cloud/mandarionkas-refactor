export const DSP_MACRO_CONFIGS = {
  basis: {
    label: 'Basis',
    queryParams: {
      pu: '{pageUrlEnc}',
      sd: '{domain}',
      auction_id: '{auctionId}',
      dsp_ad_id: '{adId}',
      dsp_campaign_id: '{campaignId}',
      traffic_type: '{trafficType}',
      dimensions: '{dimensions}',
      click_invalid: '{clickInvalid}',
      gdpr: '{gdprApplicable}',
      gdpr_consent: '{gdprUserConsentString}',
      us_privacy: '{us_privacy}',
      gpp_sid: '${GPP_SID}',
      gpp_string: '${GPP_STRING}',
      ifa: '{ifa}',
      basis_uid: '{internalUserId}',
      dsp_click: '{clickMacro}',
    },
    aliases: {
      clickMacro: ['smx_dsp_click', 'dsp_click', 'clickMacro', 'clickMacroEnc', 'click_macro_enc'],
      siteDomain: ['sd', 'domain', 'inventoryUnitReportingName'],
      deviceId: ['ifa', 'googleAdvertisingId', 'idfa'],
      cookieId: ['basis_uid', 'internalUserId'],
    },
  },
};

export const DSP_DELIVERY_KINDS = {
  DISPLAY_WRAPPER: 'display_wrapper',
  HTML5_INTERNAL: 'html5_internal',
  VAST: 'vast',
  TRACKER_CLICK: 'tracker_click',
  TRACKER_IMPRESSION: 'tracker_impression',
};

function readValue(value) {
  const candidate = Array.isArray(value) ? value[0] : value;
  const text = String(candidate ?? '').trim();
  return text || null;
}

export function normalizeDsp(value) {
  const text = readValue(value);
  return text ? text.toLowerCase() : '';
}

export function readCampaignDsp(metadata) {
  if (!metadata || typeof metadata !== 'object') return '';
  return normalizeDsp(metadata.dsp);
}

export function getDspMacroConfig(dsp) {
  const normalized = normalizeDsp(dsp);
  return normalized ? (DSP_MACRO_CONFIGS[normalized] ?? null) : null;
}

export function listSupportedDsps() {
  return Object.entries(DSP_MACRO_CONFIGS).map(([value, config]) => ({
    value,
    label: config.label,
  }));
}

export function applyDspMacrosToUrl(rawUrl, dsp, opts = {}) {
  const config = getDspMacroConfig(dsp);
  if (!config || !rawUrl) return rawUrl;
  const { includeClickMacro = false, includeDspHint = true, clickMacroValue = '' } = opts;

  try {
    const url = new URL(String(rawUrl));
    if (includeDspHint) {
      url.searchParams.set('smx_dsp', normalizeDsp(dsp));
    }
    for (const [key, value] of Object.entries(config.queryParams)) {
      if (!includeClickMacro && config.aliases?.clickMacro?.includes(key)) continue;
      url.searchParams.set(key, value);
    }
    if (includeClickMacro) {
      const clickMacroKey = config.aliases?.clickMacro?.find((key) => key in config.queryParams);
      if (clickMacroKey) {
        const macroValue = String(clickMacroValue || config.queryParams[clickMacroKey] || '').trim();
        url.searchParams.set(clickMacroKey, macroValue);
        url.searchParams.set('smx_dsp_click', macroValue);
      }
    }
    return url.toString();
  } catch {
    return rawUrl;
  }
}

export function getDspDeliveryPolicy(dsp, deliveryKind) {
  const normalizedDsp = normalizeDsp(dsp);
  const normalizedKind = String(deliveryKind ?? '').trim().toLowerCase();

  const basePolicy = {
    includeDspHint: true,
    includeClickMacro: false,
    measurementPath: 'smx_fallback',
    clickMacroValue: '',
  };

  if (normalizedDsp !== 'basis') return basePolicy;

  switch (normalizedKind) {
    case DSP_DELIVERY_KINDS.DISPLAY_WRAPPER:
      return {
        ...basePolicy,
        includeClickMacro: true,
        measurementPath: 'basis_macro_or_smx_fallback',
        clickMacroValue: '{clickMacro}',
      };
    case DSP_DELIVERY_KINDS.HTML5_INTERNAL:
      return {
        ...basePolicy,
        includeClickMacro: true,
        measurementPath: 'basis_macro_or_smx_fallback',
        clickMacroValue: '{clickMacro}',
      };
    case DSP_DELIVERY_KINDS.VAST:
      return {
        ...basePolicy,
        includeClickMacro: false,
        measurementPath: 'basis_macro_or_smx_fallback',
      };
    case DSP_DELIVERY_KINDS.TRACKER_CLICK:
      return {
        ...basePolicy,
        includeClickMacro: true,
        measurementPath: 'basis_macro_or_smx_fallback',
        clickMacroValue: '{clickMacro}',
      };
    case DSP_DELIVERY_KINDS.TRACKER_IMPRESSION:
      return {
        ...basePolicy,
        includeClickMacro: false,
        measurementPath: 'smx_direct',
      };
    default:
      return basePolicy;
  }
}

export function applyDspMacrosToDeliveryUrl(rawUrl, dsp, deliveryKind, opts = {}) {
  const policy = getDspDeliveryPolicy(dsp, deliveryKind);
  return applyDspMacrosToUrl(rawUrl, dsp, {
    includeDspHint: policy.includeDspHint,
    includeClickMacro: policy.includeClickMacro,
    clickMacroValue: policy.clickMacroValue,
    ...opts,
  });
}

export function buildDspNativeClickHref(clickTrackUrl, dsp) {
  const normalizedDsp = normalizeDsp(dsp);
  if (!clickTrackUrl) return clickTrackUrl;
  if (normalizedDsp !== 'basis') return clickTrackUrl;
  return `{clickMacro}${String(clickTrackUrl)}`;
}

export function buildBasisNativeDisplayAnchor(displayHtmlUrl, clickHref, width, height) {
  return `<a href="${clickHref}" target="_blank" rel="noopener noreferrer" style="position:absolute;inset:0;display:block;z-index:2;"></a>\n  <iframe src="${displayHtmlUrl}" width="${width}" height="${height}" scrolling="no" frameborder="0" marginwidth="0" marginheight="0" style="border:0;overflow:hidden;pointer-events:none;position:relative;z-index:1;"></iframe>`;
}

function escapeInlineScriptMarkup(value) {
  return String(value ?? '').replace(/<\/script/gi, '<\\/script');
}

export function buildBasisNativeSnippet({
  variant,
  tagId,
  displayHtmlUrl = '',
  nativeJsUrl = '',
  vastUrl = '',
  trackerClickUrl = '',
  trackerEngagementUrl = '',
  trackerImpressionUrl = '',
  width = 300,
  height = 250,
} = {}) {
  const clickHref = buildDspNativeClickHref(trackerClickUrl, 'basis');
  const displayMarkup = `<div id="smx-basis-slot-${tagId}" style="position:relative;display:inline-block;width:${width}px;height:${height}px;">\n  ${buildBasisNativeDisplayAnchor(displayHtmlUrl, clickHref, width, height)}\n</div>`;
  const interactionScript = trackerEngagementUrl
    ? `<script>\n  (function(rootId, engagementBase) {\n    var root = document.getElementById(rootId);\n    if (!root || !engagementBase) return;\n    var hoverStartedAt = null;\n    function fire(url) {\n      try {\n        var img = new Image();\n        img.src = url;\n      } catch (_error) {}\n    }\n    function withParams(base, params) {\n      var sep = base.indexOf('?') === -1 ? '?' : '&';\n      return base + sep + params.join('&');\n    }\n    function currentPageUrl() {\n      try {\n        return window.location && window.location.href ? window.location.href : '';\n      } catch (_error) {\n        return '';\n      }\n    }\n    function buildEngagementUrl(eventType, hoverDurationMs) {\n      var params = ['event=' + encodeURIComponent(eventType)];\n      var pageUrl = currentPageUrl();\n      if (pageUrl) params.push('pu=' + encodeURIComponent(pageUrl));\n      if (typeof hoverDurationMs === 'number' && hoverDurationMs >= 0) params.push('hd=' + encodeURIComponent(String(Math.round(hoverDurationMs))));\n      return withParams(engagementBase, params);\n    }\n    root.addEventListener('mouseenter', function() {\n      hoverStartedAt = Date.now();\n      fire(buildEngagementUrl('hover_start'));\n    });\n    root.addEventListener('mouseleave', function() {\n      var duration = hoverStartedAt ? (Date.now() - hoverStartedAt) : 0;\n      hoverStartedAt = null;\n      fire(buildEngagementUrl('hover_end', duration));\n    });\n    root.addEventListener('click', function() {\n      fire(buildEngagementUrl('interaction'));\n    }, true);\n  })(${JSON.stringify(`smx-basis-slot-${tagId}`)}, ${JSON.stringify(trackerEngagementUrl)});\n</script>`
    : '';
  const displayTag = `${displayMarkup}\n${interactionScript}`;
  const displayTagForInlineScript = escapeInlineScriptMarkup(displayTag);

  switch (variant) {
    case 'display-js':
      return `<script>\n  (function() {\n    var markup = ${JSON.stringify(displayTagForInlineScript)};\n    document.write(markup);\n  })();\n</script>\n<noscript>\n  ${displayMarkup}\n</noscript>`;
    case 'display-ins':
      return `<ins id="smx-ad-slot-${tagId}" style="display:inline-block;width:${width}px;height:${height}px;"></ins>\n<script>\n  (function(slot) {\n    if (!slot) return;\n    slot.outerHTML = ${JSON.stringify(displayTagForInlineScript)};\n  })(document.getElementById(${JSON.stringify(`smx-ad-slot-${tagId}`)}));\n</script>`;
    case 'display-iframe':
      return displayTag;
    case 'tracker-click':
      return clickHref;
    case 'tracker-impression':
      return trackerImpressionUrl;
    case 'vast-url':
      return vastUrl;
    case 'vast-xml':
      return `<VAST xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">\n  <Ad id="${tagId}">\n    <Wrapper>\n      <AdSystem>SMX Studio</AdSystem>\n      <VASTAdTagURI><![CDATA[${vastUrl}]]></VASTAdTagURI>\n    </Wrapper>\n  </Ad>\n</VAST>`;
    case 'native-js':
      return `<script>\n  window.SMX = window.SMX || {};\n  window.SMX.native = window.SMX.native || [];\n  window.SMX.native.push({ tagId: "${tagId}", format: "native" });\n</script>\n<script src="${nativeJsUrl}" async></script>`;
    default:
      return '';
  }
}

export function readDspMacroValue(query = {}, kind, dsp = '') {
  const normalizedDsp = normalizeDsp(dsp || query?.smx_dsp);
  const configs = normalizedDsp
    ? [getDspMacroConfig(normalizedDsp)].filter(Boolean)
    : Object.values(DSP_MACRO_CONFIGS);

  for (const config of configs) {
    const aliases = config?.aliases?.[kind] ?? [];
    for (const alias of aliases) {
      const value = readValue(query?.[alias]);
      if (value) return value;
    }
  }
  return null;
}

function safeDecode(value) {
  if (!value) return '';
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export function isResolvedDspMacroValue(value) {
  const text = safeDecode(value).trim();
  if (!text) return false;
  if (/[{}]/.test(text) || /\$\{[^}]+\}/.test(text)) return false;
  return true;
}

export function resolveDspClickMacroValue(value) {
  const text = safeDecode(value).trim();
  return isResolvedDspMacroValue(text) ? text : '';
}

export function buildDspTrackedClickUrl(clickTrackUrl, macroValue) {
  if (!clickTrackUrl) return clickTrackUrl;
  const resolvedMacroValue = resolveDspClickMacroValue(macroValue);
  if (!resolvedMacroValue) return clickTrackUrl;
  return `${resolvedMacroValue}${encodeURIComponent(String(clickTrackUrl))}`;
}

export function wrapTrackedClickUrlWithDspMacro(clickTrackUrl, query = {}, dsp = '') {
  const encodedMacro = readDspMacroValue(query, 'clickMacro', dsp);
  if (!encodedMacro || !clickTrackUrl) return clickTrackUrl;
  return buildDspTrackedClickUrl(clickTrackUrl, encodedMacro);
}
