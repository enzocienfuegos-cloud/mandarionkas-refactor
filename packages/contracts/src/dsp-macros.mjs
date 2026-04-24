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
      dsp_click: '{clickMacroEnc}',
    },
    aliases: {
      clickMacro: ['smx_dsp_click', 'dsp_click', 'clickMacroEnc', 'click_macro_enc'],
      siteDomain: ['sd', 'domain', 'inventoryUnitReportingName'],
      deviceId: ['ifa', 'googleAdvertisingId', 'idfa'],
      cookieId: ['basis_uid', 'internalUserId'],
    },
  },
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
  const { includeClickMacro = false, includeDspHint = true } = opts;

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
        url.searchParams.set('smx_dsp_click', config.queryParams[clickMacroKey]);
      }
    }
    return url.toString();
  } catch {
    return rawUrl;
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

export function wrapTrackedClickUrlWithDspMacro(clickTrackUrl, query = {}, dsp = '') {
  const encodedMacro = readDspMacroValue(query, 'clickMacro', dsp);
  if (!encodedMacro || !clickTrackUrl) return clickTrackUrl;

  const prefix = safeDecode(encodedMacro);
  if (!isResolvedDspMacroValue(prefix)) return clickTrackUrl;
  return `${prefix}${encodeURIComponent(String(clickTrackUrl))}`;
}
