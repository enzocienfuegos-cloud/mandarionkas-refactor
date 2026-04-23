export function normalizeDsp(value: unknown): string {
  const text = String(value ?? '').trim().toLowerCase();
  return text || '';
}

export function readCampaignDsp(metadata: unknown): string {
  if (!metadata || typeof metadata !== 'object') return '';
  return normalizeDsp((metadata as { dsp?: unknown }).dsp);
}

export function applyDspMacrosToUrl(rawUrl: string, dsp: string, opts: { includeClickMacro?: boolean } = {}): string {
  if (!rawUrl || normalizeDsp(dsp) !== 'basis') return rawUrl;
  const { includeClickMacro = false } = opts;

  try {
    const url = new URL(String(rawUrl));
    const macroParams: Record<string, string> = {
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
    };
    if (includeClickMacro) {
      macroParams.dsp_click = '{clickMacroEnc}';
    }
    for (const [key, value] of Object.entries(macroParams)) {
      url.searchParams.set(key, value);
    }
    return url.toString();
  } catch {
    return rawUrl;
  }
}
