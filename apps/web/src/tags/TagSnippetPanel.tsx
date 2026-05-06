import React, { useEffect, useState } from 'react';
import {
  buildTagSnippet,
  type SnippetVariant,
} from '@smx/contracts/tag-snippets';
import {
  getDspMacroConfig,
  readCampaignDsp,
} from '@smx/contracts/dsp-macros';

type TagFormat = 'VAST' | 'display' | 'native' | 'tracker';
type TrackerType = 'click' | 'impression';

interface SavedTag {
  id: string;
  format: TagFormat;
  name: string;
  width?: number | null;
  height?: number | null;
  trackerType?: TrackerType | null;
}

interface DeliveryDiagnosticEntry {
  liveProfiles?: {
    default?: string;
    basis?: string;
    illumin?: string;
    vast4?: string;
  } | null;
}

interface DeliveryDiagnosticsPayload {
  deliveryDiagnostics?: {
    vast?: DeliveryDiagnosticEntry;
  } | null;
}

interface TagSnippetPanelProps {
  tag: SavedTag;
  campaignDsp: string;
  diagnostics: DeliveryDiagnosticsPayload | null;
}

function getDefaultVastSnippetVariant(campaignDsp = ''): SnippetVariant {
  const normalized = readCampaignDsp({ dsp: campaignDsp });
  if (normalized === 'basis') return 'vast-url-basis-macro';
  if (normalized === 'illumin') return 'vast-url-illumin-dynamic';
  return 'vast-url-vast4-dynamic';
}

function getDefaultSnippetVariant(
  format: TagFormat,
  trackerType: TrackerType | null = null,
  campaignDsp = '',
): SnippetVariant {
  if (format === 'VAST') return getDefaultVastSnippetVariant(campaignDsp);
  if (format === 'display') return 'display-js';
  if (format === 'tracker') return trackerType === 'impression' ? 'tracker-impression' : 'tracker-click';
  return 'native-js';
}

function getSnippetOptions(
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

function getSnippetHelpText(tag: SavedTag, variant: SnippetVariant, campaignDsp = ''): string {
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

function resolveTagServingBaseUrl(): string {
  const resolved =
    import.meta.env.VITE_TAGS_BASE_URL?.trim() ||
    import.meta.env.VITE_API_BASE_URL?.trim() ||
    (typeof window !== 'undefined' ? window.location.origin : '');
  return resolved.replace(/\/+$/, '').replace(/\/v1$/, '');
}

export default function TagSnippetPanel({
  tag,
  campaignDsp,
  diagnostics,
}: TagSnippetPanelProps) {
  const [snippetVariant, setSnippetVariant] = useState<SnippetVariant>(
    getDefaultSnippetVariant(tag.format, tag.trackerType ?? null, campaignDsp),
  );
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const availableVariants = getSnippetOptions(tag.format, tag.trackerType ?? null, campaignDsp)
      .map((option) => option.value);
    setSnippetVariant((current) => (
      availableVariants.includes(current)
        ? current
        : getDefaultSnippetVariant(tag.format, tag.trackerType ?? null, campaignDsp)
    ));
  }, [tag.format, tag.trackerType, campaignDsp]);

  const servingBaseUrl = resolveTagServingBaseUrl();
  const isBaseUrlValid = /^https?:\/\//.test(servingBaseUrl);

  const handleCopy = () => {
    navigator.clipboard.writeText(
      buildTagSnippet(tag, snippetVariant, servingBaseUrl, campaignDsp, diagnostics),
    ).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="rounded-xl border border-[color:var(--dusk-border-default)] bg-surface-1 p-6">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-base font-semibold text-[color:var(--dusk-text-primary)]">Generated Tag Snippet</h2>
        <button
          onClick={handleCopy}
          className={`text-sm font-medium px-3 py-1.5 rounded-lg transition-colors ${
            copied
              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300'
              : 'bg-[color:var(--dusk-surface-muted)] text-[color:var(--dusk-text-secondary)] hover:bg-[color:var(--dusk-border-subtle)] hover:text-[color:var(--dusk-text-primary)]'
          }`}
        >
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <div className="mb-3 flex flex-wrap gap-2">
        {getSnippetOptions(tag.format, tag.trackerType ?? null, campaignDsp).map(option => (
          <button
            key={option.value}
            type="button"
            onClick={() => setSnippetVariant(option.value)}
            className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
              snippetVariant === option.value
                ? 'border-fuchsia-500 bg-fuchsia-50 text-fuchsia-700 dark:border-fuchsia-500/30 dark:bg-fuchsia-500/10 dark:text-fuchsia-300'
                : 'border-[color:var(--dusk-border-default)] bg-surface-1 text-[color:var(--dusk-text-secondary)] hover:border-[color:var(--dusk-border-strong)] hover:bg-[color:var(--dusk-surface-muted)] hover:text-[color:var(--dusk-text-primary)]'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
      <p className="mb-3 text-xs text-[color:var(--dusk-text-secondary)]">
        {getSnippetHelpText(tag, snippetVariant, campaignDsp)}
      </p>
      {!isBaseUrlValid && (
        <div className="mb-3 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-800">
          {'\u26A0'} Serving base URL is not configured. Set <code>VITE_TAGS_BASE_URL</code> in your environment before copying this snippet.
        </div>
      )}
      <pre className="bg-slate-900 text-slate-100 text-xs p-4 rounded-lg overflow-x-auto whitespace-pre-wrap font-mono">
        {buildTagSnippet(tag, snippetVariant, servingBaseUrl, campaignDsp, diagnostics)}
      </pre>
    </div>
  );
}
