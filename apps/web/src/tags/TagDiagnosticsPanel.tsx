import React from 'react';
import { Badge, Button, Kicker, Panel } from '../system';
import type { BadgeTone } from '../system';

type TagFormat = 'VAST' | 'display' | 'native' | 'tracker';

interface SavedTag {
  format: TagFormat;
}

interface DeliveryDiagnosticEntry {
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
  } | null;
  staticProfileStatus?: Record<string, {
    publicUrl?: string | null;
    storageKey?: string | null;
    available?: boolean;
    lastPublishedAt?: string | null;
    contentLength?: number | null;
    contentType?: string | null;
    etag?: string | null;
  }> | null;
  staticManifest?: {
    generatedAt?: string | null;
    trigger?: string | null;
    previousTrigger?: string | null;
    profileCount?: number | null;
    history?: Array<{
      generatedAt?: string | null;
      trigger?: string | null;
      profileCount?: number | null;
      profiles?: Array<{
        profile?: string | null;
        dsp?: string | null;
        xmlVersion?: string | null;
      }> | null;
    }> | null;
  } | null;
  staticJob?: {
    status?: string | null;
    attempts?: number | null;
    maxAttempts?: number | null;
    trigger?: string | null;
    updatedAt?: string | null;
    runAt?: string | null;
    error?: string | null;
  } | null;
}

interface DeliveryDiagnosticsPayload {
  dsp?: {
    selected?: string | null;
  } | null;
  deliverySummary?: {
    deliveryMode?: string | null;
    previewStatus?: string | null;
  } | null;
  deliveryDiagnostics?: {
    displayWrapper?: DeliveryDiagnosticEntry;
    vast?: DeliveryDiagnosticEntry;
    trackerClick?: DeliveryDiagnosticEntry;
    trackerImpression?: DeliveryDiagnosticEntry;
  } | null;
}

interface StaticDeliveryEntry {
  key: string;
  label: string;
  url?: string | null;
  status?: {
    available?: boolean;
    lastPublishedAt?: string | null;
    contentLength?: number | null;
    contentType?: string | null;
  } | null;
}

interface TagDiagnosticsPanelProps {
  savedTag: SavedTag;
  selectedCampaignDsp: string;
  deliveryDiagnostics: DeliveryDiagnosticsPayload | null;
  deliveryDiagnosticsLoading: boolean;
  basisNativeEnabled: boolean;
  dspVideoEnabled: boolean;
  basisFallbackActive: boolean;
  basisDiagnosticPath: string;
  staticDeliveryEntries: StaticDeliveryEntry[];
  copiedStaticProfile: string | null;
  queueingStaticDelivery: boolean;
  republishingStaticDelivery: boolean;
  onCopyStaticProfile: (profileKey: string, url?: string | null) => void;
  onDownloadStaticProfile: (profileKey: string, url?: string | null) => void;
  onDownloadAllStaticProfiles: () => void;
  onQueueStaticDelivery: () => void;
  onRepublishStaticDelivery: () => void;
}

function getMeasurementPathTone(value?: string | null): string {
  const path = String(value ?? '').toLowerCase();
  if (!path) return 'border-[color:var(--dusk-border-default)] bg-[color:var(--dusk-surface-muted)] text-[color:var(--dusk-text-secondary)]';
  if (path.includes('fallback')) return 'bg-amber-50 text-amber-700 border-amber-200';
  if (path.includes('basis')) return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  return 'border-[color:var(--dusk-border-default)] bg-[color:var(--dusk-surface-muted)] text-[color:var(--dusk-text-secondary)]';
}

function formatArtifactTimestamp(value?: string | null): string {
  if (!value) return 'n/a';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'n/a';
  return parsed.toLocaleString();
}

