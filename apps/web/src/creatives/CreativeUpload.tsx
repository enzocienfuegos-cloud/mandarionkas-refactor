import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  completeCreativeIngestion,
  createCreativeIngestionUpload,
  publishCreativeIngestion,
  uploadFileToSignedUrl,
} from './catalog';
import { loadWorkspaces, type WorkspaceOption } from '../shared/workspaces';

type SourceKind = 'html5_zip' | 'video_mp4';

const ACCEPTED_EXTENSIONS: Record<SourceKind, string> = {
  html5_zip: '.zip',
  video_mp4: '.mp4',
};
const MAX_PARALLEL_UPLOADS = 4;

function formatDuration(ms: number) {
  const seconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${String(remainingSeconds).padStart(2, '0')}`;
}

function estimateProcessingPercent(elapsedMs: number) {
  if (elapsedMs < 2000) return 8 + Math.round((elapsedMs / 2000) * 12);
  if (elapsedMs < 8000) return 20 + Math.round(((elapsedMs - 2000) / 6000) * 35);
  if (elapsedMs < 18000) return 55 + Math.round(((elapsedMs - 8000) / 10000) * 25);
  if (elapsedMs < 30000) return 80 + Math.round(((elapsedMs - 18000) / 12000) * 12);
  return 94;
}

export default function CreativeUpload() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [sourceKind, setSourceKind] = useState<SourceKind>('html5_zip');
  const [files, setFiles] = useState<File[]>([]);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [currentFileName, setCurrentFileName] = useState('');
  const [currentFileProgress, setCurrentFileProgress] = useState(0);
  const [currentProcessingName, setCurrentProcessingName] = useState('');
  const [currentProcessingProgress, setCurrentProcessingProgress] = useState(0);
  const [currentProcessingEta, setCurrentProcessingEta] = useState('');
  const [overallProgress, setOverallProgress] = useState(0);
  const [workspaces, setWorkspaces] = useState<WorkspaceOption[]>([]);
  const [workspaceId, setWorkspaceId] = useState('');

  useEffect(() => {
    loadWorkspaces()
      .then((workspaceList) => {
        setWorkspaces(workspaceList);
      })
      .catch(() => {});
  }, []);

  const mergeFiles = (incomingFiles: File[]) => {
    setFiles((current) => {
      const next = [...current];
      const seen = new Set(current.map(file => `${file.name}-${file.size}-${file.lastModified}`));
      for (const file of incomingFiles) {
        const key = `${file.name}-${file.size}-${file.lastModified}`;
        if (seen.has(key)) continue;
        seen.add(key);
        next.push(file);
      }
      return next;
    });
    setError('');
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (files.length === 0) {
      setError('Select at least one file first.');
      return;
    }
    if (!workspaceId) {
      setError('Select a client before uploading.');
      return;
    }

    setLoading(true);
    setError('');
    setStatus('Preparing uploads…');
    setCurrentFileName('');
    setCurrentFileProgress(0);
    setCurrentProcessingName('');
    setCurrentProcessingProgress(0);
    setCurrentProcessingEta('');
    setOverallProgress(0);

    const totalBytes = files.reduce((sum, file) => sum + file.size, 0);
    const loadedBytesByIndex = files.map(() => 0);
    const activeIndexes = new Set<number>();
    const processingStartedAtByIndex = files.map(() => 0);
    const activeProcessingIndexes = new Set<number>();

    const refreshOverallProgress = () => {
      const loadedBytes = loadedBytesByIndex.reduce((sum, value) => sum + value, 0);
      const nextOverall = totalBytes > 0
        ? Math.min(100, Math.round((loadedBytes / totalBytes) * 100))
        : 0;
      setOverallProgress(nextOverall);
    };

    const refreshActiveProgress = () => {
      if (activeIndexes.size === 0) {
        setCurrentFileName('');
        setCurrentFileProgress(0);
        return;
      }
      const indexes = Array.from(activeIndexes.values()).sort((a, b) => a - b);
      const names = indexes.map(index => files[index]?.name).filter(Boolean);
      const averageProgress = Math.round(
        indexes.reduce((sum, index) => {
          const size = files[index]?.size || 0;
          if (size <= 0) return sum;
          return sum + Math.min(100, Math.round((loadedBytesByIndex[index] / size) * 100));
        }, 0) / indexes.length,
      );
      setCurrentFileName(names[0] + (names.length > 1 ? ` +${names.length - 1} more` : ''));
      setCurrentFileProgress(averageProgress);
    };

    const refreshProcessingProgress = () => {
      if (activeProcessingIndexes.size === 0) {
        setCurrentProcessingName('');
        setCurrentProcessingProgress(0);
        setCurrentProcessingEta('');
        return;
      }
      const indexes = Array.from(activeProcessingIndexes.values()).sort((a, b) => a - b);
      const names = indexes.map(index => files[index]?.name).filter(Boolean);
      const elapsedValues = indexes.map(index => Date.now() - (processingStartedAtByIndex[index] || Date.now()));
      const averageProgress = Math.round(
        elapsedValues.reduce((sum, elapsedMs) => sum + estimateProcessingPercent(elapsedMs), 0) / elapsedValues.length,
      );
      const averageRemainingMs = elapsedValues.reduce((sum, elapsedMs) => {
        const progress = estimateProcessingPercent(elapsedMs);
        if (progress <= 0 || progress >= 100) return sum;
        const estimatedTotalMs = (elapsedMs / progress) * 100;
        return sum + Math.max(0, estimatedTotalMs - elapsedMs);
      }, 0) / elapsedValues.length;
      setCurrentProcessingName(names[0] + (names.length > 1 ? ` +${names.length - 1} more` : ''));
      setCurrentProcessingProgress(averageProgress);
      setCurrentProcessingEta(`Estimated remaining ${formatDuration(averageRemainingMs || 0)}`);
    };

    const processingInterval = window.setInterval(() => {
      refreshProcessingProgress();
    }, 300);

    try {
      const processFile = async (file: File, index: number) => {
        activeIndexes.add(index);
        refreshActiveProgress();

        const upload = await createCreativeIngestionUpload({
          workspaceId,
          sourceKind,
          file,
        });

        await uploadFileToSignedUrl(upload.upload.uploadUrl, file, ({ loadedBytes, totalBytes: fileTotalBytes }) => {
          loadedBytesByIndex[index] = loadedBytes;
          if (fileTotalBytes > 0 && loadedBytes >= fileTotalBytes) {
            loadedBytesByIndex[index] = fileTotalBytes;
          }
          refreshOverallProgress();
          refreshActiveProgress();
        });

        loadedBytesByIndex[index] = file.size;
        refreshOverallProgress();
        refreshActiveProgress();

        await completeCreativeIngestion(upload.ingestion.id, {
          workspaceId,
          file,
          publicUrl: upload.upload.publicUrl,
          storageKey: upload.upload.storageKey,
        });

        processingStartedAtByIndex[index] = Date.now();
        activeProcessingIndexes.add(index);
        setStatus(`Uploading complete. Transcoding and publishing ${files.length} creative${files.length === 1 ? '' : 's'}…`);
        refreshProcessingProgress();
        await publishCreativeIngestion(upload.ingestion.id, {
          workspaceId,
        });

        activeProcessingIndexes.delete(index);
        refreshProcessingProgress();
        activeIndexes.delete(index);
        refreshActiveProgress();
      };

      const batchSize = Math.min(MAX_PARALLEL_UPLOADS, files.length);
      setStatus(`Uploading ${files.length} creative${files.length === 1 ? '' : 's'} in batches of ${batchSize}…`);

      for (let start = 0; start < files.length; start += MAX_PARALLEL_UPLOADS) {
        const batch = files.slice(start, start + MAX_PARALLEL_UPLOADS);
        await Promise.all(batch.map((file, offset) => processFile(file, start + offset)));
      }

      setStatus(`${files.length} creative${files.length === 1 ? '' : 's'} published.`);
      setCurrentFileProgress(100);
      setCurrentProcessingProgress(100);
      setCurrentProcessingEta('Estimated remaining 0:00');
      setOverallProgress(100);
      navigate('/creatives');
    } catch (submitError: any) {
      setError(submitError.message ?? 'Upload failed');
      setStatus('');
    } finally {
      window.clearInterval(processingInterval);
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Upload External Creatives</h1>
        <p className="mt-1 text-sm text-slate-500">
          Upload multiple HTML5 zip banners or MP4 videos and publish them into the versioned creative catalog.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6 rounded-2xl border border-slate-200 bg-white p-6">
        <div className="grid gap-6 md:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">Client</label>
            <div className="mb-4 flex items-center gap-2">
              <select
                value={workspaceId}
                onChange={event => setWorkspaceId(event.target.value)}
                disabled={loading}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">Select a client</option>
                {workspaces.map(workspace => (
                  <option key={workspace.id} value={workspace.id}>
                    {workspace.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => navigate('/clients')}
                disabled={loading}
                className="shrink-0 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
              >
                New client
              </button>
            </div>
            <label className="mb-2 block text-sm font-medium text-slate-700">Source Type</label>
            <div className="grid gap-3">
              <button
                type="button"
                onClick={() => {
                  setSourceKind('html5_zip');
                  setFiles([]);
                  setError('');
                  if (fileInputRef.current) fileInputRef.current.value = '';
                }}
                className={`rounded-xl border px-4 py-3 text-left ${sourceKind === 'html5_zip' ? 'border-indigo-500 bg-indigo-50' : 'border-slate-200 hover:bg-slate-50'}`}
              >
                <div className="font-medium text-slate-800">HTML5 ZIP</div>
                <div className="text-sm text-slate-500">Publishes `index.html` and all packaged assets to hosted display creative artifacts.</div>
              </button>
              <button
                type="button"
                onClick={() => {
                  setSourceKind('video_mp4');
                  setFiles([]);
                  setError('');
                  if (fileInputRef.current) fileInputRef.current.value = '';
                }}
                className={`rounded-xl border px-4 py-3 text-left ${sourceKind === 'video_mp4' ? 'border-indigo-500 bg-indigo-50' : 'border-slate-200 hover:bg-slate-50'}`}
              >
                <div className="font-medium text-slate-800">Video MP4</div>
                <div className="text-sm text-slate-500">Creates a video creative version ready for VAST serving and review.</div>
              </button>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">Creative Files</label>
              <input
                ref={fileInputRef}
                key={sourceKind}
                type="file"
                accept={ACCEPTED_EXTENSIONS[sourceKind]}
                multiple
                onChange={(event) => {
                  mergeFiles(Array.from(event.target.files ?? []));
                  event.currentTarget.value = '';
                }}
                className="block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-sm file:font-medium"
              />
              <p className="mt-2 text-xs text-slate-500">
                Accepted: {ACCEPTED_EXTENSIONS[sourceKind]} · each creative will use its file name as the creative name.
              </p>
              <p className="mt-1 text-xs text-slate-500">
                You can select multiple files at once with <strong>Cmd</strong>/<strong>Shift</strong>, or pick files in several rounds and they will be appended.
              </p>
              {files.length > 0 && (
                <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
                      {files.length} selected
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setFiles([]);
                        if (fileInputRef.current) fileInputRef.current.value = '';
                      }}
                      className="text-xs font-medium text-slate-600 hover:text-slate-800"
                    >
                      Clear
                    </button>
                  </div>
                  <div className="max-h-48 space-y-1 overflow-y-auto text-sm text-slate-700">
                    {files.map(file => (
                      <div key={`${file.name}-${file.size}-${file.lastModified}`} className="flex items-center justify-between gap-3">
                        <span className="truncate">{file.name}</span>
                        <span className="shrink-0 text-xs text-slate-500">
                          {(file.size / 1024 / 1024).toFixed(2)} MB
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {status && (
          <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">
            <div className="font-medium">{status}</div>
            {loading && (
              <div className="mt-3 space-y-3">
                <div>
                  <div className="mb-1 flex items-center justify-between text-xs text-blue-700">
                    <span>Overall progress</span>
                    <span>{overallProgress}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-blue-100">
                    <div
                      className="h-full rounded-full bg-blue-600 transition-all"
                      style={{ width: `${overallProgress}%` }}
                    />
                  </div>
                </div>
                {currentFileName && (
                  <div>
                    <div className="mb-1 flex items-center justify-between text-xs text-blue-700">
                      <span className="truncate pr-3">Uploading {currentFileName}</span>
                      <span>{currentFileProgress}%</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-blue-100">
                      <div
                        className="h-full rounded-full bg-indigo-600 transition-all"
                        style={{ width: `${currentFileProgress}%` }}
                      />
                    </div>
                  </div>
                )}
                {currentProcessingName && (
                  <div>
                    <div className="mb-1 flex items-center justify-between text-xs text-blue-700">
                      <span className="truncate pr-3">Transcoding / publishing {currentProcessingName}</span>
                      <span>{currentProcessingProgress}%</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-blue-100">
                      <div
                        className="h-full rounded-full bg-violet-600 transition-all"
                        style={{ width: `${currentProcessingProgress}%` }}
                      />
                    </div>
                    {currentProcessingEta && (
                      <div className="mt-1 text-[11px] text-blue-600">{currentProcessingEta}</div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={() => navigate('/creatives')}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:bg-indigo-400"
          >
            {loading ? 'Uploading…' : 'Upload and Publish'}
          </button>
        </div>
      </form>
    </div>
  );
}
