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

export default function CreativeApproval() {
  const { user } = useOutletContext<{ user: User }>();
  const [versions, setVersions] = useState<CreativeVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionState, setActionState] = useState<ActionState | null>(null);
  const [qaState, setQaState] = useState<QaState | null>(null);
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
      setActionState(null);
    } catch (actionError: any) {
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
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-t-2 border-indigo-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
        <p className="font-medium">Error loading review queue</p>
        <p className="mt-1 text-sm">{error}</p>
        <button onClick={() => void load()} className="mt-3 text-sm text-red-600 underline">Retry</button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Creative Version Review</h1>
          <p className="mt-1 text-sm text-slate-500">{pending.length} version{pending.length !== 1 ? 's' : ''} awaiting review</p>
        </div>
        <button onClick={() => void load()} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
          Refresh
        </button>
      </div>

      {!canAct && (
        <div className="rounded-lg border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-800">
          You have read-only access. Only admins can approve or reject versions.
        </div>
      )}

      {pending.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white py-20 text-center">
          <div className="text-4xl">✅</div>
          <h3 className="mt-3 text-lg font-medium text-slate-700">Queue is empty</h3>
          <p className="mt-1 text-sm text-slate-500">All submitted versions have been reviewed.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {pending.map(version => (
            <div key={version.id} className="rounded-xl border border-slate-200 bg-white p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-3">
                    <h3 className="text-base font-semibold text-slate-800">{version.creativeName ?? version.creativeId}</h3>
                    <span className="rounded-full bg-yellow-100 px-2.5 py-0.5 text-xs font-medium text-yellow-800">In review</span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-4 text-sm text-slate-500">
                    <span>Version: <strong className="text-slate-700">v{version.versionNumber}</strong></span>
                    <span>Source: <strong className="text-slate-700">{version.sourceKind}</strong></span>
                    <span>Format: <strong className="text-slate-700">{version.servingFormat}</strong></span>
                    <span>Created: <strong className="text-slate-700">{version.createdAt ? new Date(version.createdAt).toLocaleString() : '—'}</strong></span>
                  </div>
                </div>
                <div className="flex gap-2">
                  {resolveCreativePreviewHref(version) && (
                    <a href={resolveCreativePreviewHref(version)} target="_blank" rel="noopener noreferrer" className="rounded-lg border border-indigo-200 px-3 py-1.5 text-sm font-medium text-indigo-600 hover:bg-indigo-50">
                      Preview
                    </a>
                  )}
                  <button
                    onClick={() => void openQa(version.id)}
                    className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                  >
                    QA
                  </button>
                  {canAct && (
                    <>
                      <button onClick={() => setActionState({ versionId: version.id, type: 'approve', notes: '', reason: '', loading: false, error: '' })} className="rounded-lg bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-700">
                        Approve
                      </button>
                      <button onClick={() => setActionState({ versionId: version.id, type: 'reject', notes: '', reason: '', loading: false, error: '' })} className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700">
                        Reject
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {actionState && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h2 className="text-lg font-semibold text-slate-800">
              {actionState.type === 'approve' ? 'Approve creative version' : 'Reject creative version'}
            </h2>
            {actionState.error && (
              <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {actionState.error}
              </div>
            )}
            {actionState.type === 'approve' ? (
              <div className="mt-4">
                <label className="mb-1 block text-sm font-medium text-slate-700">Notes</label>
                <textarea
                  value={actionState.notes}
                  onChange={event => setActionState(current => current ? { ...current, notes: event.target.value } : current)}
                  rows={3}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
            ) : (
              <div className="mt-4">
                <label className="mb-1 block text-sm font-medium text-slate-700">Reason</label>
                <textarea
                  value={actionState.reason}
                  onChange={event => setActionState(current => current ? { ...current, reason: event.target.value } : current)}
                  rows={4}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>
            )}
            <div className="mt-5 flex justify-end gap-3">
              <button onClick={() => setActionState(null)} className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">
                Cancel
              </button>
              <button
                onClick={() => void handleAction()}
                disabled={actionState.loading}
                className={`rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-50 ${actionState.type === 'approve' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}`}
              >
                {actionState.loading ? 'Saving…' : actionState.type === 'approve' ? 'Approve' : 'Reject'}
              </button>
            </div>
          </div>
        </div>
      )}

      {qaState && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-5xl overflow-hidden rounded-xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-800">Creative QA Preview</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Review artifact quality and readiness before approving.
                </p>
              </div>
              <button onClick={() => setQaState(null)} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50">
                Close
              </button>
            </div>

            <div className="grid gap-0 lg:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.9fr)]">
              <div className="min-h-[420px] border-b border-slate-200 bg-slate-950 lg:border-b-0 lg:border-r">
                {qaState.loading ? (
                  <div className="flex h-full min-h-[420px] items-center justify-center">
                    <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-t-2 border-white" />
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
                      <div className="mb-6 rounded-lg border border-slate-200 bg-slate-50 p-4">
                        <h4 className="text-sm font-semibold text-slate-800">Video processing</h4>
                        <div className="mt-3 space-y-2 text-sm">
                          <div className="flex items-center justify-between">
                            <span className="text-slate-600">ffprobe</span>
                            <span className={getVideoProcessingState(qaState.version)?.ffprobeAvailable ? 'text-emerald-600' : 'text-amber-700'}>
                              {getVideoProcessingState(qaState.version)?.ffprobeAvailable ? 'Available' : (getVideoProcessingState(qaState.version)?.ffprobeReason ?? 'Unavailable')}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-slate-600">ffmpeg</span>
                            <span className={getVideoProcessingState(qaState.version)?.ffmpegAvailable ? 'text-emerald-600' : 'text-amber-700'}>
                              {getVideoProcessingState(qaState.version)?.ffmpegAvailable ? 'Available' : (getVideoProcessingState(qaState.version)?.ffmpegReason ?? 'Unavailable')}
                            </span>
                          </div>
                        </div>
                        {(!getVideoProcessingState(qaState.version)?.ffprobeAvailable || !getVideoProcessingState(qaState.version)?.ffmpegAvailable) && (
                          <p className="mt-3 text-xs text-slate-500">
                            This creative is still publishable. The environment just could not extract all video diagnostics automatically.
                          </p>
                        )}
                      </div>
                    )}

                    <div>
                      <h3 className="text-base font-semibold text-slate-800">
                        {qaState.version.creativeName ?? qaState.version.creativeId}
                      </h3>
                      <div className="mt-2 grid gap-3 sm:grid-cols-2">
                        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                          <p className="text-xs uppercase tracking-wide text-slate-500">Format</p>
                          <p className="mt-1 text-sm font-medium text-slate-800">{qaState.version.servingFormat}</p>
                        </div>
                        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                          <p className="text-xs uppercase tracking-wide text-slate-500">Source</p>
                          <p className="mt-1 text-sm font-medium text-slate-800">{qaState.version.sourceKind}</p>
                        </div>
                        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                          <p className="text-xs uppercase tracking-wide text-slate-500">Dimensions</p>
                          <p className="mt-1 text-sm font-medium text-slate-800">
                            {qaState.version.width && qaState.version.height ? `${qaState.version.width}×${qaState.version.height}` : '—'}
                          </p>
                        </div>
                        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                          <p className="text-xs uppercase tracking-wide text-slate-500">Duration</p>
                          <p className="mt-1 text-sm font-medium text-slate-800">{formatDuration(qaState.version.durationMs)}</p>
                        </div>
                        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                          <p className="text-xs uppercase tracking-wide text-slate-500">Mime</p>
                          <p className="mt-1 text-sm font-medium text-slate-800">{qaState.version.mimeType || '—'}</p>
                        </div>
                        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                          <p className="text-xs uppercase tracking-wide text-slate-500">File size</p>
                          <p className="mt-1 text-sm font-medium text-slate-800">{formatBytes(qaState.version.fileSize)}</p>
                        </div>
                        {qaState.version.servingFormat === 'vast_video' && (
                          <>
                            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                              <p className="text-xs uppercase tracking-wide text-slate-500">Codec</p>
                              <p className="mt-1 text-sm font-medium text-slate-800">{getVideoMetadata(qaState.version).codec || '—'}</p>
                            </div>
                            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                              <p className="text-xs uppercase tracking-wide text-slate-500">Bitrate</p>
                              <p className="mt-1 text-sm font-medium text-slate-800">{formatBitRate(getVideoMetadata(qaState.version).bitRate)}</p>
                            </div>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="mt-6">
                      <h4 className="text-sm font-semibold text-slate-800">Readiness checks</h4>
                      <div className="mt-3 space-y-2">
                        {readinessChecks(qaState.version, qaState.artifacts).map(check => (
                          <div key={check.label} className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-sm">
                            <span className="text-slate-700">{check.label}</span>
                            <span className={check.ok ? 'text-emerald-600' : 'text-rose-600'}>
                              {check.ok ? 'Ready' : 'Missing'}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="mt-6">
                      <h4 className="text-sm font-semibold text-slate-800">Artifacts</h4>
                      <div className="mt-3 space-y-2">
                        {qaState.artifacts.map(artifact => (
                          <div key={artifact.id} className="rounded-lg border border-slate-200 px-3 py-3">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="text-sm font-medium text-slate-800">{artifact.kind}</div>
                                <div className="mt-1 text-xs text-slate-500">
                                  {artifact.mimeType || 'unknown mime'} · {formatBytes(artifact.sizeBytes)}
                                </div>
                              </div>
                              {artifact.publicUrl && (
                                <a
                                  href={artifact.publicUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="rounded-lg border border-indigo-200 px-2.5 py-1 text-xs font-medium text-indigo-600 hover:bg-indigo-50"
                                >
                                  Open
                                </a>
                              )}
                            </div>
                          </div>
                        ))}
                        {qaState.artifacts.length === 0 && (
                          <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-4 text-sm text-slate-500">
                            No artifacts registered for this version yet.
                          </div>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