function formatArtifactBytes(value?: number | null): string {
  const size = Number(value ?? 0);
  if (!Number.isFinite(size) || size <= 0) return 'n/a';
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(2)} MB`;
}

function formatTriggerLabel(value?: string | null): string {
  if (!value) return 'n/a';
  return String(value)
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function getJobStatusTone(value?: string | null): BadgeTone {
  switch (String(value ?? '').toLowerCase()) {
    case 'running':
      return 'info';
    case 'pending':
      return 'warning';
    case 'completed':
      return 'success';
    case 'failed':
      return 'critical';
    default:
      return 'neutral';
  }
}

export default function TagDiagnosticsPanel({
  savedTag,
  selectedCampaignDsp,
  deliveryDiagnostics,
  deliveryDiagnosticsLoading,
  basisNativeEnabled,
  dspVideoEnabled,
  basisFallbackActive,
  basisDiagnosticPath,
  staticDeliveryEntries,
  copiedStaticProfile,
  queueingStaticDelivery,
  republishingStaticDelivery,
  onCopyStaticProfile,
  onDownloadStaticProfile,
  onDownloadAllStaticProfiles,
  onQueueStaticDelivery,
  onRepublishStaticDelivery,
}: TagDiagnosticsPanelProps) {
  const deliveryDiagnosticSections = [
    { label: 'Display Wrapper', entry: deliveryDiagnostics?.deliveryDiagnostics?.displayWrapper },
    { label: 'VAST', entry: deliveryDiagnostics?.deliveryDiagnostics?.vast },
    { label: 'Tracker Click', entry: deliveryDiagnostics?.deliveryDiagnostics?.trackerClick },
    { label: 'Tracker Impression', entry: deliveryDiagnostics?.deliveryDiagnostics?.trackerImpression },
  ];

  return (
    <Panel className="mt-6 p-6">
      <Kicker>Diagnostics</Kicker>
      <details className="group rounded-lg border border-[color:var(--dusk-border-default)] px-4 py-3">
        <summary className="flex cursor-pointer list-none items-start justify-between gap-3">
          <div>
            <h2 className="mt-2 text-base font-semibold text-[color:var(--dusk-text-primary)]">Delivery Diagnostics</h2>
            <p className="text-sm text-[color:var(--dusk-text-secondary)]">
              Inspect the effective Basis/SMX delivery policy and generated URLs for this tag.
            </p>
          </div>
          <div className="flex items-center gap-3">
            {deliveryDiagnosticsLoading && <span className="text-xs text-[color:var(--dusk-text-secondary)]">Loading…</span>}
            <span className="text-[color:var(--dusk-text-tertiary)] transition-transform group-open:rotate-180">▾</span>
          </div>
        </summary>

        <div className="mt-4">
          <div className="mb-4 rounded-lg border border-[color:var(--dusk-border-default)] bg-[color:var(--dusk-surface-muted)] px-4 py-3 text-sm text-[color:var(--dusk-text-secondary)]">
            <span className="font-medium text-[color:var(--dusk-text-primary)]">DSP:</span>{' '}
            {deliveryDiagnostics?.dsp?.selected || selectedCampaignDsp || 'none'}
          </div>

          <div className="mb-4 grid gap-3 md:grid-cols-3">
            <div className="rounded-lg border border-[color:var(--dusk-border-default)] bg-[color:var(--dusk-surface-muted)] px-4 py-3">
              <div className="text-xs font-medium uppercase tracking-wide text-[color:var(--dusk-text-tertiary)]">Delivery Mode</div>
              <div className="mt-1 text-sm font-semibold text-[color:var(--dusk-text-primary)]">
                {deliveryDiagnostics?.deliverySummary?.deliveryMode === 'basis_native'
                  ? 'Basis Native'
                  : deliveryDiagnostics?.deliverySummary?.deliveryMode === 'dsp_video_contract'
                    ? 'DSP Video Contract'
                    : deliveryDiagnostics?.deliverySummary?.deliveryMode === 'smx_standard'
                      ? 'SMX Standard'
                      : basisNativeEnabled ? 'Basis Native' : dspVideoEnabled ? 'DSP Video Contract' : 'SMX Standard'}
              </div>
            </div>
            <div className="rounded-lg border border-[color:var(--dusk-border-default)] bg-[color:var(--dusk-surface-muted)] px-4 py-3">
              <div className="text-xs font-medium uppercase tracking-wide text-[color:var(--dusk-text-tertiary)]">Preview Status</div>
              <div className="mt-1 text-sm font-semibold text-[color:var(--dusk-text-primary)]">
                {deliveryDiagnostics?.deliverySummary?.previewStatus === 'basis_preview_may_fallback'
                  ? 'Fallback Possible'
                  : deliveryDiagnostics?.deliverySummary?.previewStatus === 'dsp_video_contract_ready'
                    ? 'DSP Video Ready'
                    : basisFallbackActive
                      ? 'Fallback Possible'
                      : basisNativeEnabled ? 'Basis First-Hop Ready' : dspVideoEnabled ? 'DSP Video Ready' : 'Standard Delivery'}
              </div>
            </div>
            <div className="rounded-lg border border-[color:var(--dusk-border-default)] bg-[color:var(--dusk-surface-muted)] px-4 py-3">
              <div className="text-xs font-medium uppercase tracking-wide text-[color:var(--dusk-text-tertiary)]">Measurement Path</div>
              <div className="mt-2">
                <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${getMeasurementPathTone(basisDiagnosticPath)}`}>
                  {basisDiagnosticPath || 'n/a'}
                </span>
              </div>
            </div>
          </div>

          {savedTag.format === 'VAST' && deliveryDiagnostics?.deliveryDiagnostics?.vast?.staticProfiles && (
            <details className="mb-4 rounded-lg border border-[color:var(--dusk-status-success-border)] bg-[color:var(--dusk-status-success-bg)] p-4">
              <summary className="flex cursor-pointer list-none items-start justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-[color:var(--dusk-status-success-fg)]">Static Delivery URLs</h3>
                  <p className="text-xs text-[color:var(--dusk-status-success-fg)]">
                    Public XML artifacts served from storage for DSP delivery and validator-safe testing.
                  </p>
                </div>
                <span className="text-[color:var(--dusk-status-success-fg)]">▾</span>
              </summary>
              <div className="mt-3">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                  <div className="text-xs text-[color:var(--dusk-status-success-fg)]">
                    Copy each profile independently or download all XMLs in one shot.
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      type="button"
                      onClick={onDownloadAllStaticProfiles}
                      disabled={!staticDeliveryEntries.length}
                      size="sm"
                      variant="secondary"
                    >
                      Download All XMLs
                    </Button>
                    <Button
                      type="button"
                      onClick={onQueueStaticDelivery}
                      disabled={queueingStaticDelivery}
                      size="sm"
                      variant="secondary"
                    >
                      {queueingStaticDelivery ? 'Queueing…' : 'Queue Background Publish'}
                    </Button>
                    <Button
                      type="button"
                      onClick={onRepublishStaticDelivery}
                      disabled={republishingStaticDelivery}
                      size="sm"
                      variant="secondary"
                    >
                      {republishingStaticDelivery ? 'Republishing…' : 'Republish Static Delivery'}
                    </Button>
                  </div>
                </div>
                <div className="space-y-3">
                  {deliveryDiagnostics.deliveryDiagnostics.vast.staticManifest && (
                    <div className="rounded-lg border border-[color:var(--dusk-status-success-border)] bg-[color:var(--dusk-status-success-bg)]/80 px-3 py-3 text-[11px] text-[color:var(--dusk-status-success-fg)]">
                      {deliveryDiagnostics.deliveryDiagnostics.vast.staticJob && (
                        <div className="mb-3 rounded-md border border-[color:var(--dusk-status-success-border)] bg-[color:var(--dusk-status-success-bg)]/50 px-2.5 py-2">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="font-medium">Latest Static Publish Job</div>
                            <Badge tone={getJobStatusTone(deliveryDiagnostics.deliveryDiagnostics.vast.staticJob.status)} size="sm">
                              {deliveryDiagnostics.deliveryDiagnostics.vast.staticJob.status || 'unknown'}
                            </Badge>
                          </div>
                          <div className="mt-2 grid gap-2 md:grid-cols-4">
                            <div>
                              <div className="font-medium">Trigger</div>
                              <div className="mt-1">{formatTriggerLabel(deliveryDiagnostics.deliveryDiagnostics.vast.staticJob.trigger)}</div>
                            </div>
                            <div>
                              <div className="font-medium">Attempts</div>
                              <div className="mt-1">
                                {deliveryDiagnostics.deliveryDiagnostics.vast.staticJob.attempts ?? 0}
                                {deliveryDiagnostics.deliveryDiagnostics.vast.staticJob.maxAttempts
                                  ? ` / ${deliveryDiagnostics.deliveryDiagnostics.vast.staticJob.maxAttempts}`
                                  : ''}
                              </div>
                            </div>
                            <div>
                              <div className="font-medium">Updated</div>
                              <div className="mt-1">{formatArtifactTimestamp(deliveryDiagnostics.deliveryDiagnostics.vast.staticJob.updatedAt)}</div>
                            </div>
                            <div>
                              <div className="font-medium">Run At</div>
                              <div className="mt-1">{formatArtifactTimestamp(deliveryDiagnostics.deliveryDiagnostics.vast.staticJob.runAt)}</div>
                            </div>
                          </div>
                          {deliveryDiagnostics.deliveryDiagnostics.vast.staticJob.error && (
                            <div className="mt-2 rounded-md border border-[color:var(--dusk-status-critical-border)] bg-[color:var(--dusk-status-critical-bg)] px-2.5 py-2 text-[color:var(--dusk-status-critical-fg)]">
                              {deliveryDiagnostics.deliveryDiagnostics.vast.staticJob.error}
                            </div>
                          )}
                        </div>
                      )}
                      <div className="grid gap-2 md:grid-cols-4">
                        <div>
                          <div className="font-medium">Last Trigger</div>
                          <div className="mt-1">{formatTriggerLabel(deliveryDiagnostics.deliveryDiagnostics.vast.staticManifest.trigger)}</div>
                        </div>
                        <div>
                          <div className="font-medium">Generated At</div>
                          <div className="mt-1">{formatArtifactTimestamp(deliveryDiagnostics.deliveryDiagnostics.vast.staticManifest.generatedAt)}</div>
                        </div>
                        <div>
                          <div className="font-medium">Previous Trigger</div>
                          <div className="mt-1">{formatTriggerLabel(deliveryDiagnostics.deliveryDiagnostics.vast.staticManifest.previousTrigger)}</div>
                        </div>
                        <div>
                          <div className="font-medium">Profiles Published</div>
                          <div className="mt-1">{deliveryDiagnostics.deliveryDiagnostics.vast.staticManifest.profileCount ?? 0}</div>
                        </div>
                      </div>
                      {deliveryDiagnostics.deliveryDiagnostics.vast.staticManifest.history && deliveryDiagnostics.deliveryDiagnostics.vast.staticManifest.history.length > 0 && (
                        <div className="mt-3 border-t border-[color:var(--dusk-status-success-border)] pt-3">
                          <div className="mb-2 font-medium">Recent Publish History</div>
                          <div className="space-y-2">
                            {deliveryDiagnostics.deliveryDiagnostics.vast.staticManifest.history.slice(0, 5).map((entry, index) => (
                              <div key={`${entry.generatedAt ?? 'entry'}-${index}`} className="rounded-md border border-[color:var(--dusk-status-success-border)] bg-[color:var(--dusk-status-success-bg)]/40 px-2.5 py-2">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <div className="font-medium">{formatTriggerLabel(entry.trigger)}</div>
                                  <div>{formatArtifactTimestamp(entry.generatedAt)}</div>
                                </div>
                                <div className="mt-1 text-[color:var(--dusk-status-success-fg)]">
                                  Profiles: {entry.profileCount ?? 0}
                                  {Array.isArray(entry.profiles) && entry.profiles.length > 0
                                    ? ` • ${entry.profiles.map((profile) => `${profile.profile ?? 'unknown'} (${profile.xmlVersion ?? 'n/a'})`).join(', ')}`
                                    : ''}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  {staticDeliveryEntries.map((entry) => (
                    <div key={entry.key}>
                      <div className="mb-1 flex items-center justify-between gap-3">
                        <div className="text-xs font-medium text-emerald-900">{entry.label}</div>
                        <div className="flex flex-wrap items-center justify-end gap-2">
                          <Button
                            size="sm"
                            variant="secondary"
                            type="button"
                            onClick={() => onCopyStaticProfile(entry.key, entry.url)}
                          >
                            {copiedStaticProfile === entry.key ? 'Copied' : 'Copy URL'}
                          </Button>
                          <Button
                            type="button"
                            onClick={() => onDownloadStaticProfile(entry.key, entry.url)}
                            size="sm"
                            variant="ghost"
                          >
                            Download XML
                          </Button>
                          <Badge tone={entry.status?.available ? 'success' : 'warning'} size="sm">
                            {entry.status?.available ? 'Available' : 'Pending'}
                          </Badge>
                        </div>
                      </div>
                      <pre className="bg-slate-900 text-slate-100 text-xs p-3 rounded-lg overflow-x-auto whitespace-pre-wrap font-mono">{entry.url}</pre>
                      <div className="mt-2 grid gap-2 md:grid-cols-3 text-[11px] text-emerald-900">
                        <div className="rounded-md border border-[color:var(--dusk-status-success-border)] bg-[color:var(--dusk-status-success-bg)]/80 px-2.5 py-2">
                          <div className="font-medium">Last Published</div>
                          <div className="mt-1">{formatArtifactTimestamp(entry.status?.lastPublishedAt)}</div>
                        </div>
                        <div className="rounded-md border border-[color:var(--dusk-status-success-border)] bg-[color:var(--dusk-status-success-bg)]/80 px-2.5 py-2">
                          <div className="font-medium">Artifact Size</div>
                          <div className="mt-1">{formatArtifactBytes(entry.status?.contentLength)}</div>
                        </div>
                        <div className="rounded-md border border-[color:var(--dusk-status-success-border)] bg-[color:var(--dusk-status-success-bg)]/80 px-2.5 py-2">
                          <div className="font-medium">Content Type</div>
                          <div className="mt-1">{entry.status?.contentType || 'n/a'}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </details>
          )}
          {savedTag.format === 'VAST' && !deliveryDiagnostics?.deliveryDiagnostics?.vast?.staticProfiles && (
            <details className="mb-4 rounded-lg border border-[color:var(--dusk-status-success-border)] bg-[color:var(--dusk-status-success-bg)] p-4">
              <summary className="flex cursor-pointer list-none items-start justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-[color:var(--dusk-status-success-fg)]">Static Delivery URLs</h3>
                  <p className="text-xs text-[color:var(--dusk-status-success-fg)]">
                    Public XML artifacts served from storage for DSP delivery and validator-safe testing.
                  </p>
                </div>
                <span className="text-[color:var(--dusk-status-success-fg)]">▾</span>
              </summary>
              <div className="mt-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-xs text-[color:var(--dusk-status-success-fg)]">
                    No static delivery artifacts are visible yet. Republish to generate or refresh the public XML profiles.
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      type="button"
                      onClick={onQueueStaticDelivery}
                      disabled={queueingStaticDelivery}
                      size="sm"
                      variant="secondary"
                    >
                      {queueingStaticDelivery ? 'Queueing…' : 'Queue Background Publish'}
                    </Button>
                    <Button
                      type="button"
                      onClick={onRepublishStaticDelivery}
                      disabled={republishingStaticDelivery}
                      size="sm"
                      variant="secondary"
                    >
                      {republishingStaticDelivery ? 'Republishing…' : 'Republish Static Delivery'}
                    </Button>
                  </div>
                </div>
              </div>
            </details>
          )}

          <div className="space-y-4">
            {deliveryDiagnosticSections.map(section => (
              <details key={section.label} className="rounded-lg border border-[color:var(--dusk-border-default)] px-4 py-3">
                <summary className="cursor-pointer text-sm font-medium text-[color:var(--dusk-text-primary)]">{section.label}</summary>
                <div className="mt-3 space-y-3">
                  <div className="grid gap-3 md:grid-cols-3 text-xs">
                    <div className="rounded-md bg-[color:var(--dusk-surface-muted)] px-3 py-2">
                      <div className="text-[color:var(--dusk-text-secondary)]">Measurement Path</div>
                      <div className="mt-1 font-medium text-[color:var(--dusk-text-primary)]">{section.entry?.policy?.measurementPath ?? 'n/a'}</div>
                    </div>
                    <div className="rounded-md bg-[color:var(--dusk-surface-muted)] px-3 py-2">
                      <div className="text-[color:var(--dusk-text-secondary)]">DSP Hint</div>
                      <div className="mt-1 font-medium text-[color:var(--dusk-text-primary)]">{section.entry?.policy?.includeDspHint ? 'enabled' : 'disabled'}</div>
                    </div>
                    <div className="rounded-md bg-[color:var(--dusk-surface-muted)] px-3 py-2">
                      <div className="text-[color:var(--dusk-text-secondary)]">Click Macro</div>
                      <div className="mt-1 font-medium text-[color:var(--dusk-text-primary)]">{section.entry?.policy?.includeClickMacro ? 'enabled' : 'disabled'}</div>
                    </div>
                  </div>

                  {section.entry?.jsUrl && (
                    <div>
                      <div className="mb-1 text-xs font-medium text-[color:var(--dusk-text-secondary)]">JS URL</div>
                      <pre className="bg-slate-900 text-slate-100 text-xs p-3 rounded-lg overflow-x-auto whitespace-pre-wrap font-mono">{section.entry.jsUrl}</pre>
                    </div>
                  )}
                  {section.entry?.htmlUrl && (
                    <div>
                      <div className="mb-1 text-xs font-medium text-[color:var(--dusk-text-secondary)]">HTML URL</div>
                      <pre className="bg-slate-900 text-slate-100 text-xs p-3 rounded-lg overflow-x-auto whitespace-pre-wrap font-mono">{section.entry.htmlUrl}</pre>
                    </div>
                  )}
                  {section.entry?.url && (
                    <div>
                      <div className="mb-1 text-xs font-medium text-[color:var(--dusk-text-secondary)]">URL</div>
                      <pre className="bg-slate-900 text-slate-100 text-xs p-3 rounded-lg overflow-x-auto whitespace-pre-wrap font-mono">{section.entry.url}</pre>
                    </div>
                  )}
                </div>
              </details>
            ))}
          </div>
        </div>
      </details>
    </Panel>
  );
}
