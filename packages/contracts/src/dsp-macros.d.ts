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
  TRACKER_CLICK: string;
  TRACKER_IMPRESSION: string;
};
export declare function normalizeDsp(value: unknown): string;
export declare function readCampaignDsp(metadata: unknown): string;
export declare function getDspMacroConfig(dsp: unknown): DspMacroConfig | null;
export declare function listSupportedDsps(): Array<{ value: string; label: string }>;
export declare function applyDspMacrosToUrl(
  rawUrl: string,
  dsp: unknown,
  opts?: { includeClickMacro?: boolean; includeDspHint?: boolean },
): string;
export declare function readDspMacroValue(
  query: Record<string, unknown>,
  kind: string,
  dsp?: unknown,
): string | null;
export declare function isResolvedDspMacroValue(value: unknown): boolean;
export declare function resolveDspClickMacroValue(value: unknown): string;
export declare function buildDspTrackedClickUrl(clickTrackUrl: string, macroValue: unknown): string;
export declare function getDspDeliveryPolicy(
  dsp: unknown,
  deliveryKind: unknown,
): {
  includeDspHint: boolean;
  includeClickMacro: boolean;
  measurementPath: string;
};
export declare function applyDspMacrosToDeliveryUrl(
  rawUrl: string,
  dsp: unknown,
  deliveryKind: unknown,
  opts?: { includeClickMacro?: boolean; includeDspHint?: boolean },
): string;
export declare function wrapTrackedClickUrlWithDspMacro(
  clickTrackUrl: string,
  query?: Record<string, unknown>,
  dsp?: unknown,
): string;
