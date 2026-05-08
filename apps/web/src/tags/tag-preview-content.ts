import { buildTagSnippet, type SnippetVariant } from '@smx/contracts/tag-snippets';
import {
  getDspMacroConfig,
  readCampaignDsp,
  shouldUseDspVideoDelivery,
} from '@smx/contracts/dsp-macros';
import type { DspMacroSpec, TagDiagnosticCheck, TagExportMode } from '../system';

export type TagFormat = 'VAST' | 'display' | 'native' | 'tracker';
export type TrackerType = 'click' | 'impression';

export interface PreviewSavedTag {
  id: string;
  format: TagFormat;
  name: string;
  width?: number | null;
  height?: number | null;
  trackerType?: TrackerType | null;
  clickUrl?: string | null;
}

export interface DeliveryDiagnosticEntry {
  policy?: {
    includeDspHint?: boolean;
    includeClickMacro?: boolean;
    measurementPath?: string;
  } | null;
  url?: string;
  jsUrl?: string;
  htmlUrl?: string;
  staticProfiles?: {
    default?: string;
    basis?: string;
    illumin?: string;
    vast4?: string;
  } | null;
  liveProfiles?: {
    default?: string;
    basis?: string;
    illumin?: string;
    vast4?: string;
  } | null;
}

export interface DeliveryDiagnosticsPayload {
  dsp?: {
    selected?: string | null;
  } | null;
  deliverySummary?: {
    deliveryMode?: string | null;
    previewStatus?: string | null;
    basisNativeActive?: boolean | null;
  } | null;
  deliveryDiagnostics?: {
    displayWrapper?: DeliveryDiagnosticEntry;
    vast?: DeliveryDiagnosticEntry;
    trackerClick?: DeliveryDiagnosticEntry;
    trackerImpression?: DeliveryDiagnosticEntry;
  } | null;
}

export function getDefaultVastSnippetVariant(campaignDsp = ''): SnippetVariant {
  const normalized = readCampaignDsp({ dsp: campaignDsp });
  if (normalized === 'basis') return 'vast-url-basis-macro';
  if (normalized === 'illumin') return 'vast-url-illumin-dynamic';
  return 'vast-url-vast4-dynamic';
}

export function getDefaultSnippetVariant(
  format: TagFormat,
  trackerType: TrackerType | null = null,
  campaignDsp = '',
): SnippetVariant {
  if (format === 'VAST') return getDefaultVastSnippetVariant(campaignDsp);
  if (format === 'display') return 'display-js';
  if (format === 'tracker') return trackerType === 'impression' ? 'tracker-impression' : 'tracker-click';
  return 'native-js';
}

export function getSnippetOptions(
  format: TagFormat,
  trackerType: TrackerType | null = null,
  campaignDsp = '',
): Array<{ value: SnippetVariant; label: string }> {
  if (format === 'VAST') {
    const optionMap: Record<string, { value: SnippetVariant; label: string }> = {
      basisMacro: { value: 'vast-url-basis-macro', label: 'Basis Macro URL' },
      basis: { value: 'vast-url-basis-dynamic', label: 'Basis Live XML' },
      illuminMacro: { value: 'vast-url-illumin-macro', label: 'Illumin Macro URL (Trafficking)' },
      illumin: { value: 'vast-url-illumin-dynamic', label: 'Illumin Live XML' },
      vast4: { value: 'vast-url-vast4-dynamic', label: 'VAST 4.x Live XML' },
    };
    const prioritizedKeys = [
      readCampaignDsp({ dsp: campaignDsp }) === 'basis'
        ? 'basisMacro'
        : readCampaignDsp({ dsp: campaignDsp }) === 'illumin'
          ? 'illumin'
          : 'vast4',
      'basisMacro',
      'basis',
      'illumin',
      'illuminMacro',
      'vast4',
    ];

    return [
      ...Array.from(new Set(prioritizedKeys)).map((key) => optionMap[key]).filter(Boolean),
      { value: 'vast-xml', label: 'XML Wrapper' },
    ];
  }
  if (format === 'display') {
    return [
      { value: 'display-js', label: 'JS Tag' },
      { value: 'display-iframe', label: 'Iframe Tag' },
      { value: 'display-ins', label: 'Ins Tag' },
    ];
  }
  if (format === 'tracker') {
    return trackerType === 'impression'
      ? [{ value: 'tracker-impression', label: 'Impression Pixel URL' }]
      : [{ value: 'tracker-click', label: 'Click Tracker URL' }];
  }
  return [{ value: 'native-js', label: 'JS Tag' }];
}

