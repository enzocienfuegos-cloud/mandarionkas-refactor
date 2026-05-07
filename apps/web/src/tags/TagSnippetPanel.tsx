import React, { useEffect, useState } from 'react';
import { Badge, Button, Kicker, Panel } from '../system';
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
    <Panel className="p-6">
      <div className="flex items-center justify-between mb-3">
        <div>
          <Kicker>Snippet</Kicker>
          <h2 className="text-base font-semibold text-[color:var(--dusk-text-primary)] mt-2">Generated Tag Snippet</h2>
        </div>
        <Button
          onClick={handleCopy}
          variant={copied ? 'secondary' : 'ghost'}
          size="sm"
        >
          {copied ? 'Copied' : 'Copy'}
        </Button>
      </div>
      <div className="mb-3 flex flex-wrap gap-2">
        {getSnippetOptions(tag.format, tag.trackerType ?? null, campaignDsp).map(option => (
          <Button
            key={option.value}
            type="button"
            onClick={() => setSnippetVariant(option.value)}
            variant={snippetVariant === option.value ? 'secondary' : 'ghost'}
            size="sm"
          >
            {option.label}
          </Button>
        ))}
      </div>
      <p className="mb-3 text-xs text-[color:var(--dusk-text-secondary)]">
        {getSnippetHelpText(tag, snippetVariant, campaignDsp)}
      </p>
      {!isBaseUrlValid && (
        <Panel className="mb-3 border-[color:var(--dusk-status-warning-border)] bg-[color:var(--dusk-status-warning-bg)] p-3 text-xs text-[color:var(--dusk-status-warning-fg)]">
          <div className="flex items-start gap-2">
            <Badge tone="warning" size="sm">Warning</Badge>
            <p>
              Serving base URL is not configured. Set <code>VITE_TAGS_BASE_URL</code> in your environment before copying this snippet.
            </p>
          </div>
        </Panel>
      )}
      <pre className="bg-slate-900 text-slate-100 text-xs p-4 rounded-lg overflow-x-auto whitespace-pre-wrap font-mono">
        {buildTagSnippet(tag, snippetVariant, servingBaseUrl, campaignDsp, diagnostics)}
      </pre>
    </Panel>
  );
}
