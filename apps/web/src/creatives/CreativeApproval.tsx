import React, { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import {
  type CreativeVersion,
  type CreativeArtifact,
  approveCreativeVersion,
  loadCreativeVersionDetail,
  loadPendingReviewVersions,
  rejectCreativeVersion,
} from './catalog';
import { normalizePlatformRole } from '../shared/roles';
import {
  Badge,
  Button,
  CenteredSpinner,
  EmptyState,
  Kicker,
  Modal,
  Panel,
  useToast,
} from '../system';
import { CheckCircle2, ExternalLink, Eye, RefreshCw } from '../system/icons';

interface User {
  id: string;
  email: string;
  role: string;
}

interface ActionState {
  versionId: string;
  type: 'approve' | 'reject';
  notes: string;
  reason: string;
  loading: boolean;
  error: string;
}

interface QaState {
  versionId: string;
  loading: boolean;
  error: string;
  version: CreativeVersion | null;
  artifacts: CreativeArtifact[];
}

interface PreviewState {
  url: string;
  name: string;
  width: number;
  height: number;
  kind: 'html' | 'video';
}

function formatBytes(value?: number | null) {
  if (!value) return '—';
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = value;
  let unit = units[0];
  for (let index = 0; index < units.length - 1 && size >= 1024; index += 1) {
    size /= 1024;
    unit = units[index + 1];
  }
  return `${size.toFixed(size >= 10 ? 0 : 1)} ${unit}`;
}

function formatDuration(durationMs?: number | null) {
  if (!durationMs) return '—';
  const totalSeconds = Math.round(durationMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function formatBitRate(bitRate?: number | null) {
  if (!bitRate) return '—';
  if (bitRate >= 1_000_000) {
    return `${(bitRate / 1_000_000).toFixed(2)} Mbps`;
  }
  if (bitRate >= 1_000) {
    return `${(bitRate / 1_000).toFixed(0)} Kbps`;
  }
  return `${bitRate} bps`;
}

function readinessChecks(version: CreativeVersion | null, artifacts: CreativeArtifact[]) {
  return [
    {
      label: 'Public URL',
      ok: Boolean(version?.publicUrl),
    },
    {
      label: 'Previewable artifact',
      ok: artifacts.some(artifact => Boolean(artifact.publicUrl)),
    },
    {
      label: 'Metadata',
      ok: Boolean(version?.mimeType || version?.width || version?.durationMs),
    },
  ];
}

function getPosterArtifact(artifacts: CreativeArtifact[]) {
  return artifacts.find(artifact => artifact.kind === 'poster' && artifact.publicUrl) ?? null;
}

function getVideoProcessingState(version: CreativeVersion | null) {
  const processing = (version?.metadata as Record<string, any> | undefined)?.videoProcessing;
  if (!processing || typeof processing !== 'object') return null;
  return processing;
}

function getVideoMetadata(version: CreativeVersion | null) {
  const metadata = (version?.metadata as Record<string, any> | undefined) ?? {};
  return {
    codec: typeof metadata.codec === 'string' ? metadata.codec : null,
    bitRate: typeof metadata.bitRate === 'number' ? metadata.bitRate : null,
    posterGenerated: Boolean(metadata.posterGenerated),
  };
}

function resolveCreativePreviewHref(version: CreativeVersion | null | undefined) {
  const sourceKind = String(version?.sourceKind || '').trim().toLowerCase();
  const mimeType = String(version?.mimeType || '').trim().toLowerCase();
  const allowsIngestionArtifactPreview = (
    sourceKind === 'video_mp4'
    || mimeType.startsWith('video/')
  );
  const previewUrl = String(version?.previewUrl || '').trim();
  const isInvalidPreviewUrl = (value: string) => {
    const lower = value.toLowerCase();
    if (!value) return true;
    if (lower.endsWith('.zip')) return true;
    if (!allowsIngestionArtifactPreview && lower.includes('/creative-ingestions/')) return true;
    return false;
  };
  if (!isInvalidPreviewUrl(previewUrl)) return previewUrl;
  if (version?.sourceKind === 'html5_zip') return '';
  const publicUrl = String(version?.publicUrl || '').trim();
  return isInvalidPreviewUrl(publicUrl) ? '' : publicUrl;
}

function resolveCreativePreviewKind(version: CreativeVersion | null | undefined) {
  const sourceKind = String(version?.sourceKind || '').trim().toLowerCase();
  const mimeType = String(version?.mimeType || '').trim().toLowerCase();
  const previewUrl = resolveCreativePreviewHref(version).toLowerCase();
  if (
    sourceKind === 'video_mp4'
    || mimeType.startsWith('video/')
    || previewUrl.endsWith('.mp4')
    || previewUrl.endsWith('.webm')
    || previewUrl.endsWith('.mov')
  ) {
    return 'video' as const;
  }
  return 'html' as const;
}

export default function CreativeApproval() {
  const { user } = useOutletContext<{ user: User }>();
  const { toast } = useToast();
  const [versions, setVersions] = useState<CreativeVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionState, setActionState] = useState<ActionState | null>(null);
  const [qaState, setQaState] = useState<QaState | null>(null);
  const [previewState, setPreviewState] = useState<PreviewState | null>(null);
  const [processed, setProcessed] = useState<Set<string>>(new Set());

  const canAct = normalizePlatformRole(user?.role) === 'admin';

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      setVersions(await loadPendingReviewVersions());
    } catch (loadError: any) {
      setError(loadError.message ?? 'Failed to load review queue');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    if (!previewState) return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setPreviewState(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [previewState]);

  const pending = versions.filter(version => !processed.has(version.id));

  const handleAction = async () => {
    if (!actionState) return;
    setActionState(current => current ? { ...current, loading: true, error: '' } : current);
    try {
      if (actionState.type === 'approve') {
        await approveCreativeVersion(actionState.versionId, actionState.notes.trim() || undefined);
      } else {
        if (!actionState.reason.trim()) {
          throw new Error('Rejection reason is required.');
        }
        await rejectCreativeVersion(actionState.versionId, actionState.reason.trim());
      }
      setProcessed(current => new Set([...current, actionState.versionId]));
      toast({
        tone: 'success',
        title: actionState.type === 'approve' ? 'Creative approved' : 'Creative rejected',
      });
      setActionState(null);
    } catch (actionError: any) {
      toast({
        tone: 'critical',
        title: actionError.message ?? 'Action failed',
      });
      setActionState(current => current ? { ...current, loading: false, error: actionError.message ?? 'Action failed' } : current);
    }
  };

  const openQa = async (versionId: string) => {
    setQaState({
      versionId,
      loading: true,
      error: '',
      version: null,
      artifacts: [],
    });
    try {
      const detail = await loadCreativeVersionDetail(versionId);
      setQaState({
        versionId,
        loading: false,
        error: '',
        version: detail.creativeVersion,
        artifacts: detail.artifacts,
      });
    } catch (qaError: any) {
      setQaState({
        versionId,
        loading: false,
        error: qaError.message ?? 'Failed to load QA detail',
        version: null,
        artifacts: [],
      });
    }
  };

  if (loading) {
    return <CenteredSpinner label="Loading creative review queue…" />;
  }

  if (error) {
    return (
      <Panel padding="md" className="border-[color:var(--dusk-status-critical-border)]">
        <p className="font-medium text-[color:var(--dusk-status-critical-fg)]">Error loading review queue</p>
        <p className="mt-1 text-sm text-[color:var(--dusk-text-muted)]">{error}</p>
        <div className="mt-3">
          <Button variant="secondary" size="sm" onClick={() => void load()}>
            Retry
          </Button>
        </div>
      </Panel>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Kicker>Creative Approval</Kicker>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-[color:var(--dusk-text-primary)]">Creative Version Review</h1>
          <p className="mt-1 text-sm text-[color:var(--dusk-text-muted)]">{pending.length} version{pending.length !== 1 ? 's' : ''} awaiting review</p>
        </div>
        <Button variant="secondary" leadingIcon={<RefreshCw />} onClick={() => void load()}>
          Refresh
        </Button>
      </div>

      {!canAct && (
        <Panel padding="md" className="border-[color:var(--dusk-status-warning-border)] bg-[color:var(--dusk-status-warning-bg)] text-[color:var(--dusk-status-warning-fg)]">
          You have read-only access. Only admins can approve or reject versions.
        </Panel>
      )}

      {pending.length === 0 ? (
        <Panel padding="none">
          <EmptyState
            icon={<CheckCircle2 />}
            title="Queue is empty"
            description="All submitted versions have been reviewed."
          />
        </Panel>
      ) : (
        <div className="space-y-4">
          {pending.map(version => (
            <Panel key={version.id} padding="md">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-3">
                    <h3 className="text-base font-semibold text-[color:var(--dusk-text-primary)]">{version.creativeName ?? version.creativeId}</h3>
                    <Badge tone="warning" size="sm">In review</Badge>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-4 text-sm text-[color:var(--dusk-text-muted)]">
                    <span>Version: <strong className="text-[color:var(--dusk-text-secondary)]">v{version.versionNumber}</strong></span>
                    <span>Source: <strong className="text-[color:var(--dusk-text-secondary)]">{version.sourceKind}</strong></span>
                    <span>Format: <strong className="text-[color:var(--dusk-text-secondary)]">{version.servingFormat}</strong></span>
                    <span>Created: <strong className="text-[color:var(--dusk-text-secondary)]">{version.createdAt ? new Date(version.createdAt).toLocaleString() : '—'}</strong></span>
                  </div>
                </div>
                <div className="flex gap-2">
                  {resolveCreativePreviewHref(version) && (
                    <Button
                      type="button"
                      onClick={() => {
                        const url = resolveCreativePreviewHref(version);
                        if (!url) return;
                        const kind = resolveCreativePreviewKind(version);
                        setPreviewState({
                          url,
                          name: version.creativeName ?? version.creativeId,
                          width: Number(version?.width) > 0 ? Number(version?.width) : kind === 'video' ? 960 : 300,
                          height: Number(version?.height) > 0 ? Number(version?.height) : kind === 'video' ? 540 : 250,
                          kind,
                        });
                      }}
                      variant="secondary"
                      size="sm"
                      leadingIcon={<Eye />}
                    >
                      Preview
                    </Button>
                  )}
                  <Button
                    onClick={() => void openQa(version.id)}
                    variant="secondary"
                    size="sm"
                  >
                    QA
                  </Button>
                  {canAct && (
                    <>
                      <Button size="sm" onClick={() => setActionState({ versionId: version.id, type: 'approve', notes: '', reason: '', loading: false, error: '' })}>
                        Approve
                      </Button>
                      <Button size="sm" variant="danger" onClick={() => setActionState({ versionId: version.id, type: 'reject', notes: '', reason: '', loading: false, error: '' })}>
                        Reject
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </Panel>
          ))}
        </div>
      )}

      {actionState && (
        <Modal
          open
          onClose={() => setActionState(null)}
          title={actionState.type === 'approve' ? 'Approve creative version' : 'Reject creative version'}
          size="md"
          footer={
            <>
              <Button variant="ghost" onClick={() => setActionState(null)}>
                Cancel
              </Button>
              <Button
                onClick={() => void handleAction()}
                loading={actionState.loading}
                variant={actionState.type === 'approve' ? 'primary' : 'danger'}
              >
                {actionState.type === 'approve' ? 'Approve' : 'Reject'}
              </Button>
            </>
          }
        >
            {actionState.error && (
              <Panel padding="sm" className="mb-4 border-[color:var(--dusk-status-critical-border)] bg-[color:var(--dusk-status-critical-bg)] text-[color:var(--dusk-status-critical-fg)]">
                {actionState.error}
              </Panel>
            )}
            {actionState.type === 'approve' ? (
              <div>
                <label className="mb-1 block text-sm font-medium text-[color:var(--dusk-text-secondary)]">Notes</label>
                <textarea
                  value={actionState.notes}
                  onChange={event => setActionState(current => current ? { ...current, notes: event.target.value } : current)}
                  rows={3}
                  className="w-full rounded-lg border border-[color:var(--dusk-border-default)] bg-surface-1 px-3 py-2 text-sm text-[color:var(--dusk-text-primary)] focus:border-[color:var(--dusk-border-strong)] focus:outline-none focus:ring-2 focus:ring-[color:var(--dusk-brand-500)]/20"
                />
              </div>
            ) : (
              <div>
                <label className="mb-1 block text-sm font-medium text-[color:var(--dusk-text-secondary)]">Reason</label>
                <textarea
                  value={actionState.reason}
                  onChange={event => setActionState(current => current ? { ...current, reason: event.target.value } : current)}
                  rows={4}
                  className="w-full rounded-lg border border-[color:var(--dusk-border-default)] bg-surface-1 px-3 py-2 text-sm text-[color:var(--dusk-text-primary)] focus:border-[color:var(--dusk-border-strong)] focus:outline-none focus:ring-2 focus:ring-[color:var(--dusk-brand-500)]/20"
                />
              </div>
            )}
        </Modal>
      )}

      {qaState && (
        <Modal
          open
          onClose={() => setQaState(null)}
          title="Creative QA Preview"
          description="Review artifact quality and readiness before approving."
          size="xl"
          footer={
            <Button variant="secondary" onClick={() => setQaState(null)}>
              Close
            </Button>
          }
        >
            <div className="grid gap-0 lg:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.9fr)]">
              <div className="min-h-[420px] border-b border-[color:var(--dusk-border-subtle)] bg-slate-950 lg:border-b-0 lg:border-r">
                {qaState.loading ? (
                  <div className="flex h-full min-h-[420px] items-center justify-center text-white">
                    <CenteredSpinner label="Loading QA detail…" />
                  </div>
                ) : qaState.error ? (
                  <div className="p-6 text-sm text-red-300">{qaState.error}</div>
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
                    className="h-[70vh] min-h-[420px] w-full bg-white"
                    sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
                  />
                ) : (
                  <div className="flex h-full min-h-[420px] items-center justify-center p-6 text-sm text-slate-300">
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
                            <span className={getVideoProcessingState(qaState.version)?.ffprobeAvailable ? 'text-emerald-600' : 'text-amber-700'}>
                              {getVideoProcessingState(qaState.version)?.ffprobeAvailable ? 'Available' : (getVideoProcessingState(qaState.version)?.ffprobeReason ?? 'Unavailable')}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span>ffmpeg</span>
                            <span className={getVideoProcessingState(qaState.version)?.ffmpegAvailable ? 'text-emerald-600' : 'text-amber-700'}>
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
                        <div className="rounded-lg border border-[color:var(--dusk-border-default)] bg-surface-2 p-3">
                          <p className="text-xs uppercase tracking-wide text-[color:var(--dusk-text-muted)]">Format</p>
                          <p className="mt-1 text-sm font-medium text-[color:var(--dusk-text-primary)]">{qaState.version.servingFormat}</p>
                        </div>
                        <div className="rounded-lg border border-[color:var(--dusk-border-default)] bg-surface-2 p-3">
                          <p className="text-xs uppercase tracking-wide text-[color:var(--dusk-text-muted)]">Source</p>
                          <p className="mt-1 text-sm font-medium text-[color:var(--dusk-text-primary)]">{qaState.version.sourceKind}</p>
                        </div>
                        <div className="rounded-lg border border-[color:var(--dusk-border-default)] bg-surface-2 p-3">
                          <p className="text-xs uppercase tracking-wide text-[color:var(--dusk-text-muted)]">Dimensions</p>
                          <p className="mt-1 text-sm font-medium text-[color:var(--dusk-text-primary)]">
                            {qaState.version.width && qaState.version.height ? `${qaState.version.width}×${qaState.version.height}` : '—'}
                          </p>
                        </div>
                        <div className="rounded-lg border border-[color:var(--dusk-border-default)] bg-surface-2 p-3">
                          <p className="text-xs uppercase tracking-wide text-[color:var(--dusk-text-muted)]">Duration</p>
                          <p className="mt-1 text-sm font-medium text-[color:var(--dusk-text-primary)]">{formatDuration(qaState.version.durationMs)}</p>
                        </div>
                        <div className="rounded-lg border border-[color:var(--dusk-border-default)] bg-surface-2 p-3">
                          <p className="text-xs uppercase tracking-wide text-[color:var(--dusk-text-muted)]">Mime</p>
                          <p className="mt-1 text-sm font-medium text-[color:var(--dusk-text-primary)]">{qaState.version.mimeType || '—'}</p>
                        </div>
                        <div className="rounded-lg border border-[color:var(--dusk-border-default)] bg-surface-2 p-3">
                          <p className="text-xs uppercase tracking-wide text-[color:var(--dusk-text-muted)]">File size</p>
                          <p className="mt-1 text-sm font-medium text-[color:var(--dusk-text-primary)]">{formatBytes(qaState.version.fileSize)}</p>
                        </div>
                        {qaState.version.servingFormat === 'vast_video' && (
                          <>
                            <div className="rounded-lg border border-[color:var(--dusk-border-default)] bg-surface-2 p-3">
                              <p className="text-xs uppercase tracking-wide text-[color:var(--dusk-text-muted)]">Codec</p>
                              <p className="mt-1 text-sm font-medium text-[color:var(--dusk-text-primary)]">{getVideoMetadata(qaState.version).codec || '—'}</p>
                            </div>
                            <div className="rounded-lg border border-[color:var(--dusk-border-default)] bg-surface-2 p-3">
                              <p className="text-xs uppercase tracking-wide text-[color:var(--dusk-text-muted)]">Bitrate</p>
                              <p className="mt-1 text-sm font-medium text-[color:var(--dusk-text-primary)]">{formatBitRate(getVideoMetadata(qaState.version).bitRate)}</p>
                            </div>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="mt-6">
                      <h4 className="text-sm font-semibold text-[color:var(--dusk-text-primary)]">Readiness checks</h4>
                      <div className="mt-3 space-y-2">
                        {readinessChecks(qaState.version, qaState.artifacts).map(check => (
                          <div key={check.label} className="flex items-center justify-between rounded-lg border border-[color:var(--dusk-border-default)] px-3 py-2 text-sm">
                            <span className="text-[color:var(--dusk-text-secondary)]">{check.label}</span>
                            <span className={check.ok ? 'text-emerald-600' : 'text-rose-600'}>
                              {check.ok ? 'Ready' : 'Missing'}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="mt-6">
                      <h4 className="text-sm font-semibold text-[color:var(--dusk-text-primary)]">Artifacts</h4>
                      <div className="mt-3 space-y-2">
                        {qaState.artifacts.map(artifact => (
                          <div key={artifact.id} className="rounded-lg border border-[color:var(--dusk-border-default)] px-3 py-3">
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
                        ))}
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
      )}

      {previewState && (
        <Modal
          open
          onClose={() => setPreviewState(null)}
          title={
            <div className="text-white">
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold">{previewState.name}</div>
                <div className="text-xs text-slate-300">{previewState.width} × {previewState.height}</div>
              </div>
            </div>
          }
          size="xl"
          footer={
            <>
              <a
                href={previewState.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-[color:var(--dusk-border-default)] bg-surface-1 px-4 text-sm font-medium text-[color:var(--dusk-text-primary)] transition hover:border-[color:var(--dusk-border-strong)] hover:bg-surface-hover"
              >
                <ExternalLink className="h-4 w-4" />
                Open in tab
              </a>
              <Button variant="ghost" onClick={() => setPreviewState(null)}>
                Close
              </Button>
            </>
          }
        >
          <div className="-mx-6 -my-4 flex items-center justify-center bg-slate-950 p-4">
            <div className="flex items-center justify-center bg-slate-950 p-4">
              {previewState.kind === 'video' ? (
                <video
                  controls
                  autoPlay
                  className="max-h-[80vh] max-w-[88vw] rounded-lg bg-black"
                  style={{ width: `${previewState.width}px`, height: `${previewState.height}px` }}
                  src={previewState.url}
                />
              ) : (
                <iframe
                  title={`Preview: ${previewState.name}`}
                  src={previewState.url}
                  className="rounded-lg bg-white"
                  style={{ width: `${previewState.width}px`, height: `${previewState.height}px`, maxWidth: '88vw', maxHeight: '80vh' }}
                  sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
                />
              )}
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