export function getSnippetHelpText(tag: PreviewSavedTag, variant: SnippetVariant, campaignDsp = ''): string {
  const selectedConfig = getDspMacroConfig(campaignDsp);
  const dspNote = selectedConfig
    ? ` ${selectedConfig.label} macros are embedded in the script URL. The DSP resolves them before delivering the tag to the publisher.`
    : '';
  if (tag.format === 'VAST') {
    if (variant === 'vast-url-basis-macro') {
      return 'Use this Basis-compatible live URL when the DSP expects visible Basis macros on the tag itself. It still resolves through the stable live Basis XML profile.';
    }
    if (variant === 'vast-url-basis-dynamic') {
      return 'Use this stable API endpoint when you want the live Basis-compatible XML to reflect ad-server changes without republishing.';
    }
    if (variant === 'vast-url-illumin-macro') {
      return 'Use this Illumin-compatible live URL only when trafficking into Illumin requires visible click macros on the tag itself. Illumin preview tools can leave those placeholders unresolved, so prefer Illumin Live XML for validation and QA.';
    }
    if (variant === 'vast-url-illumin-dynamic') {
      return 'Use this stable API endpoint when you want the live Illumin-compatible XML to reflect ad-server changes without republishing.';
    }
    if (variant === 'vast-url-vast4-dynamic') {
      return 'Use this stable API endpoint when you want the live VAST 4.x / OMID-capable XML without relying on a published artifact.';
    }
    return 'Use this XML wrapper only if your integration explicitly requires inline VAST XML. It wraps the currently selected live VAST URL option.';
  }
  if (tag.format === 'display') {
    if (variant === 'display-iframe') {
      return `Use the iframe tag for sandboxed display placements or when a publisher requests iframe delivery.${dspNote}`;
    }
    if (variant === 'display-ins') {
      return `Use the ins tag when the publisher expects a slot placeholder plus inline bootstrap code.${dspNote}`;
    }
    return `Use the JavaScript tag for standard display placements. This is not a VAST tag.${dspNote}`;
  }
  if (tag.format === 'tracker') {
    return variant === 'tracker-impression'
      ? `Use this 1x1 GIF URL as a pure impression tracker in external platforms.${dspNote}`
      : `Use this click tracker URL in Meta or other platforms when you only need click measurement.${dspNote}`;
  }
  return 'Use the JavaScript tag to initialize the native placement loader.';
}

export function resolveTagServingBaseUrl(): string {
  const resolved =
    import.meta.env.VITE_TAGS_BASE_URL?.trim() ||
    import.meta.env.VITE_API_BASE_URL?.trim() ||
    (typeof window !== 'undefined' ? window.location.origin : '');
  return resolved.replace(/\/+$/, '').replace(/\/v1$/, '');
}

function extractMacroTokens(input: string): string[] {
  const matches = input.match(/\$\{[^}]+\}|%%[^%]+%%|\[[A-Z_]+\]|\{[^}]+\}/g);
  return [...new Set(matches ?? [])];
}

function humanizeAlias(key: string): string {
  return key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^\w/, (char) => char.toUpperCase());
}

