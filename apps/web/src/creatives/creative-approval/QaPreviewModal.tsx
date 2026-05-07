import React from 'react';
import type { CreativeArtifact } from '../catalog';
import { Button, CenteredSpinner, Modal, Panel } from '../../system';
import { ExternalLink } from '../../system/icons';
import type { QaState } from './types';
import {
  formatBitRate,
  formatBytes,
  formatDuration,
  getPosterArtifact,
  getVideoMetadata,
  getVideoProcessingState,
  readinessChecks,
} from './utils';

function InfoCard({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-[color:var(--dusk-border-default)] bg-surface-2 p-3">
      <p className="text-xs uppercase tracking-wide text-[color:var(--dusk-text-muted)]">{label}</p>
      <p className="mt-1 text-sm font-medium text-[color:var(--dusk-text-primary)]">{value}</p>
    </div>
  );
}

function ArtifactRow({ artifact }: { artifact: CreativeArtifact }) {
  return (
    <div className="rounded-lg border border-[color:var(--dusk-border-default)] px-3 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-medium text-[color:var(--dusk-text-primary)]">{artifact.kind}</div>
          <div className="mt-1 text-xs text-[color:var(--dusk-text-muted)]">
            {artifact.mimeType || 'unknown mime'} · {formatBytes(artifact.sizeBytes)}
          </div>
        </div>
        {artifact.publicUrl && (
          <a
            href={artifact.publicUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-8 items-center justify-center gap-1.5 rounded-md border border-[color:var(--dusk-border-default)] bg-surface-1 px-3 text-xs font-medium text-[color:var(--dusk-text-secondary)] transition hover:border-[color:var(--dusk-border-strong)] hover:bg-surface-hover hover:text-[color:var(--dusk-text-primary)]"
          >
            <ExternalLink className="h-4 w-4" />
            Open
          </a>
        )}
      </div>
    </div>
  );
}

export function QaPreviewModal({ qaState, onClose }: { qaState: QaState; onClose: () => void }) {
  return (
    <Modal
      open
      onClose={onClose}
      title="Creative QA Preview"
      description="Review artifact quality and readiness before approving."
      size="xl"
      footer={<Button variant="secondary" onClick={onClose}>Close</Button>}
    >
      <div className="grid gap-0 lg:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.9fr)]">
        <div className="min-h-[420px] border-b border-[color:var(--dusk-border-subtle)] bg-[color:var(--dusk-surface-muted)] lg:border-b-0 lg:border-r">
          {qaState.loading ? (
            <div className="flex h-full min-h-[420px] items-center justify-center text-text-primary">
              <CenteredSpinner label="Loading QA detail…" />
            </div>
          ) : qaState.error ? (
            <Panel className="m-6 border-[color:var(--dusk-status-critical-border)] bg-[color:var(--dusk-status-critical-bg)] p-4 text-sm text-[color:var(--dusk-status-critical-fg)]" role="alert">
              {qaState.error}
            </Panel>
          ) : qaState.version?.servingFormat === 'vast_video' ? (
            <div className="flex h-full min-h-[420px] items-center justify-center p-6">
              <div className="w-full max-w-3xl space-y-4">
                {getPosterArtifact(qaState.artifacts)?.publicUrl && (
                  <img
                    src={getPosterArtifact(qaState.artifacts)?.publicUrl}
                    alt="Generated poster preview"
                    className="max-h-52 w-full rounded-lg object-contain"
                  />
                )}
                <video
                  controls
                  poster={getPosterArtifact(qaState.artifacts)?.publicUrl || undefined}
                  className="max-h-[60vh] max-w-full rounded-lg bg-black shadow-lg"
                  src={qaState.version.publicUrl}
                />
              </div>
            </div>
          ) : qaState.version?.publicUrl ? (
            <iframe
              title={`QA preview ${qaState.version.creativeName ?? qaState.version.creativeId}`}
              src={qaState.version.publicUrl}
              className="h-[70vh] min-h-[420px] w-full bg-surface-1"
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
            />
          ) : (
            <div className="flex h-full min-h-[420px] items-center justify-center p-6 text-sm text-[color:var(--dusk-text-muted)]">
              No previewable public artifact available.
            </div>
          )}
        </div>

        <div className="max-h-[70vh] overflow-y-auto p-6">
          {qaState.version && (
            <>
              {qaState.version.servingFormat === 'vast_video' && getVideoProcessingState(qaState.version) && (
                <Panel padding="md" className="mb-6">
                  <h4 className="text-sm font-semibold text-[color:var(--dusk-text-primary)]">Video processing</h4>
                  <div className="mt-3 space-y-2 text-sm text-[color:var(--dusk-text-secondary)]">
                    <div className="flex items-center justify-between">
                      <span>ffprobe</span>
                      <span className={getVideoProcessingState(qaState.version)?.ffprobeAvailable ? 'text-[color:var(--dusk-status-success-fg)]' : 'text-[color:var(--dusk-status-warning-fg)]'}>
                        {getVideoProcessingState(qaState.version)?.ffprobeAvailable ? 'Available' : (getVideoProcessingState(qaState.version)?.ffprobeReason ?? 'Unavailable')}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>ffmpeg</span>
                      <span className={getVideoProcessingState(qaState.version)?.ffmpegAvailable ? 'text-[color:var(--dusk-status-success-fg)]' : 'text-[color:var(--dusk-status-warning-fg)]'}>
                        {getVideoProcessingState(qaState.version)?.ffmpegAvailable ? 'Available' : (getVideoProcessingState(qaState.version)?.ffmpegReason ?? 'Unavailable')}
                      </span>
                    </div>
                  </div>
                  {(!getVideoProcessingState(qaState.version)?.ffprobeAvailable || !getVideoProcessingState(qaState.version)?.ffmpegAvailable) && (
                    <p className="mt-3 text-xs text-[color:var(--dusk-text-muted)]">
                      This creative is still publishable. The environment just could not extract all video diagnostics automatically.
                    </p>
                  )}
                </Panel>
              )}

              <div>
                <h3 className="text-base font-semibold text-[color:var(--dusk-text-primary)]">
                  {qaState.version.creativeName ?? qaState.version.creativeId}
                </h3>
                <div className="mt-2 grid gap-3 sm:grid-cols-2">
                  <InfoCard label="Format" value={qaState.version.servingFormat} />
                  <InfoCard label="Source" value={qaState.version.sourceKind} />
                  <InfoCard label="Dimensions" value={qaState.version.width && qaState.version.height ? `${qaState.version.width}×${qaState.version.height}` : '—'} />
                  <InfoCard label="Duration" value={formatDuration(qaState.version.durationMs)} />
                  <InfoCard label="Mime" value={qaState.version.mimeType || '—'} />
                  <InfoCard label="File size" value={formatBytes(qaState.version.fileSize)} />
                  {qaState.version.servingFormat === 'vast_video' && (
                    <>
                      <InfoCard label="Codec" value={getVideoMetadata(qaState.version).codec || '—'} />
                      <InfoCard label="Bitrate" value={formatBitRate(getVideoMetadata(qaState.version).bitRate)} />
                    </>
                  )}
                </div>
              </div>

              <div className="mt-6">
                <h4 className="text-sm font-semibold text-[color:var(--dusk-text-primary)]">Readiness checks</h4>
                <div className="mt-3 space-y-2">
                  {readinessChecks(qaState.version, qaState.artifacts).map((check) => (
                    <div key={check.label} className="flex items-center justify-between rounded-lg border border-[color:var(--dusk-border-default)] px-3 py-2 text-sm">
                      <span className="text-[color:var(--dusk-text-secondary)]">{check.label}</span>
                      <span className={check.ok ? 'text-[color:var(--dusk-status-success-fg)]' : 'text-[color:var(--dusk-status-critical-fg)]'}>
                        {check.ok ? 'Ready' : 'Missing'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-6">
                <h4 className="text-sm font-semibold text-[color:var(--dusk-text-primary)]">Artifacts</h4>
                <div className="mt-3 space-y-2">
                  {qaState.artifacts.map((artifact) => <ArtifactRow key={artifact.id} artifact={artifact} />)}
                  {qaState.artifacts.length === 0 && (
                    <div className="rounded-lg border border-dashed border-[color:var(--dusk-border-default)] bg-surface-2 px-3 py-4 text-sm text-[color:var(--dusk-text-muted)]">
                      No artifacts registered for this version yet.
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </Modal>
  );
}
