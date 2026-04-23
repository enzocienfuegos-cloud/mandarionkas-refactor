const DSP_MACRO_CONFIGS = {
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
  },
};

function readValue(value) {
  const candidate = Array.isArray(value) ? value[0] : value;
  const text = String(candidate ?? '').trim();
  return text || null;
}

export function normalizeDsp(value) {
  const text = readValue(value);
  if (!text) return '';
  return text.toLowerCase();
}

export function readCampaignDsp(metadata) {
  if (!metadata || typeof metadata !== 'object') return '';
  return normalizeDsp(metadata.dsp);
}

export function getDspMacroConfig(dsp) {
  const normalized = normalizeDsp(dsp);
  return normalized ? (DSP_MACRO_CONFIGS[normalized] ?? null) : null;
}

export function applyDspMacrosToUrl(rawUrl, dsp, opts = {}) {
  const config = getDspMacroConfig(dsp);
  if (!config || !rawUrl) return rawUrl;
  const { includeClickMacro = false } = opts;

  try {
    const url = new URL(String(rawUrl));
    for (const [key, value] of Object.entries(config.queryParams)) {
      if (!includeClickMacro && key === 'dsp_click') continue;
      url.searchParams.set(key, value);
    }
    return url.toString();
  } catch {
    return rawUrl;
  }
}

function safeDecode(value) {
  if (!value) return '';
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export function wrapTrackedClickUrlWithDspMacro(clickTrackUrl, query = {}) {
  const encodedMacro = readValue(query.dsp_click) ?? readValue(query.clickMacroEnc) ?? readValue(query.click_macro_enc);
  if (!encodedMacro || !clickTrackUrl) return clickTrackUrl;

  const prefix = safeDecode(encodedMacro);
  if (!prefix) return clickTrackUrl;
  return `${prefix}${encodeURIComponent(String(clickTrackUrl))}`;
}