export function buildTagPreviewSnippets(
  tag: PreviewSavedTag,
  campaignDsp: string,
  diagnostics: DeliveryDiagnosticsPayload | null,
): Partial<Record<TagExportMode, string>> {
  const servingBaseUrl = resolveTagServingBaseUrl();
  const snippetOptions = getSnippetOptions(tag.format, tag.trackerType ?? null, campaignDsp);
  return snippetOptions.reduce((accumulator, option) => {
    accumulator[option.value as TagExportMode] = buildTagSnippet(tag, option.value, servingBaseUrl, campaignDsp, diagnostics);
    return accumulator;
  }, {} as Partial<Record<TagExportMode, string>>);
}

export function buildTagMacroSpec(campaignDsp: string): DspMacroSpec | null {
  const config = getDspMacroConfig(campaignDsp);
  if (!config) return null;

  const clickAliases = new Set(config.aliases?.clickMacro ?? []);
  const required = new Set<string>();
  const optional = new Set<string>();
  const descriptions: Record<string, string> = {};

  Object.entries(config.queryParams).forEach(([key, value]) => {
    const tokens = extractMacroTokens(String(value));
    tokens.forEach((token) => {
      descriptions[token] = humanizeAlias(key);
      if (clickAliases.has(key)) {
        required.add(token);
      } else {
        optional.add(token);
      }
    });
  });

  return {
    dsp: config.label,
    required: [...required],
    optional: [...optional],
    descriptions,
  };
}

export function getDeliveryModeLabel(
  deliveryMode?: string | null,
  basisNativeEnabled?: boolean,
  dspVideoEnabled?: boolean,
): string {
  if (deliveryMode === 'basis_native') return 'Basis Native';
  if (deliveryMode === 'dsp_video_contract') return 'DSP Video Contract';
  if (deliveryMode === 'smx_standard') return 'SMX Standard';
  if (basisNativeEnabled) return 'Basis Native';
  if (dspVideoEnabled) return 'DSP Video Contract';
  return 'SMX Standard';
}

export function getPreviewStatusLabel(
  previewStatus?: string | null,
  basisFallbackActive?: boolean,
  basisNativeEnabled?: boolean,
  dspVideoEnabled?: boolean,
): string {
  if (previewStatus === 'basis_preview_may_fallback') return 'Fallback Possible';
  if (previewStatus === 'dsp_video_contract_ready') return 'DSP Video Ready';
  if (basisFallbackActive) return 'Fallback Possible';
  if (basisNativeEnabled) return 'Basis First-Hop Ready';
  if (dspVideoEnabled) return 'DSP Video Ready';
  return 'Standard Delivery';
}

function summarizeDeliveryEntry(label: string, entry?: DeliveryDiagnosticEntry): TagDiagnosticCheck {
  const measurementPath = entry?.policy?.measurementPath ?? '';
  const hasUrl = Boolean(entry?.url || entry?.jsUrl || entry?.htmlUrl);
  const hasAnySignal = hasUrl || Boolean(measurementPath);

  if (!hasAnySignal) {
    return {
      id: label.toLowerCase().replace(/\s+/g, '-'),
      label,
      status: 'info',
      message: 'No diagnostics payload is available for this surface yet.',
    };
  }

  if (measurementPath.toLowerCase().includes('fallback')) {
    return {
      id: label.toLowerCase().replace(/\s+/g, '-'),
      label,
      status: 'warning',
      message: `Resolved via ${measurementPath}. Delivery is available but may fall back from the preferred path.`,
    };
  }

  return {
    id: label.toLowerCase().replace(/\s+/g, '-'),
    label,
    status: 'ok',
    message: measurementPath
      ? `Resolved via ${measurementPath}.`
      : 'Resolved delivery artifact and URL payload are available.',
  };
}

