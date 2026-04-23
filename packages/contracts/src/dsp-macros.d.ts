export interface DspMacroConfig {
  label: string;
  queryParams: Record<string, string>;
  aliases?: Record<string, string[]>;
}

export declare const DSP_MACRO_CONFIGS: Record<string, DspMacroConfig>;
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
export declare function wrapTrackedClickUrlWithDspMacro(
  clickTrackUrl: string,
  query?: Record<string, unknown>,
  dsp?: unknown,
): string;
