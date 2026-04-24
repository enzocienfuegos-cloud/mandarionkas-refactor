export const DSP_MACRO_CONFIGS = {
  basis: {
    label: 'Basis',
    queryParams: {
      dsp: 'Basis',
      dom: '{domain}',
      purl: '{pageUrlEnc}',
      cuu: '{clickMacroEnc}',
      cmpid: '{campaignId}',
      trftype: '{trafficType}',
      gdpr: '{gdprApplicable}',
      gdpr_consent: '${GDPR_CONSENT_699}',
      cs_gdpr: '${GDPR}',
      cs_gdpr_consent: '${GDPR_CONSENT_699}',
      us_privacy: '{us_privacy}',
      ifa: '{ifa}',
      idfa: '{idfa}',
      gadvid: '{googleAdvertisingId}',
      iuid: '{internalUserId}',
      appid: '{appId}',
      ppos: '{pagePosition}',
      netid: '{networkId}',
      srcpubid: '{sourcePublisherId}',
      cntlang: '{contentLanguage}',
      cnttitle: '{contentTitle}',
      cntseries: '{contentSeries}',
      carr: '{carrier}',
      ctxid: '{contextualIds}',
      appstnm: '{appStoreName}',
      cngen: '{contentGenre}',
    },
    aliases: {
      clickMacro: ['smx_dsp_click', 'cuu', 'dsp_click', 'clickMacro', 'clickMacroEnc', 'click_macro_enc'],
      siteDomain: ['dom', 'sd', 'domain', 'inventoryUnitReportingName'],
      pageUrl: ['purl', 'pu', 'pageUrlEnc'],
      deviceId: ['ifa', 'gadvid', 'googleAdvertisingId', 'idfa'],
      cookieId: ['iuid', 'basis_uid', 'internalUserId'],
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
    if (normalizeDsp(dsp) === 'basis') {
      const base = String(rawUrl).replace(/[?&]+$/, '');
      const parts = [];
      if (includeDspHint && !('dsp' in config.queryParams)) {
        parts.push(`dsp=${config.label}`);
      }
      for (const [key, value] of Object.entries(config.queryParams)) {
        if (!includeClickMacro && config.aliases?.clickMacro?.includes(key)) continue;
        parts.push(`${key}=${value}`);
      }
      if (includeClickMacro) {
        const clickMacroKey = config.aliases?.clickMacro?.find((key) => key in config.queryParams);
        if (clickMacroKey) {
          const macroValue = String(clickMacroValue || config.queryParams[clickMacroKey] || '').trim();
          const nextParts = parts.filter((part) => !part.startsWith(`${clickMacroKey}=`));
          nextParts.push(`${clickMacroKey}=${macroValue}`);
          return `${base}?${nextParts.join('&')}`;
        }
      }
      return `${base}?${parts.join('&')}`;
    }

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
        includeDspHint: true,
        includeClickMacro: true,
        measurementPath: 'basis_macro_or_smx_fallback',
        clickMacroValue: '{clickMacroEnc}',
      };
    case DSP_DELIVERY_KINDS.HTML5_INTERNAL:
      return {
        ...basePolicy,
        includeDspHint: true,
        includeClickMacro: true,
        measurementPath: 'basis_macro_or_smx_fallback',
        clickMacroValue: '{clickMacroEnc}',
      };
    case DSP_DELIVERY_KINDS.VAST:
      return {
        ...basePolicy,
        includeDspHint: true,
        includeClickMacro: false,
        measurementPath: 'basis_macro_or_smx_fallback',
      };
    case DSP_DELIVERY_KINDS.TRACKER_CLICK:
      return {
        ...basePolicy,
        includeDspHint: true,
        includeClickMacro: true,
        measurementPath: 'basis_macro_or_smx_fallback',
        clickMacroValue: '{clickMacroEnc}',
      };
    case DSP_DELIVERY_KINDS.TRACKER_IMPRESSION:
      return {
        ...basePolicy,
        includeDspHint: true,
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
  return String(clickTrackUrl);
}

function splitBasisNativeClickUrl(clickTrackUrl) {
  if (!clickTrackUrl) return { baseClickUrl: '', clickMacroValue: '' };
  const raw = String(clickTrackUrl);
  const [base, query = ''] = raw.split('?', 2);
  if (!query) return { baseClickUrl: raw, clickMacroValue: '' };
  const kept = [];
  let clickMacroValue = '';
  for (const pair of query.split('&')) {
    if (!pair) continue;
    const [key, ...rest] = pair.split('=');
    const value = rest.join('=');
    if (key === 'cuu' || key === 'smx_dsp_click' || key === 'dsp_click') {
      if (!clickMacroValue) clickMacroValue = value;
      continue;
    }
    kept.push(pair);
  }
  return {
    baseClickUrl: kept.length ? `${base}?${kept.join('&')}` : base,
    clickMacroValue,
  };
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
  const nativeClick = splitBasisNativeClickUrl(buildDspNativeClickHref(trackerClickUrl, 'basis'));

  switch (variant) {
    case 'display-js':
      return `<script src="${nativeJsUrl}"></script>`;
    case 'display-ins':
      return `<script src="${nativeJsUrl}"></script>`;
    case 'display-iframe':
      return `<script src="${nativeJsUrl}"></script>`;
    case 'tracker-click':
      return nativeClick.baseClickUrl;
    case 'tracker-impression':
      return trackerImpressionUrl;
    case 'vast-url':
      return vastUrl;
    case 'vast-xml':
      return `<VAST xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">\n  <Ad id="${tagId}">\n    <Wrapper>\n      <AdSystem>SMX Studio</AdSystem>\n      <VASTAdTagURI><![CDATA[${vastUrl}]]></VASTAdTagURI>\n    </Wrapper>\n  </Ad>\n</VAST>`;
    case 'native-js':
      return `(function(){var rootId=${JSON.stringify(`smx-basis-slot-${tagId}`)};var width=${JSON.stringify(String(width))};var height=${JSON.stringify(String(height))};var displayHtmlUrl=${JSON.stringify(displayHtmlUrl)};var engagementBase=${JSON.stringify(trackerEngagementUrl)};function withParams(base,params){var sep=base.indexOf('?')===-1?'?':'&';return base+sep+params.join('&');}function currentPageUrl(){try{return window.location&&window.location.href?window.location.href:'';}catch(_error){return '';}}function fire(url){try{var img=new Image();img.src=url;}catch(_error){}}function buildEngagementUrl(eventType,hoverDurationMs){if(!engagementBase)return '';var params=['event='+encodeURIComponent(eventType)];var pageUrl=currentPageUrl();if(pageUrl)params.push('pu='+encodeURIComponent(pageUrl));if(typeof hoverDurationMs==='number'&&hoverDurationMs>=0)params.push('hd='+encodeURIComponent(String(Math.round(hoverDurationMs))));return withParams(engagementBase,params);}var script=document.currentScript;var parent=script&&script.parentNode?script.parentNode:null;if(!parent||!script)return;var root=document.createElement('div');root.id=rootId;root.style.position='relative';root.style.display='inline-block';root.style.width=width+'px';root.style.height=height+'px';var iframe=document.createElement('iframe');iframe.src=displayHtmlUrl;iframe.width=width;iframe.height=height;iframe.scrolling='no';iframe.frameBorder='0';iframe.marginWidth='0';iframe.marginHeight='0';iframe.style.border='0';iframe.style.overflow='hidden';iframe.style.position='relative';iframe.style.zIndex='1';iframe.style.width='100%';iframe.style.height='100%';root.appendChild(iframe);var hoverStartedAt=null;root.addEventListener('mouseenter',function(){hoverStartedAt=Date.now();var url=buildEngagementUrl('hover_start');if(url)fire(url);});root.addEventListener('mouseleave',function(){var duration=hoverStartedAt?(Date.now()-hoverStartedAt):0;hoverStartedAt=null;var url=buildEngagementUrl('hover_end',duration);if(url)fire(url);});parent.insertBefore(root,script);parent.removeChild(script);}());`;
    default:
      return '';
  }
}

export function readDspMacroValue(query = {}, kind, dsp = '') {
  const normalizedDsp = normalizeDsp(dsp || query?.smx_dsp || query?.dsp);
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

export function buildDspLiteralClickUrl(clickTrackUrl, macroValue) {
  if (!clickTrackUrl) return clickTrackUrl;
  const literalMacroValue = safeDecode(macroValue).trim();
  if (!literalMacroValue) return clickTrackUrl;
  return `${literalMacroValue}${encodeURIComponent(String(clickTrackUrl))}`;
}

export function wrapTrackedClickUrlWithDspMacro(clickTrackUrl, query = {}, dsp = '') {
  const encodedMacro = readDspMacroValue(query, 'clickMacro', dsp);
  if (!encodedMacro || !clickTrackUrl) return clickTrackUrl;
  return buildDspTrackedClickUrl(clickTrackUrl, encodedMacro);
}
