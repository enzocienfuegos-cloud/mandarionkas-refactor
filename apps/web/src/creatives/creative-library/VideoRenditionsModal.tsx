import React from 'react';
import { Button } from '../../system';
import type { RegenerationFeedbackState, VideoRenditionState } from './types';

type VideoProcessingSummary = {
  tone: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message: string;
} | null;

type Props = {
  state: VideoRenditionState;
  regenerationFeedback: RegenerationFeedbackState | null;
  estimatedRemainingMs: number | null;
  pendingPublishPercent: number;
  pendingPublishStage: string;
  pendingPublishMessage: string;
  plannedRenditions: any[];
  renditionProcessing: any[];
  videoProcessing: Record<string, any> | undefined;
  videoProcessingSummary: VideoProcessingSummary;
  onClose: () => void;
  onRegenerate: () => void | Promise<void>;
  onStatusToggle: (renditionId: string, status: 'active' | 'paused') => void | Promise<void>;
  onSetError: (message: string) => void;
  formatDuration: (ms: number) => string;
  formatBytes: (value?: number | null) => string;
  formatVideoBitrate: (value?: number | null) => string;
  getPublishStageLabel: (stage: string | null | undefined, fallback?: string) => string;
  getRenditionProgressLabel: (entry: any, creativeVersion: VideoRenditionState['version']) => string;
  getVideoRenditionStatusBadge: (rendition: any, entry: any, creativeVersion: VideoRenditionState['version']) => React.ReactNode;
  getVideoRenditionToggleBlockedReason: (rendition: any, renditionReadyForToggle: boolean) => string | null;
};

