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
  ttd: {
    label: 'The Trade Desk',
    clickMacroMode: 'prefix_url',
    queryParams: {
      dsp: 'TTD',
      cuu: '%%TTD_CLICK_URL%%',
      cb: '%%TTD_CACHEBUSTER%%',
      adid: '%%TTD_ADID%%',
      campaignid: '%%TTD_CAMPAIGNID%%',
      advid: '%%TTD_ADVERTISERID%%',
      supplyvendor: '%%TTD_SUPPLYVENDOR%%',
      siteid: '%%TTD_SITEID%%',
      placementid: '%%TTD_PLACEMENTID%%',
      devicetype: '%%TTD_DEVICETYPE%%',
      country: '%%TTD_COUNTRY%%',
      region: '%%TTD_REGION%%',
      gdpr: '%%TTD_GDPR%%',
      gdpr_consent: '%%TTD_GDPR_CONSENT%%',
      us_privacy: '%%TTD_USPRIVACY%%',
    },
    aliases: {
      clickMacro: ['cuu', 'smx_dsp_click', 'dsp_click', 'clickMacro'],
      siteDomain: ['siteid', 'dom', 'domain'],
      pageUrl: ['purl', 'pu'],
      deviceId: ['adid'],
      cookieId: [],
    },
  },
  dv360: {
    label: 'DV360',
    clickMacroMode: 'prefix_url',
    queryParams: {
      dsp: 'DV360',
      cuu: '${CLICK_URL_ESC}',
      cb: '${CACHEBUSTER}',
      adid: '${AD_ID}',
      advertiserId: '${ADVERTISER_ID}',
      campaignId: '${CAMPAIGN_ID}',
      creativeid: '${CREATIVE_ID}',
      siteid: '${SITE_ID}',
      app: '${APP_ID}',
      devicetype: '${DEVICE_TYPE}',
      country: '${COUNTRY_CODE}',
      gdpr: '${GDPR}',
      gdpr_consent: '${GDPR_CONSENT_755}',
      us_privacy: '${US_PRIVACY}',
    },
    aliases: {
      clickMacro: ['cuu', 'smx_dsp_click', 'dsp_click', 'clickMacro'],
      siteDomain: ['siteid', 'dom', 'domain'],
      pageUrl: ['purl', 'pu'],
      deviceId: ['adid'],
      cookieId: [],
    },
  },
  xandr: {
    label: 'Xandr / AppNexus',
    clickMacroMode: 'prefix_url',
    queryParams: {
      dsp: 'Xandr',
      cuu: '${CLICK_URL}',
      cb: '${CACHEBUSTER}',
      adid: '${CREATIVE_ID}',
      memberid: '${MEMBER_ID}',
      placementid: '${TAG_ID}',
      site: '${REFERER_URL_ENC}',
      device: '${DEVICE_TYPE}',
      country: '${USER_COUNTRY_CODE}',
      gdpr: '${GDPR}',
      gdpr_consent: '${GDPR_CONSENT}',
      us_privacy: '${US_PRIVACY}',
    },
    aliases: {
      clickMacro: ['cuu', 'smx_dsp_click', 'dsp_click', 'clickMacro'],
      siteDomain: ['site', 'dom', 'domain'],
      pageUrl: ['site', 'purl', 'pu'],
      deviceId: ['adid'],
      cookieId: [],
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

    // Non-Basis DSPs: use string concat (same as Basis) to preserve macro
    // literals verbatim. Using new URL() + searchParams.set() would
    // percent-encode values like %%TTD_CLICK_URL%% or ${CLICK_URL_ESC},
    // making them unresolvable by the DSP at impression time.
    const base = String(rawUrl).replace(/[?&]+$/, '');
    const parts = [];
    if (includeDspHint) parts.push(`smx_dsp=${normalizeDsp(dsp)}`);
    for (const [key, value] of Object.entries(config.queryParams)) {
      if (!includeClickMacro && config.aliases?.clickMacro?.includes(key)) continue;
      parts.push(`${key}=${value}`);
    }
    if (includeClickMacro) {
      const clickMacroKey = config.aliases?.clickMacro?.find((key) => key in config.queryParams);
      if (clickMacroKey) {
        const macroValue = String(clickMacroValue || config.queryParams[clickMacroKey] || '').trim();
        const nextParts = parts.filter((part) => !part.startsWith(`${clickMacroKey}=`) && !part.startsWith('smx_dsp_click='));
        nextParts.push(`${clickMacroKey}=${macroValue}`);
        nextParts.push(`smx_dsp_click=${macroValue}`);
        return `${base}?${nextParts.join('&')}`;
      }
    }
    return `${base}?${parts.join('&')}`;
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

export function buildDspTrackedClickUrl(clickTrackUrl, macroValue, dsp = '', { onUnresolved } = {}) {
  if (!clickTrackUrl) return clickTrackUrl;
  const mode = getDspMacroConfig(dsp)?.clickMacroMode || 'prefix_url';
  const resolvedMacroValue = resolveDspClickMacroValue(macroValue);
  if (!resolvedMacroValue) {
    if (typeof onUnresolved === 'function') onUnresolved({ dsp, macroValue });
    return clickTrackUrl;
  }
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
