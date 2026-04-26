export const DSP_MACRO_CONFIGS = {
  basis: {
    label: 'Basis',
    clickMacroMode: 'prefix_url',
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
  illumin: {
    label: 'Illumin',
    clickMacroMode: 'replace_destination',
    queryParams: {
      dsp: 'Illumin',
      cuu: '[CLICK_URL_ENCODED]',
      cb: '[CACHEBUSTER]',
      tmp: '[timestamp]',
      excid: '[EXCHANGE_ID]',
      excpubid: '[EXCHANGE_PUBLISHER_ID]',
      excsiddmn: '[EXCHANGE_SITE_ID_OR_DOMAIN]',
      sdmn: '[SITE_DOMAIN_ENCODED_URL]',
      sid: '[SITE_ID]',
      appb: '[APP_BUNDLE]',
      appn: '[APP_NAME]',
      appne: '[APP_NAME_ENCODED]',
      cmpne: '[CAMPAIGN_NAME_ENCODED]',
      cmpid: '[CAMPAIGN_ID]',
      adgne: '[AD_GROUP_NAME_ENCODED]',
      adgid: '[AD_GROUP_ID]',
      crene: '[CREATIVE_NAME_ENCODED]',
      cresze: '[CREATIVE_SIZE_ENCODED]',
      cretye: '[CREATIVE_TYPE_ENCODED]',
      creid: '[CREATIVE_ID]',
      wbrse: '[WEB_BROWSER_ENCODED]',
      oprsye: '[OPERATING_SYSTEM_ENCODED]',
      vph: '[VIDEO_PLAYER_HEIGHT]',
      vpw: '[VIDEO_PLAYER_WIDTH]',
      vdur: '[VIDEO_DURATION]',
      lcc: '[LOC_COUNTRY]',
      lclat: '[LOC_LAT]',
      lclong: '[LOC_LONG]',
      dtyp: '[DEVICE_TYPE]',
      lcst: '[LICENSEE_COST]',
      cs_gdpr: '${GDPR}',
      cs_gdpr_consent: '${GDPR_CONSENT_699}',
    },
    aliases: {
      clickMacro: ['smx_dsp_click', 'cuu', 'dsp_click', 'clickMacro', 'clickMacroEnc', 'click_macro_enc'],
      siteDomain: ['sdmn', 'dom', 'sd', 'domain'],
      pageUrl: ['purl', 'pu', 'pageUrlEnc'],
      deviceId: ['ifa', 'gadvid', 'googleAdvertisingId', 'idfa'],
      cookieId: ['iuid', 'internalUserId', 'sid'],
    },
  },
};

export const DSP_DELIVERY_KINDS = {
  DISPLAY_WRAPPER: 'display_wrapper',
  HTML5_INTERNAL: 'html5_internal',
  VAST: 'vast',
  VIDEO: 'video',
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

export function shouldUseDspVideoDelivery(dsp) {
  return Boolean(getDspMacroConfig(dsp));
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
  const config = getDspMacroConfig(normalizedDsp);

  const basePolicy = {
    includeDspHint: true,
    includeClickMacro: false,
    measurementPath: 'smx_fallback',
    clickMacroValue: '',
  };

  if (!config) return basePolicy;

  const clickMacroKey = config.aliases?.clickMacro?.find((key) => key in config.queryParams);
  const defaultClickMacroValue = clickMacroKey ? String(config.queryParams[clickMacroKey] ?? '').trim() : '';
  const measurementPath = `${normalizedDsp}_macro_or_smx_fallback`;

  switch (normalizedKind) {
    case DSP_DELIVERY_KINDS.DISPLAY_WRAPPER:
      return {
        ...basePolicy,
        includeDspHint: true,
        includeClickMacro: true,
        measurementPath,
        clickMacroValue: defaultClickMacroValue,
      };
    case DSP_DELIVERY_KINDS.HTML5_INTERNAL:
      return {
        ...basePolicy,
        includeDspHint: true,
        includeClickMacro: true,
        measurementPath,
        clickMacroValue: defaultClickMacroValue,
      };
    case DSP_DELIVERY_KINDS.VAST:
    case DSP_DELIVERY_KINDS.VIDEO:
      return {
        ...basePolicy,
        includeDspHint: true,
        includeClickMacro: true,
        measurementPath,
        clickMacroValue: defaultClickMacroValue,
      };
    case DSP_DELIVERY_KINDS.TRACKER_CLICK:
      return {
        ...basePolicy,
        includeDspHint: true,
        includeClickMacro: true,
        measurementPath,
        clickMacroValue: defaultClickMacroValue,
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
  trackerViewabilityUrl = '',
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
      return `(function(){var rootId=${JSON.stringify(`smx-basis-slot-${tagId}`)};var width=${JSON.stringify(String(width))};var height=${JSON.stringify(String(height))};var displayHtmlUrl=${JSON.stringify(displayHtmlUrl)};var engagementBase=${JSON.stringify(trackerEngagementUrl)};var impressionBase=${JSON.stringify(trackerImpressionUrl)};var viewabilityBase=${JSON.stringify(trackerViewabilityUrl)};function withParams(base,params){if(!base)return'';var sep=base.indexOf('?')===-1?'?':'&';return base+sep+params.join('&');}function currentPageUrl(){try{return window.top&&window.top.location&&window.top.location.href?window.top.location.href:window.location&&window.location.href?window.location.href:'';}catch(_error){try{return window.location&&window.location.href?window.location.href:'';}catch(_error2){return'';}}}function currentDomain(pageUrl){if(!pageUrl)return'';try{return new URL(pageUrl).hostname||'';}catch(_error){return'';}}function base64UrlEncode(text){try{var encoded=btoa(unescape(encodeURIComponent(text)));return encoded.replace(/\\+/g,'-').replace(/\\//g,'_').replace(/=+$/,'');}catch(_error){return'';}}function readSourceParams(){try{var src=script&&script.src?new URL(script.src,window.location.href):null;if(!src)return{};var out={};src.searchParams.forEach(function(value,key){out[key]=value;});return out;}catch(_error){return{};}}function appendCtx(url,ctxToken){if(!url)return'';if(!ctxToken)return url;return withParams(url,['ctx='+encodeURIComponent(ctxToken)]);}function fire(url){try{var img=new Image();img.src=url;}catch(_error){}}var script=document.currentScript;var parent=script&&script.parentNode?script.parentNode:null;if(!parent||!script)return;var sourceParams=readSourceParams();var pageUrl=currentPageUrl();if(pageUrl)sourceParams.pu=pageUrl;if(!sourceParams.dom){var resolvedDomain=currentDomain(pageUrl);if(resolvedDomain)sourceParams.dom=resolvedDomain;}var ctxToken=base64UrlEncode(JSON.stringify(sourceParams));function buildEventUrl(base,eventType,hoverDurationMs){if(!base)return'';var params=[];if(eventType)params.push('event='+encodeURIComponent(eventType));if(pageUrl)params.push('pu='+encodeURIComponent(pageUrl));if(typeof hoverDurationMs==='number'&&hoverDurationMs>=0)params.push('hd='+encodeURIComponent(String(Math.round(hoverDurationMs))));return appendCtx(withParams(base,params),ctxToken);}function generateId(prefix){if(typeof crypto!=='undefined'&&typeof crypto.randomUUID==='function'){return crypto.randomUUID();}return prefix+'-'+Date.now()+'-'+Math.random().toString(16).slice(2);}function readCookie(name){try{var match=document.cookie.match(new RegExp('(?:^|; )'+name.replace(/[.$?*|{}()\\[\\]\\\\/+^]/g,'\\\\$&')+'=([^;]*)'));return match?decodeURIComponent(match[1]):'';}catch(_error){return'';}}function writeCookie(name,value,maxAgeDays){try{var expires='';if(maxAgeDays)expires='; max-age='+String(Math.floor(maxAgeDays*24*60*60));document.cookie=name+'='+encodeURIComponent(value)+expires+'; path=/; SameSite=None; Secure';}catch(_error){}}function readStorage(key){try{return window.localStorage?String(window.localStorage.getItem(key)||''):'';}catch(_error){return'';}}function writeStorage(key,value){try{if(window.localStorage)window.localStorage.setItem(key,value);}catch(_error){}}function resolveIdentity(kind){var queryKey=kind==='device'?'did':'cid';var storageKey=kind==='device'?'smx_device_id':'smx_cookie_id';var existing=sourceParams[queryKey]||readStorage(storageKey)||readCookie(storageKey);if(existing){writeStorage(storageKey,existing);writeCookie(storageKey,existing,kind==='device'?365:30);return existing;}var created=generateId(kind==='device'?'dev':'cid');writeStorage(storageKey,created);writeCookie(storageKey,created,kind==='device'?365:30);return created;}var impressionId=sourceParams.imp||generateId('imp');var resolvedDeviceId=resolveIdentity('device');var resolvedCookieId=resolveIdentity('cookie');function appendIdentity(url){var next=url;if(!next)return next;next+=(next.indexOf('?')===-1?'?':'&')+'imp='+encodeURIComponent(String(impressionId));if(resolvedDeviceId)next+='&did='+encodeURIComponent(String(resolvedDeviceId));if(resolvedCookieId)next+='&cid='+encodeURIComponent(String(resolvedCookieId));return next;}var iframe=document.createElement('iframe');iframe.src=appendIdentity(appendCtx(displayHtmlUrl,ctxToken));iframe.width=width;iframe.height=height;iframe.scrolling='no';iframe.frameBorder='0';iframe.marginWidth='0';iframe.marginHeight='0';iframe.style.border='0';iframe.style.overflow='hidden';iframe.style.position='relative';iframe.style.zIndex='1';iframe.style.width='100%';iframe.style.height='100%';var root=document.createElement('div');root.id=rootId;root.style.position='relative';root.style.display='inline-block';root.style.width=width+'px';root.style.height=height+'px';root.appendChild(iframe);var hoverStartedAt=null;var measured=false;var tracked=false;var visibilityTimer=null;root.addEventListener('mouseenter',function(){hoverStartedAt=Date.now();var url=appendIdentity(buildEventUrl(engagementBase,'hover_start'));if(url)fire(url);});root.addEventListener('mouseleave',function(){var duration=hoverStartedAt?(Date.now()-hoverStartedAt):0;hoverStartedAt=null;var url=appendIdentity(buildEventUrl(engagementBase,'hover_end',duration));if(url)fire(url);});var impressionUrl=appendIdentity(appendCtx(impressionBase,ctxToken));if(impressionUrl)fire(impressionUrl);function measuredUrl(){return appendIdentity(buildEventUrl(viewabilityBase,'measured'));}function viewableUrl(){return appendIdentity(withParams(appendCtx(viewabilityBase,ctxToken),['state=viewable','vp=1','fmt=display','method=intersection_observer','ms=1000'].concat(pageUrl?['pu='+encodeURIComponent(pageUrl)]:[])));}function measuredStateUrl(){return appendIdentity(withParams(appendCtx(viewabilityBase,ctxToken),['state=measured','fmt=display','method=intersection_observer'].concat(pageUrl?['pu='+encodeURIComponent(pageUrl)]:[])));}if(typeof IntersectionObserver==='function'&&viewabilityBase){if(!measured){measured=true;fire(measuredStateUrl());}var observer=new IntersectionObserver(function(entries){entries.forEach(function(entry){if(entry.isIntersecting&&entry.intersectionRatio>=0.5){if(!visibilityTimer){visibilityTimer=window.setTimeout(function(){if(tracked)return;tracked=true;fire(viewableUrl());observer.disconnect();},1000);}}else if(visibilityTimer){window.clearTimeout(visibilityTimer);visibilityTimer=null;}});},{threshold:[0.5]});observer.observe(root);}parent.insertBefore(root,script);parent.removeChild(script);}());`;
    default:
      return '';
  }
}

export function buildVastWrapperSnippet(tagId, vastUrl) {
  return `<VAST xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">\n  <Ad id="${tagId}">\n    <Wrapper>\n      <AdSystem>SMX Studio</AdSystem>\n      <VASTAdTagURI><![CDATA[${vastUrl}]]></VASTAdTagURI>\n    </Wrapper>\n  </Ad>\n</VAST>`;
}

export function buildDspVideoContractExamples(baseUrl, tagId) {
  const standardUrl = applyDspMacrosToDeliveryUrl(`${baseUrl}/v1/vast/tags/${tagId}`, '', DSP_DELIVERY_KINDS.VIDEO);
  const basisUrl = applyDspMacrosToDeliveryUrl(`${baseUrl}/v1/vast/tags/${tagId}`, 'basis', DSP_DELIVERY_KINDS.VIDEO);
  const illuminUrl = applyDspMacrosToDeliveryUrl(`${baseUrl}/v1/vast/tags/${tagId}`, 'illumin', DSP_DELIVERY_KINDS.VIDEO);
  return {
    standard: {
      label: 'SMX Standard',
      url: standardUrl,
      xmlWrapper: buildVastWrapperSnippet(tagId, standardUrl),
    },
    basis: {
      label: 'Basis',
      url: basisUrl,
      xmlWrapper: buildVastWrapperSnippet(tagId, basisUrl),
    },
    illumin: {
      label: 'Illumin',
      url: illuminUrl,
      xmlWrapper: buildVastWrapperSnippet(tagId, illuminUrl),
    },
  };
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

function isHttpUrl(value) {
  try {
    const parsed = new URL(String(value));
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function buildDestinationAwareClickUrl(clickTrackUrl, destinationUrl) {
  try {
    const nextUrl = new URL(String(clickTrackUrl));
    nextUrl.searchParams.set('url', String(destinationUrl));
    return nextUrl.toString();
  } catch {
    return clickTrackUrl;
  }
}

export function buildDspTrackedClickUrl(clickTrackUrl, macroValue, dsp = '') {
  if (!clickTrackUrl) return clickTrackUrl;
  const mode = getDspMacroConfig(dsp)?.clickMacroMode || 'prefix_url';
  const resolvedMacroValue = resolveDspClickMacroValue(macroValue);
  if (!resolvedMacroValue) return clickTrackUrl;
  if (mode === 'replace_destination') {
    return isHttpUrl(resolvedMacroValue)
      ? buildDestinationAwareClickUrl(clickTrackUrl, resolvedMacroValue)
      : clickTrackUrl;
  }
  return `${resolvedMacroValue}${encodeURIComponent(String(clickTrackUrl))}`;
}

export function buildDspLiteralClickUrl(clickTrackUrl, macroValue, dsp = '') {
  if (!clickTrackUrl) return clickTrackUrl;
  const mode = getDspMacroConfig(dsp)?.clickMacroMode || 'prefix_url';
  const literalMacroValue = safeDecode(macroValue).trim();
  if (!literalMacroValue) return clickTrackUrl;
  if (mode === 'replace_destination') {
    return isHttpUrl(literalMacroValue)
      ? buildDestinationAwareClickUrl(clickTrackUrl, literalMacroValue)
      : clickTrackUrl;
  }
  return `${literalMacroValue}${encodeURIComponent(String(clickTrackUrl))}`;
}

export function wrapTrackedClickUrlWithDspMacro(clickTrackUrl, query = {}, dsp = '') {
  const normalizedDsp = normalizeDsp(dsp || query?.smx_dsp || query?.dsp);
  const encodedMacro = readDspMacroValue(query, 'clickMacro', normalizedDsp);
  if (!encodedMacro || !clickTrackUrl) return clickTrackUrl;
  return buildDspTrackedClickUrl(clickTrackUrl, encodedMacro, normalizedDsp);
}
