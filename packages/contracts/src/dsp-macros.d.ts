export interface DspMacroConfig {
  label: string;
  queryParams: Record<string, string>;
  aliases?: Record<string, string[]>;
}

export declare const DSP_MACRO_CONFIGS: Record<string, DspMacroConfig>;
export declare const DSP_DELIVERY_KINDS: {
  DISPLAY_WRAPPER: string;
  HTML5_INTERNAL: string;
  VAST: string;
  VIDEO: string;
  TRACKER_CLICK: string;
  TRACKER_IMPRESSION: string;
};
export declare function normalizeDsp(value: unknown): string;
export declare function readCampaignDsp(metadata: unknown): string;
export declare function getDspMacroConfig(dsp: unknown): DspMacroConfig | null;
export declare function shouldUseBasisNativeDelivery(dsp: unknown): boolean;
export declare function shouldUseDspVideoDelivery(dsp: unknown): boolean;
export declare function listSupportedDsps(): Array<{ value: string; label: string }>;
export declare function applyDspMacrosToUrl(
  rawUrl: string,
  dsp: unknown,
  opts?: { includeClickMacro?: boolean; includeDspHint?: boolean; clickMacroValue?: string },
): string;
export declare function readDspMacroValue(
  query: Record<string, unknown>,
  kind: string,
  dsp?: unknown,
): string | null;
export declare function isResolvedDspMacroValue(value: unknown): boolean;
export declare function resolveDspClickMacroValue(value: unknown): string;
export declare function buildDspTrackedClickUrl(clickTrackUrl: string, macroValue: unknown): string;
export declare function buildDspLiteralClickUrl(clickTrackUrl: string, macroValue: unknown): string;
export declare function getDspDeliveryPolicy(
  dsp: unknown,
  deliveryKind: unknown,
): {
  includeDspHint: boolean;
  includeClickMacro: boolean;
  measurementPath: string;
  clickMacroValue: string;
};
export declare function applyDspMacrosToDeliveryUrl(
  rawUrl: string,
  dsp: unknown,
  deliveryKind: unknown,
  opts?: { includeClickMacro?: boolean; includeDspHint?: boolean; clickMacroValue?: string },
): string;
export declare function buildDspNativeClickHref(clickTrackUrl: string, dsp: unknown): string;
export declare function buildBasisNativeSnippet(input: {
  variant: string;
  tagId?: string;
  displayHtmlUrl?: string;
  nativeJsUrl?: string;
  vastUrl?: string;
  trackerClickUrl?: string;
  trackerEngagementUrl?: string;
  trackerImpressionUrl?: string;
  trackerViewabilityUrl?: string;
  width?: number;
  height?: number;
}): string;
export declare function buildVastWrapperSnippet(tagId: string, vastUrl: string): string;
export declare function buildDspVideoContractExamples(baseUrl: string, tagId: string): {
  standard: { label: string; url: string; xmlWrapper: string };
  basis: { label: string; url: string; xmlWrapper: string };
  illumin: { label: string; url: string; xmlWrapper: string };
};
export declare function wrapTrackedClickUrlWithDspMacro(
  clickTrackUrl: string,
  query?: Record<string, unknown>,
  dsp?: unknown,
): string;
