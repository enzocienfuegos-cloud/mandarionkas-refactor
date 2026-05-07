import React, { useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Input, Kicker, Panel, Select } from '../system';
import { buildFileKey, normalizeHttpUrl, ACCEPTED_EXTENSIONS } from './creative-upload/utils';
import { useCreativeUploadWorkspace } from './creative-upload/useCreativeUploadWorkspace';

export default function CreativeUpload() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const {
    sourceKind,
    files,
    clickUrlsByFileKey,
    detectedClickUrls,
    detectingFileKeys,
    status,
    error,
    loading,
    currentFileName,
    currentFileProgress,
    currentProcessingName,
    currentProcessingProgress,
    currentProcessingEta,
    currentProcessingMessage,
    overallProgress,
    workspaces,
    workspaceId,
    setWorkspaceId,
    setSourceKindAndReset,
    mergeFiles,
    clearFiles,
    setClickUrlForFile,
    handleSubmit,
  } = useCreativeUploadWorkspace({
    onComplete: () => navigate('/creatives'),
  });

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Kicker>Creatives</Kicker>
        <h1 className="mt-3 text-2xl font-semibold text-[color:var(--dusk-text-primary)]">Upload Creatives</h1>
        <p className="mt-1 text-sm text-[color:var(--dusk-text-muted)]">
          Upload HTML5 zip banners or MP4 videos and publish them directly into the creative catalog for serving.
        </p>
      </div>

      <Panel as="form" onSubmit={handleSubmit} className="space-y-6 rounded-2xl">
        <div className="space-y-6">
          <div className="grid gap-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] xl:items-start">
            <div className="space-y-2">
              <label className="block text-sm font-medium text-[color:var(--dusk-text-secondary)]">Client</label>
              <Select
                value={workspaceId}
                onChange={event => setWorkspaceId(event.target.value)}
                disabled={loading}
                options={[
                  { value: '', label: 'Select a client' },
                  ...workspaces.map(workspace => ({ value: workspace.id, label: workspace.name })),
                ]}
              />
              <div className="flex justify-start">
                <Button
                  onClick={() => navigate('/clients')}
                  disabled={loading}
                  variant="ghost"
                  size="sm"
                  className="shrink-0"
                >
                  New client
                </Button>
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <label className="mb-2 block text-sm font-medium text-[color:var(--dusk-text-secondary)]">Creative Files</label>
                <div className="rounded-xl border border-[color:var(--dusk-border-default)] bg-surface-1 p-3">
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
                    className="block w-full rounded-lg border border-[color:var(--dusk-border-default)] bg-surface-1 px-3 py-2 text-sm text-[color:var(--dusk-text-secondary)] file:mr-3 file:rounded-md file:border-0 file:bg-surface-muted file:px-3 file:py-2 file:text-sm file:font-medium"
                  />
                </div>
                <p className="mt-2 text-xs text-[color:var(--dusk-text-muted)]">
                  Accepted: {ACCEPTED_EXTENSIONS[sourceKind]} · each creative will use its file name as the creative name.
                </p>
                <p className="mt-1 text-xs text-[color:var(--dusk-text-muted)]">
                  You can select multiple files at once with <strong>Cmd</strong>/<strong>Shift</strong>, or pick files in several rounds and they will be appended.
                </p>
              </div>
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-[color:var(--dusk-text-secondary)]">Source Type</label>
            <div className="grid gap-3 lg:grid-cols-2">
              <Button
                onClick={() => {
                  setSourceKindAndReset('html5_zip');
                  if (fileInputRef.current) fileInputRef.current.value = '';
                }}
                variant="secondary"
                className={`h-auto justify-start rounded-xl px-4 py-3 text-left ${sourceKind === 'html5_zip' ? 'border-brand-500 bg-[color:var(--dusk-status-info-bg)] text-text-brand' : 'text-[color:var(--dusk-text-secondary)] hover:bg-surface-hover'}`}
              >
                <div className="space-y-1">
                  <div className="font-medium text-[color:var(--dusk-text-primary)]">HTML5 ZIP</div>
                  <div className="text-sm leading-6 text-[color:var(--dusk-text-muted)]">
                    Publishes `index.html` and all packaged assets to hosted display creative artifacts.
                  </div>
                </div>
              </Button>
              <Button
                onClick={() => {
                  setSourceKindAndReset('video_mp4');
                  if (fileInputRef.current) fileInputRef.current.value = '';
                }}
                variant="secondary"
                className={`h-auto justify-start rounded-xl px-4 py-3 text-left ${sourceKind === 'video_mp4' ? 'border-brand-500 bg-[color:var(--dusk-status-info-bg)] text-text-brand' : 'text-[color:var(--dusk-text-secondary)] hover:bg-surface-hover'}`}
              >
                <div className="space-y-1">
                  <div className="font-medium text-[color:var(--dusk-text-primary)]">Video MP4</div>
                  <div className="text-sm leading-6 text-[color:var(--dusk-text-muted)]">
                    Creates a video creative version for VAST serving as soon as publishing finishes.
                  </div>
                </div>
              </Button>
            </div>
          </div>
        </div>

        {files.length > 0 && (
          <div className="rounded-lg border border-[color:var(--dusk-border-default)] bg-surface-muted p-3">
            <div className="mb-2 flex items-center justify-between gap-3">
              <div className="text-xs font-medium uppercase tracking-wide text-[color:var(--dusk-text-muted)]">
                {files.length} selected
              </div>
              <Button
                onClick={() => {
                  clearFiles();
                  if (fileInputRef.current) fileInputRef.current.value = '';
                }}
                variant="ghost"
                size="sm"
              >
                Clear
              </Button>
            </div>
            <div className="max-h-80 space-y-3 overflow-y-auto text-sm text-[color:var(--dusk-text-secondary)]">
              {files.map(file => (
                <div
                  key={buildFileKey(file)}
                  className="space-y-4 rounded-lg border border-[color:var(--dusk-border-default)] bg-surface-1 p-3"
                >
                  <div className="min-w-0">
                    <div className="flex items-center justify-between gap-3">
                      <span className="truncate font-medium text-[color:var(--dusk-text-primary)]">{file.name}</span>
                      <span className="shrink-0 text-xs text-[color:var(--dusk-text-muted)]">
                        {(file.size / 1024 / 1024).toFixed(2)} MB
                      </span>
                    </div>
                  </div>
                  <div className="min-w-0 rounded-lg border border-[color:var(--dusk-border-subtle)] bg-surface-muted/60 p-3">
                    <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-[color:var(--dusk-text-muted)]">
                      {sourceKind === 'video_mp4' ? 'Destination URL *' : 'Fallback destination URL'}
                    </label>
                    <Input
                      value={clickUrlsByFileKey[buildFileKey(file)] ?? ''}
                      onChange={(event) => setClickUrlForFile(file, event.target.value)}
                      placeholder="https://example.com/landing"
                    />
                    <p className="mt-1 text-[11px] text-[color:var(--dusk-text-muted)]">
                      {sourceKind === 'video_mp4'
                        ? 'Videos need a destination URL before they can be published for serving.'
                        : 'For HTML5, we auto-detect clickTag/click URL from the archive. If none is found, this fallback URL is required.'}
                    </p>
                    {sourceKind === 'html5_zip' && detectingFileKeys.includes(buildFileKey(file)) && (
                      <p className="mt-1 text-[11px] text-[color:var(--dusk-status-warning-fg)]">
                        Detecting clickTag from archive…
                      </p>
                    )}
                    {detectedClickUrls[buildFileKey(file)] && (
                      <p className="mt-1 flex items-center gap-1 text-[11px] text-[color:var(--dusk-status-success-fg)]">
                        <span>
                          clickTag auto-detected:{' '}
                          <span className="break-all font-medium">
                            {detectedClickUrls[buildFileKey(file)]}
                          </span>
                        </span>
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {status && (
          <div className="rounded-lg border border-[color:var(--dusk-status-info-border)] bg-[color:var(--dusk-status-info-bg)] px-4 py-3 text-sm text-[color:var(--dusk-status-info-fg)]">
            <div className="font-medium">{status}</div>
            {loading && (
              <div className="mt-3 space-y-3">
                <div>
                  <div className="mb-1 flex items-center justify-between text-xs text-[color:var(--dusk-status-info-fg)]">
                    <span>Overall progress</span>
                    <span>{overallProgress}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-[color:var(--dusk-status-info-border)]">
                    <div
                      className="h-full rounded-full bg-[color:var(--dusk-status-info-fg)] transition-all"
                      style={{ width: `${overallProgress}%` }}
                    />
                  </div>
                </div>
                {currentFileName && (
                  <div>
                    <div className="mb-1 flex items-center justify-between text-xs text-[color:var(--dusk-status-info-fg)]">
                      <span className="truncate pr-3">Uploading {currentFileName}</span>
                      <span>{currentFileProgress}%</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-[color:var(--dusk-status-info-border)]">
                      <div
                        className="h-full rounded-full bg-brand-500 transition-all"
                        style={{ width: `${currentFileProgress}%` }}
                      />
                    </div>
                  </div>
                )}
                {currentProcessingName && (
                  <div>
                    <div className="mb-1 flex items-center justify-between text-xs text-[color:var(--dusk-status-info-fg)]">
                      <span className="truncate pr-3">Transcoding / publishing {currentProcessingName}</span>
                      <span>{currentProcessingProgress}%</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-[color:var(--dusk-status-info-border)]">
                      <div
                        className="h-full rounded-full bg-brand-600 transition-all"
                        style={{ width: `${currentProcessingProgress}%` }}
                      />
                    </div>
                    {currentProcessingEta && (
                      <div className="mt-1 text-[11px] text-[color:var(--dusk-status-info-fg)]">{currentProcessingEta}</div>
                    )}
                    {currentProcessingMessage && (
                      <div className="mt-1 text-[11px] text-[color:var(--dusk-status-info-fg)]">{currentProcessingMessage}</div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-[color:var(--dusk-status-critical-border)] bg-[color:var(--dusk-status-critical-bg)] px-4 py-3 text-sm text-[color:var(--dusk-status-critical-fg)]">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-3">
          <Button
            type="button"
            onClick={() => navigate('/creatives')}
            variant="ghost"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            loading={loading}
          >
            {loading ? 'Uploading…' : 'Upload and Publish'}
          </Button>
        </div>
      </Panel>
    </div>
  );
}
