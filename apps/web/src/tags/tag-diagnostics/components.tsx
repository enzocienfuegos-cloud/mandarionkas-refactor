import React from 'react';
import { Badge, Button } from '../../system';
import type { BadgeTone } from '../../system';

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

export interface StaticDeliveryEntry {
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

export function StaticDeliverySection({
  vastEntry,
  staticDeliveryEntries,
  copiedStaticProfile,
  queueingStaticDelivery,
  republishingStaticDelivery,
  onCopyStaticProfile,
  onDownloadStaticProfile,
  onDownloadAllStaticProfiles,
  onQueueStaticDelivery,
  onRepublishStaticDelivery,
}: {
  vastEntry?: DeliveryDiagnosticEntry;
  staticDeliveryEntries: StaticDeliveryEntry[];
  copiedStaticProfile: string | null;
  queueingStaticDelivery: boolean;
  republishingStaticDelivery: boolean;
  onCopyStaticProfile: (profileKey: string, url?: string | null) => void;
  onDownloadStaticProfile: (profileKey: string, url?: string | null) => void;
  onDownloadAllStaticProfiles: () => void;
  onQueueStaticDelivery: () => void;
  onRepublishStaticDelivery: () => void;
}) {
  if (!vastEntry?.staticProfiles) {
    return (
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
              <Button type="button" onClick={onQueueStaticDelivery} disabled={queueingStaticDelivery} size="sm" variant="secondary">
                {queueingStaticDelivery ? 'Queueing…' : 'Queue Background Publish'}
              </Button>
              <Button type="button" onClick={onRepublishStaticDelivery} disabled={republishingStaticDelivery} size="sm" variant="secondary">
                {republishingStaticDelivery ? 'Republishing…' : 'Republish Static Delivery'}
              </Button>
            </div>
          </div>
        </div>
      </details>
    );
  }

  return (
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
            <Button type="button" onClick={onDownloadAllStaticProfiles} disabled={!staticDeliveryEntries.length} size="sm" variant="secondary">
              Download All XMLs
            </Button>
            <Button type="button" onClick={onQueueStaticDelivery} disabled={queueingStaticDelivery} size="sm" variant="secondary">
              {queueingStaticDelivery ? 'Queueing…' : 'Queue Background Publish'}
            </Button>
            <Button type="button" onClick={onRepublishStaticDelivery} disabled={republishingStaticDelivery} size="sm" variant="secondary">
              {republishingStaticDelivery ? 'Republishing…' : 'Republish Static Delivery'}
            </Button>
          </div>
        </div>
        <div className="space-y-3">
          {vastEntry.staticManifest && (
            <div className="rounded-lg border border-[color:var(--dusk-status-success-border)] bg-[color:var(--dusk-status-success-bg)]/80 px-3 py-3 text-[11px] text-[color:var(--dusk-status-success-fg)]">
              {vastEntry.staticJob && (
                <div className="mb-3 rounded-md border border-[color:var(--dusk-status-success-border)] bg-[color:var(--dusk-status-success-bg)]/50 px-2.5 py-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="font-medium">Latest Static Publish Job</div>
                    <Badge tone={getJobStatusTone(vastEntry.staticJob.status)} size="sm">
                      {vastEntry.staticJob.status || 'unknown'}
                    </Badge>
                  </div>
                  <div className="mt-2 grid gap-2 md:grid-cols-4">
                    <div><div className="font-medium">Trigger</div><div className="mt-1">{formatTriggerLabel(vastEntry.staticJob.trigger)}</div></div>
                    <div><div className="font-medium">Attempts</div><div className="mt-1">{vastEntry.staticJob.attempts ?? 0}{vastEntry.staticJob.maxAttempts ? ` / ${vastEntry.staticJob.maxAttempts}` : ''}</div></div>
                    <div><div className="font-medium">Updated</div><div className="mt-1">{formatArtifactTimestamp(vastEntry.staticJob.updatedAt)}</div></div>
                    <div><div className="font-medium">Run At</div><div className="mt-1">{formatArtifactTimestamp(vastEntry.staticJob.runAt)}</div></div>
                  </div>
                  {vastEntry.staticJob.error && (
                    <div className="mt-2 rounded-md border border-[color:var(--dusk-status-critical-border)] bg-[color:var(--dusk-status-critical-bg)] px-2.5 py-2 text-[color:var(--dusk-status-critical-fg)]">
                      {vastEntry.staticJob.error}
                    </div>
                  )}
                </div>
              )}
              <div className="grid gap-2 md:grid-cols-4">
                <div><div className="font-medium">Last Trigger</div><div className="mt-1">{formatTriggerLabel(vastEntry.staticManifest.trigger)}</div></div>
                <div><div className="font-medium">Generated At</div><div className="mt-1">{formatArtifactTimestamp(vastEntry.staticManifest.generatedAt)}</div></div>
                <div><div className="font-medium">Previous Trigger</div><div className="mt-1">{formatTriggerLabel(vastEntry.staticManifest.previousTrigger)}</div></div>
                <div><div className="font-medium">Profiles Published</div><div className="mt-1">{vastEntry.staticManifest.profileCount ?? 0}</div></div>
              </div>
              {vastEntry.staticManifest.history && vastEntry.staticManifest.history.length > 0 && (
                <div className="mt-3 border-t border-[color:var(--dusk-status-success-border)] pt-3">
                  <div className="mb-2 font-medium">Recent Publish History</div>
                  <div className="space-y-2">
                    {vastEntry.staticManifest.history.slice(0, 5).map((entry, index) => (
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
                  <Button size="sm" variant="secondary" type="button" onClick={() => onCopyStaticProfile(entry.key, entry.url)}>
                    {copiedStaticProfile === entry.key ? 'Copied' : 'Copy URL'}
                  </Button>
                  <Button type="button" onClick={() => onDownloadStaticProfile(entry.key, entry.url)} size="sm" variant="ghost">
                    Download XML
                  </Button>
                  <Badge tone={entry.status?.available ? 'success' : 'warning'} size="sm">
                    {entry.status?.available ? 'Available' : 'Pending'}
                  </Badge>
                </div>
              </div>
              <pre className="overflow-x-auto whitespace-pre-wrap rounded-lg bg-slate-900 p-3 font-mono text-xs text-slate-100">{entry.url}</pre>
              <div className="mt-2 grid gap-2 text-[11px] text-emerald-900 md:grid-cols-3">
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
  );
}

export function DeliveryDiagnosticSection({
  label,
  entry,
  measurementPathTone,
}: {
  label: string;
  entry?: DeliveryDiagnosticEntry;
  measurementPathTone: (value?: string | null) => string;
}) {
  return (
    <details className="rounded-lg border border-[color:var(--dusk-border-default)] px-4 py-3">
      <summary className="cursor-pointer text-sm font-medium text-[color:var(--dusk-text-primary)]">{label}</summary>
      <div className="mt-3 space-y-3">
        <div className="grid gap-3 text-xs md:grid-cols-3">
          <div className="rounded-md bg-[color:var(--dusk-surface-muted)] px-3 py-2">
            <div className="text-[color:var(--dusk-text-secondary)]">Measurement Path</div>
            <div className="mt-2">
              <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${measurementPathTone(entry?.policy?.measurementPath)}`}>
                {entry?.policy?.measurementPath ?? 'n/a'}
              </span>
            </div>
          </div>
          <div className="rounded-md bg-[color:var(--dusk-surface-muted)] px-3 py-2">
            <div className="text-[color:var(--dusk-text-secondary)]">DSP Hint</div>
            <div className="mt-1 font-medium text-[color:var(--dusk-text-primary)]">{entry?.policy?.includeDspHint ? 'enabled' : 'disabled'}</div>
          </div>
          <div className="rounded-md bg-[color:var(--dusk-surface-muted)] px-3 py-2">
            <div className="text-[color:var(--dusk-text-secondary)]">Click Macro</div>
            <div className="mt-1 font-medium text-[color:var(--dusk-text-primary)]">{entry?.policy?.includeClickMacro ? 'enabled' : 'disabled'}</div>
          </div>
        </div>

        {entry?.jsUrl && (
          <div>
            <div className="mb-1 text-xs font-medium text-[color:var(--dusk-text-secondary)]">JS URL</div>
            <pre className="overflow-x-auto whitespace-pre-wrap rounded-lg bg-slate-900 p-3 font-mono text-xs text-slate-100">{entry.jsUrl}</pre>
          </div>
        )}
        {entry?.htmlUrl && (
          <div>
            <div className="mb-1 text-xs font-medium text-[color:var(--dusk-text-secondary)]">HTML URL</div>
            <pre className="overflow-x-auto whitespace-pre-wrap rounded-lg bg-slate-900 p-3 font-mono text-xs text-slate-100">{entry.htmlUrl}</pre>
          </div>
        )}
        {entry?.url && (
          <div>
            <div className="mb-1 text-xs font-medium text-[color:var(--dusk-text-secondary)]">URL</div>
            <pre className="overflow-x-auto whitespace-pre-wrap rounded-lg bg-slate-900 p-3 font-mono text-xs text-slate-100">{entry.url}</pre>
          </div>
        )}
      </div>
    </details>
  );
}
