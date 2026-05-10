import React from 'react';
import { Badge, Button, Kicker, Panel, TagDiagnostics } from '../system';
import type { BadgeTone } from '../system';
import {
  type DeliveryDiagnosticEntry,
  type StaticDeliveryEntry,
  DeliveryDiagnosticSection,
  StaticDeliverySection,
} from './tag-diagnostics/components';
import {
  buildTagDiagnosticChecks,
  getDeliveryModeLabel,
  getPreviewStatusLabel,
  type DeliveryDiagnosticsPayload,
  type PreviewSavedTag,
} from './tag-preview-content';

interface TagDiagnosticsPanelProps {
  savedTag: PreviewSavedTag;
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
  if (path.includes('fallback')) return 'border-[color:var(--dusk-status-warning-border)] bg-[color:var(--dusk-status-warning-bg)] text-[color:var(--dusk-status-warning-fg)]';
  if (path.includes('basis')) return 'border-[color:var(--dusk-status-success-border)] bg-[color:var(--dusk-status-success-bg)] text-[color:var(--dusk-status-success-fg)]';
  return 'border-[color:var(--dusk-border-default)] bg-[color:var(--dusk-surface-muted)] text-[color:var(--dusk-text-secondary)]';
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
  const summaryChecks = buildTagDiagnosticChecks({
    savedTag,
    selectedCampaignDsp,
    deliveryDiagnostics,
    onRepublishStaticDelivery,
  });

  return (
    <Panel className="mt-6 p-6">
      <Kicker>Diagnostics</Kicker>
      <div className="mt-3 space-y-2">
        <h2 className="text-base font-semibold text-[color:var(--dusk-text-primary)]">System checks</h2>
        <p className="text-sm text-[color:var(--dusk-text-secondary)]">
          High-level delivery health before drilling into raw policy and URL detail.
        </p>
      </div>
      <div className="mt-4">
        <TagDiagnostics checks={summaryChecks} loading={deliveryDiagnosticsLoading} />
      </div>
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
                {deliveryModeLabel}
              </div>
            </div>
            <div className="rounded-lg border border-[color:var(--dusk-border-default)] bg-[color:var(--dusk-surface-muted)] px-4 py-3">
              <div className="text-xs font-medium uppercase tracking-wide text-[color:var(--dusk-text-tertiary)]">Preview Status</div>
              <div className="mt-1 text-sm font-semibold text-[color:var(--dusk-text-primary)]">
                {previewStatusLabel}
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

          {savedTag.format === 'VAST' && (
            <StaticDeliverySection
              vastEntry={deliveryDiagnostics?.deliveryDiagnostics?.vast}
              staticDeliveryEntries={staticDeliveryEntries}
              copiedStaticProfile={copiedStaticProfile}
              queueingStaticDelivery={queueingStaticDelivery}
              republishingStaticDelivery={republishingStaticDelivery}
              onCopyStaticProfile={onCopyStaticProfile}
              onDownloadStaticProfile={onDownloadStaticProfile}
              onDownloadAllStaticProfiles={onDownloadAllStaticProfiles}
              onQueueStaticDelivery={onQueueStaticDelivery}
              onRepublishStaticDelivery={onRepublishStaticDelivery}
            />
          )}

          <div className="space-y-4">
            {deliveryDiagnosticSections.map((section) => (
              <DeliveryDiagnosticSection
                key={section.label}
                label={section.label}
                entry={section.entry}
                measurementPathTone={getMeasurementPathTone}
              />
            ))}
          </div>
        </div>
      </details>
    </Panel>
  );
}