export function buildTagDiagnosticChecks(input: {
  savedTag: PreviewSavedTag;
  selectedCampaignDsp?: string;
  deliveryDiagnostics: DeliveryDiagnosticsPayload | null;
  onRepublishStaticDelivery?: () => void;
}): TagDiagnosticCheck[] {
  const { savedTag, selectedCampaignDsp = '', deliveryDiagnostics, onRepublishStaticDelivery } = input;
  const basisNativeEnabled = deliveryDiagnostics?.deliverySummary?.basisNativeActive ?? false;
  const dspVideoEnabled = deliveryDiagnostics?.deliverySummary?.deliveryMode === 'dsp_video_contract'
    || Boolean(savedTag.format === 'VAST' && shouldUseDspVideoDelivery(selectedCampaignDsp));
  const basisDiagnosticPath = deliveryDiagnostics?.deliveryDiagnostics?.displayWrapper?.policy?.measurementPath
    ?? deliveryDiagnostics?.deliveryDiagnostics?.trackerClick?.policy?.measurementPath
    ?? '';
  const basisFallbackActive = (deliveryDiagnostics?.deliverySummary?.previewStatus ?? basisDiagnosticPath).toLowerCase().includes('fallback');
  const deliveryDiagnosticSections = [
    { label: 'Display Wrapper', entry: deliveryDiagnostics?.deliveryDiagnostics?.displayWrapper },
    { label: 'VAST', entry: deliveryDiagnostics?.deliveryDiagnostics?.vast },
    { label: 'Tracker Click', entry: deliveryDiagnostics?.deliveryDiagnostics?.trackerClick },
    { label: 'Tracker Impression', entry: deliveryDiagnostics?.deliveryDiagnostics?.trackerImpression },
  ];
  const effectiveDsp = deliveryDiagnostics?.dsp?.selected || selectedCampaignDsp || 'none';
  const deliveryModeLabel = getDeliveryModeLabel(
    deliveryDiagnostics?.deliverySummary?.deliveryMode,
    basisNativeEnabled,
    dspVideoEnabled,
  );
  const previewStatusLabel = getPreviewStatusLabel(
    deliveryDiagnostics?.deliverySummary?.previewStatus,
    basisFallbackActive,
    basisNativeEnabled,
    dspVideoEnabled,
  );
  const checks: TagDiagnosticCheck[] = [
    {
      id: 'selected-dsp',
      label: 'Selected DSP',
      status: effectiveDsp === 'none' ? 'warning' : 'ok',
      message: effectiveDsp === 'none'
        ? 'No DSP is selected, so delivery policy falls back to the default account behavior.'
        : `Diagnostics are resolving against ${effectiveDsp}.`,
    },
    {
      id: 'delivery-mode',
      label: 'Delivery Mode',
      status: deliveryModeLabel === 'SMX Standard' ? 'info' : 'ok',
      message: `Effective mode: ${deliveryModeLabel}.`,
    },
    {
      id: 'preview-status',
      label: 'Preview Status',
      status: previewStatusLabel === 'Fallback Possible' ? 'warning' : 'ok',
      message: `Preview readiness: ${previewStatusLabel}.`,
    },
    {
      id: 'measurement-path',
      label: 'Measurement Path',
      status: basisDiagnosticPath
        ? basisDiagnosticPath.toLowerCase().includes('fallback')
          ? 'warning'
          : 'ok'
        : 'info',
      message: basisDiagnosticPath || 'No measurement path has been emitted yet.',
    },
    ...deliveryDiagnosticSections.map((section) => summarizeDeliveryEntry(section.label, section.entry)),
  ];

  if (savedTag.format === 'VAST' && !deliveryDiagnostics?.deliveryDiagnostics?.vast?.staticProfiles) {
    checks.push({
      id: 'static-delivery',
      label: 'Static Delivery Artifacts',
      status: 'warning',
      message: 'Public XML profiles are not published yet for this VAST tag.',
      action: onRepublishStaticDelivery
        ? {
            label: 'Republish',
            onClick: onRepublishStaticDelivery,
          }
        : undefined,
    });
  }

  return checks;
}
