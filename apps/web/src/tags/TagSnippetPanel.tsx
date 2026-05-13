import React, { useEffect, useMemo, useState } from 'react';
import { Badge, Kicker, MacroResolver, Panel, TagSnippetBlock, type TagExportMode } from '../system';
import type { SnippetVariant } from '@smx/contracts/tag-snippets';
import {
  buildTagMacroSpec,
  buildTagPreviewSnippets,
  getDefaultSnippetVariant,
  getSnippetHelpText,
  getSnippetOptions,
  resolveTagServingBaseUrl,
  type DeliveryDiagnosticsPayload,
  type PreviewSavedTag,
} from './tag-preview-content';

interface TagSnippetPanelProps {
  tag: PreviewSavedTag;
  campaignDsp: string;
  diagnostics: DeliveryDiagnosticsPayload | null;
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
  const snippetOptions = useMemo(
    () => getSnippetOptions(tag.format, tag.trackerType ?? null, campaignDsp),
    [campaignDsp, tag.format, tag.trackerType],
  );
  const snippets = useMemo(() => buildTagPreviewSnippets(tag, campaignDsp, diagnostics), [campaignDsp, diagnostics, tag]);
  const activeSnippet = snippets[snippetVariant as TagExportMode] ?? '';
  const dspMacroSpec = useMemo(() => buildTagMacroSpec(campaignDsp), [campaignDsp]);

  return (
    <div className="space-y-4">
      <Panel className="p-6">
        <div className="space-y-3">
          <div>
            <Kicker>Snippet</Kicker>
            <h2 className="mt-2 text-base font-semibold text-[color:var(--dusk-text-primary)]">Generated Tag Snippet</h2>
          </div>
          <p className="text-xs text-[color:var(--dusk-text-secondary)]">
            {getSnippetHelpText(tag, snippetVariant, campaignDsp)}
          </p>
          {!isBaseUrlValid && (
            <Panel className="border-[color:var(--dusk-status-warning-border)] bg-[color:var(--dusk-status-warning-bg)] p-3 text-xs text-[color:var(--dusk-status-warning-fg)]">
              <div className="flex items-start gap-2">
                <Badge tone="warning" size="sm">Warning</Badge>
                <p>
                  Serving base URL is not configured. Set <code>VITE_TAGS_BASE_URL</code> in your environment before copying this snippet.
                </p>
              </div>
            </Panel>
          )}
        </div>
      </Panel>

      <TagSnippetBlock
        snippets={snippets}
        defaultMode={snippetVariant as TagExportMode}
        onModeChange={(mode) => setSnippetVariant(mode as SnippetVariant)}
        onCopy={() => {
          setCopied(true);
          window.setTimeout(() => setCopied(false), 2000);
        }}
        actions={copied ? <Badge tone="success">Copied</Badge> : null}
      />

      {dspMacroSpec && activeSnippet ? (
        <details className="group rounded-xl border border-[color:var(--dusk-border-default)] bg-[color:var(--dusk-surface-elevated)] p-4">
          <summary className="flex cursor-pointer list-none items-start justify-between gap-4">
            <div>
              <Kicker>Macros</Kicker>
              <h2 className="mt-2 text-base font-semibold text-[color:var(--dusk-text-primary)]">Macro resolver</h2>
              <p className="mt-1 text-xs text-[color:var(--dusk-text-secondary)]">
                Open this only when you need to audit DSP macro expansion and passthrough values.
              </p>
            </div>
            <span className="text-[color:var(--dusk-text-tertiary)] transition-transform group-open:rotate-180">▾</span>
          </summary>
          <div className="mt-4">
            <MacroResolver
              tag={activeSnippet}
              spec={dspMacroSpec}
            />
          </div>
        </details>
      ) : null}
    </div>
  );
}
