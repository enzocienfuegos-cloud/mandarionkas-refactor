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

export function shouldUseBasisNativeDelivery(dsp) {
  return normalizeDsp(dsp) === 'basis';
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
  if (!clickTrackUrl) return clickTrackUrl;
  if (!shouldUseBasisNativeDelivery(dsp)) return clickTrackUrl;
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
  const displayTagForInlineScript = escapeInlineScriptMarkup(displayMarkup);
  const rootId = `smx-basis-slot-${tagId}`;

  switch (variant) {
    case 'display-js':
      return `<script src="${nativeJsUrl}"></script>\n<noscript>\n  ${displayMarkup}\n</noscript>`;
    case 'display-ins':
      return `<script src="${nativeJsUrl}"></script>\n<noscript>\n  ${displayMarkup}\n</noscript>`;
    case 'display-iframe':
      return displayMarkup;
    case 'tracker-click':
      return clickHref;
    case 'tracker-impression':
      return trackerImpressionUrl;
    case 'vast-url':
      return vastUrl;
    case 'vast-xml':
      return `<VAST xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">\n  <Ad id="${tagId}">\n    <Wrapper>\n      <AdSystem>SMX Studio</AdSystem>\n      <VASTAdTagURI><![CDATA[${vastUrl}]]></VASTAdTagURI>\n    </Wrapper>\n  </Ad>\n</VAST>`;
    case 'native-js':
      return `(function(){var markup=${JSON.stringify(displayTagForInlineScript)};var rootId=${JSON.stringify(rootId)};var engagementBase=${JSON.stringify(trackerEngagementUrl)};function attach(root){if(!root||!engagementBase||root.__smxEngagementBound)return;root.__smxEngagementBound=true;var hoverStartedAt=null;function fire(url){try{var img=new Image();img.src=url;}catch(_error){}}function withParams(base,params){var sep=base.indexOf('?')===-1?'?':'&';return base+sep+params.join('&');}function currentPageUrl(){try{return window.location&&window.location.href?window.location.href:'';}catch(_error){return '';}}function buildEngagementUrl(eventType,hoverDurationMs){var params=['event='+encodeURIComponent(eventType)];var pageUrl=currentPageUrl();if(pageUrl)params.push('pu='+encodeURIComponent(pageUrl));if(typeof hoverDurationMs==='number'&&hoverDurationMs>=0)params.push('hd='+encodeURIComponent(String(Math.round(hoverDurationMs))));return withParams(engagementBase,params);}root.addEventListener('mouseenter',function(){hoverStartedAt=Date.now();fire(buildEngagementUrl('hover_start'));});root.addEventListener('mouseleave',function(){var duration=hoverStartedAt?(Date.now()-hoverStartedAt):0;hoverStartedAt=null;fire(buildEngagementUrl('hover_end',duration));});root.addEventListener('click',function(){fire(buildEngagementUrl('interaction'));},true);}var script=document.currentScript;var parent=script&&script.parentNode?script.parentNode:null;var root=null;if(parent&&script){var wrapper=document.createElement('div');wrapper.innerHTML=markup;while(wrapper.firstChild){var child=wrapper.firstChild;parent.insertBefore(child,script);if(!root&&child.id===rootId)root=child;}parent.removeChild(script);}else if(document.body){var fallback=document.createElement('div');fallback.innerHTML=markup;while(fallback.firstChild){var node=fallback.firstChild;document.body.appendChild(node);if(!root&&node.id===rootId)root=node;}}if(!root){root=document.getElementById(rootId);}attach(root);}());`;
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