export function VideoRenditionsModal({
  state,
  regenerationFeedback,
  estimatedRemainingMs,
  pendingPublishPercent,
  pendingPublishStage,
  pendingPublishMessage,
  plannedRenditions,
  renditionProcessing,
  videoProcessing,
  videoProcessingSummary,
  onClose,
  onRegenerate,
  onStatusToggle,
  onSetError,
  formatDuration,
  formatBytes,
  formatVideoBitrate,
  getPublishStageLabel,
  getRenditionProgressLabel,
  getVideoRenditionStatusBadge,
  getVideoRenditionToggleBlockedReason,
}: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[90vh] w-full max-w-4xl overflow-hidden rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-800">Video renditions</h2>
            <p className="mt-1 text-sm text-slate-500">{state.creativeName}</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
          >
            Close
          </button>
        </div>

        <div className="space-y-4 p-6">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
            <p className="max-w-2xl">
              Manage which MP4 renditions are active for VAST delivery. The source file stays available as fallback, and transcoded renditions are served first when active.
            </p>
            <Button
              onClick={() => void onRegenerate()}
              disabled={state.loading || state.awaitingPublish}
              variant="secondary"
              size="sm"
              className="w-48 shrink-0"
            >
              {state.awaitingPublish
                ? 'Publishing in background…'
                : state.loading
                  ? 'Regenerating…'
                  : 'Regenerate renditions'}
            </Button>
          </div>

          {state.error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {state.error}
            </div>
          )}

          {state.awaitingPublish && (
            <div className="rounded-xl border border-fuchsia-200/70 bg-fuchsia-50/80 px-4 py-4 dark:border-fuchsia-500/20 dark:bg-fuchsia-500/10">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-800">Video publish in progress</p>
                  <p className="mt-1 text-sm text-slate-600">{pendingPublishMessage}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    The creative version and renditions will appear here automatically when the background worker finishes.
                  </p>
                </div>
                <div className="text-right text-sm text-slate-600">
                  <div className="font-semibold text-slate-800">{pendingPublishPercent}%</div>
                  <div>{getPublishStageLabel(pendingPublishStage)}</div>
                </div>
              </div>
              <div className="mt-4 h-3 overflow-hidden rounded-full bg-white/80">
                <div
                  className="h-full rounded-full bg-fuchsia-500 transition-[width] duration-300"
                  style={{ width: `${Math.max(8, pendingPublishPercent)}%` }}
                />
              </div>
            </div>
          )}

          {regenerationFeedback && (
            <div className={`rounded-xl border px-4 py-4 ${
              regenerationFeedback.progressPercent === 100
                ? 'border-emerald-200 bg-emerald-50'
                : 'border-fuchsia-200/70 bg-fuchsia-50/80 dark:border-fuchsia-500/20 dark:bg-fuchsia-500/10'
            }`}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-800">
                    {regenerationFeedback.progressPercent === 100 ? 'Regeneration complete' : 'Regeneration in progress'}
                  </p>
                  <p className="mt-1 text-sm text-slate-600">{regenerationFeedback.stageLabel}</p>
                </div>
                <div className="text-right text-sm text-slate-600">
                  <div className="font-semibold text-slate-800">{regenerationFeedback.progressPercent}%</div>
                  <div>
                    {regenerationFeedback.progressPercent === 100
                      ? 'Estimated remaining 0:00'
                      : `Estimated remaining ${formatDuration(estimatedRemainingMs ?? 0)}`}
                  </div>
                </div>
              </div>
              <div className="mt-4">
                <div className="h-3 overflow-hidden rounded-full bg-white/80">
                  <div
                    className={`h-full rounded-full transition-[width] duration-300 ${
                      regenerationFeedback.progressPercent === 100 ? 'bg-emerald-500' : 'bg-fuchsia-500'
                    }`}
                    style={{ width: `${regenerationFeedback.progressPercent}%` }}
                  />
                </div>
                <p className="mt-2 text-xs text-slate-500">
                  Estimated progress based on encoder stages. Large source files can take longer.
                </p>
              </div>
            </div>
          )}

          {videoProcessingSummary && !state.awaitingPublish && (
            <div className={`rounded-xl border px-4 py-4 text-sm ${
              videoProcessingSummary.tone === 'error'
                ? 'border-rose-200 bg-rose-50 text-rose-800'
                : videoProcessingSummary.tone === 'warning'
                  ? 'border-amber-200 bg-amber-50 text-amber-800'
                  : 'border-sky-200 bg-sky-50 text-sky-800'
            }`}>
              <div className="font-semibold">{videoProcessingSummary.title}</div>
              <div className="mt-1">{videoProcessingSummary.message}</div>
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <h3 className="text-sm font-semibold text-slate-800">Encoder feedback</h3>
              <div className="mt-3 space-y-2 text-sm text-slate-600">
                <div>
                  Source:{' '}
                  <span className="font-medium text-slate-800">
                    {videoProcessing?.source?.width && videoProcessing?.source?.height
                      ? `${videoProcessing.source.width}×${videoProcessing.source.height}`
                      : 'Unknown'}
                  </span>
                </div>
                <div>
                  ffprobe:{' '}
                  <span className="font-medium text-slate-800">
                    {videoProcessing?.ffprobeAvailable ? 'available' : `missing (${videoProcessing?.ffprobeReason ?? 'unknown'})`}
                  </span>
                </div>
                <div>
                  ffmpeg:{' '}
                  <span className="font-medium text-slate-800">
                    {videoProcessing?.ffmpegAvailable ? 'available' : `missing (${videoProcessing?.ffmpegReason ?? 'unknown'})`}
                  </span>
                </div>
                <div>
                  Planned renditions:{' '}
                  <span className="font-medium text-slate-800">
                    {plannedRenditions.length ? plannedRenditions.map((target: any) => target.label).join(', ') : 'None'}
                  </span>
                </div>
                <div>
                  Generated:{' '}
                  <span className="font-medium text-slate-800">
                    {videoProcessing?.generatedCount ?? 0}
                  </span>
                </div>
                {videoProcessing?.noTargetsReason && (
                  <div className="text-amber-700">
                    No ladder generated: {String(videoProcessing.noTargetsReason).replace(/_/g, ' ')}
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <h3 className="text-sm font-semibold text-slate-800">Last run detail</h3>
              <div className="mt-3 space-y-2 text-sm text-slate-600">
                {renditionProcessing.length > 0 ? renditionProcessing.map((entry: any) => (
                  <div key={entry.label} className="flex items-start justify-between gap-3 rounded-lg border border-slate-100 px-3 py-2">
                    <span className="font-medium text-slate-800">{entry.label}</span>
                    <span className={entry.available ? 'text-emerald-700' : ['queued', 'processing', 'draft'].includes(String(entry.status ?? '').toLowerCase()) ? 'text-amber-700' : String(entry.status ?? '').toLowerCase() === 'unavailable' ? 'text-slate-500' : 'text-rose-700'}>
                      {getRenditionProgressLabel(entry, state.version)}
                    </span>
                  </div>
                )) : state.awaitingPublish ? (
                  <div className="text-slate-500">Waiting for the background worker to finish creating the creative version and renditions.</div>
                ) : (
                  <div className="text-slate-500">No encoder run recorded yet.</div>
                )}
              </div>
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-slate-200">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Rendition</th>
                  <th className="px-4 py-3">Resolution</th>
                  <th className="px-4 py-3">Bitrate</th>
                  <th className="px-4 py-3">Codec</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Asset</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {state.renditions.map(rendition => (
                  (() => {
                    const matchingProcessingEntry = rendition.isSource
                      ? null
                      : renditionProcessing.find((entry: any) => (
                        String(entry?.label ?? '').trim().toLowerCase()
                        === String(rendition.label ?? '').trim().toLowerCase()
                      )) ?? null;
                    const renditionReadyForToggle = Boolean(
                      rendition.isSource || (
                        rendition.publicUrl
                        && Number(rendition.sizeBytes || 0) > 0
                        && rendition.metadata?.available === true
                      ),
                    );
                    const toggleBlockedReason = getVideoRenditionToggleBlockedReason(rendition, renditionReadyForToggle);
                    const toggleBlocked = state.loading || Boolean(toggleBlockedReason);
                    const toggleTitle = toggleBlockedReason
                      ?? (rendition.status === 'active'
                        ? 'Disable this rendition for VAST delivery.'
                        : 'Enable this rendition for VAST delivery.');
                    return (
                      <tr key={rendition.id}>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-medium text-slate-800">{rendition.label}</span>
                            {rendition.isSource && (
                              <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                                Source
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          {rendition.width && rendition.height ? `${rendition.width}×${rendition.height}` : '—'}
                        </td>
                        <td className="px-4 py-3 text-slate-600">{formatVideoBitrate(rendition.bitrateKbps)}</td>
                        <td className="px-4 py-3 text-slate-600">{rendition.codec || '—'}</td>
                        <td className="px-4 py-3">{getVideoRenditionStatusBadge(rendition, matchingProcessingEntry, state.version)}</td>
                        <td className="px-4 py-3">
                          <div className="space-y-1 text-xs text-slate-500">
                            {rendition.publicUrl ? (
                              <a
                                href={rendition.publicUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="font-medium text-fuchsia-600 hover:text-fuchsia-700 dark:text-fuchsia-300 dark:hover:text-fuchsia-200"
                              >
                                Open MP4
                              </a>
                            ) : (
                              <span>Not published</span>
                            )}
                            <div>{formatBytes(rendition.sizeBytes)}</div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <label
                            className={`inline-flex items-center gap-3 text-xs font-medium ${
                              toggleBlocked ? 'cursor-not-allowed text-slate-400' : 'cursor-pointer text-slate-700'
                            }`}
                            title={toggleTitle}
                            onClick={(event) => {
                              if (!toggleBlockedReason) return;
                              event.preventDefault();
                              event.stopPropagation();
                              onSetError(toggleBlockedReason);
                            }}
                          >
                            <span>{rendition.status === 'active' ? 'On' : 'Off'}</span>
                            <span className="relative inline-flex items-center">
                              <input
                                type="checkbox"
                                className="peer sr-only"
                                checked={rendition.status === 'active'}
                                disabled={toggleBlocked}
                                onChange={(event) => {
                                  void onStatusToggle(
                                    rendition.id,
                                    event.target.checked ? 'active' : 'paused',
                                  );
                                }}
                              />
                              <span className="h-6 w-11 rounded-full bg-slate-300 transition-colors peer-checked:bg-emerald-500 peer-disabled:bg-slate-200" />
                              <span className="absolute left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform peer-checked:translate-x-5" />
                            </span>
                          </label>
                        </td>
                      </tr>
                    );
                  })()
                ))}
                {!state.loading && state.renditions.length === 0 && state.awaitingPublish && (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-sm text-slate-500">
                      Renditions are still being generated in the background. This table will populate after publish completes.
                    </td>
                  </tr>
                )}
                {!state.loading && state.renditions.length === 0 && !state.awaitingPublish && (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-sm text-slate-500">
                      No video renditions yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
