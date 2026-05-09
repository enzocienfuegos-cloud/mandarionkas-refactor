import { useEffect, useMemo, useState, type CSSProperties, type Dispatch, type DragEvent, type SetStateAction } from 'react';
import { resolveAssetQualityPreference, selectAssetDerivative } from '../../../assets/policy';
import { describeAssetSource } from '../../../assets/pipeline';
import type { AssetQualityPreference, AssetRecord } from '../../../assets/types';
import { resolveFontAssetFamily } from '../../../assets/font-family';
import type { LeftRailController } from './use-left-rail-controller';
import { clearAssetLibraryDragPayload, createAssetLibraryDragPayload, writeAssetLibraryDragPayload } from '../../../canvas/stage/asset-library-drag';
import { Tooltip } from '../../../shared/ui/Tooltip';
import { Button } from '../../../shared/ui/Button';
import { acceptsAssetKind, getAcceptedAssetKinds } from '../../../widgets/registry/widget-definition';
import { getWidgetDefinition } from '../../../widgets/registry/widget-registry';

function buildFontAssetPreviewStyle(asset: AssetRecord): CSSProperties {
  return { fontFamily: resolveFontAssetFamily(asset) };
}

function buildAssetDerivativeProgressStyle(progress: number): CSSProperties {
  return { width: `${progress}%` };
}

function formatAssetMetaBytes(sizeBytes?: number): string | null {
  if (!sizeBytes || Number.isNaN(sizeBytes)) return null;
  if (sizeBytes < 1024) return `${sizeBytes} B`;
  if (sizeBytes < 1024 * 1024) return `${(sizeBytes / 1024).toFixed(1)} KB`;
  return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatAssetDimensions(width?: number, height?: number): string | null {
  if (!width || !height) return null;
  return `${width}×${height}`;
}

function formatAssetDuration(durationMs?: number): string | null {
  if (!durationMs || Number.isNaN(durationMs)) return null;
  const seconds = Math.max(1, Math.round(durationMs / 1000));
  const minutes = Math.floor(seconds / 60);
  const remaining = seconds % 60;
  return minutes ? `${minutes}:${remaining.toString().padStart(2, '0')}` : `${seconds}s`;
}

function formatProcessingLabel(asset: AssetRecord): string | null {
  if (!asset.processingStatus) return null;
  return asset.processingStatus.replace(/-/g, ' ');
}

function describeAvailableDerivatives(asset: AssetRecord): string[] {
  const labels: string[] = [];
  if (asset.derivatives?.low?.src) labels.push('low');
  if (asset.derivatives?.mid?.src) labels.push('mid');
  if (asset.derivatives?.high?.src) labels.push('high');
  if (asset.derivatives?.thumbnail?.src) labels.push('thumb');
  if (asset.derivatives?.poster?.src) labels.push('poster');
  return labels;
}

function describeExpectedDerivatives(asset: AssetRecord): string[] {
  if (asset.kind === 'image' && asset.storageMode === 'object-storage') return ['low', 'mid', 'high', 'thumb'];
  if (asset.kind === 'video' && asset.storageMode === 'object-storage') return ['low', 'mid', 'high', 'poster'];
  return [];
}

function describeMissingDerivatives(asset: AssetRecord): string[] {
  const expected = describeExpectedDerivatives(asset);
  if (!expected.length) return [];
  return expected.filter((label) => {
    if (label === 'low') return !asset.derivatives?.low?.src;
    if (label === 'mid') return !asset.derivatives?.mid?.src;
    if (label === 'high') return !asset.derivatives?.high?.src;
    if (label === 'thumb') return !asset.derivatives?.thumbnail?.src;
    if (label === 'poster') return !asset.derivatives?.poster?.src;
    return false;
  });
}

function resolveDerivativeProgress(asset: AssetRecord): number | null {
  const expected = describeExpectedDerivatives(asset);
  if (!expected.length) return null;
  const available = expected.length - describeMissingDerivatives(asset).length;
  if (asset.processingStatus === 'completed') return 100;
  if (asset.processingStatus === 'failed' || asset.processingStatus === 'blocked') return Math.round((available / expected.length) * 100);
  if (asset.processingStatus === 'planned') return Math.max(10, Math.round((available / expected.length) * 100));
  if (asset.processingStatus === 'queued') return Math.max(5, Math.round((available / expected.length) * 100));
  if (asset.processingStatus === 'processing') return Math.max(20, Math.round((available / expected.length) * 100));
  return available ? Math.round((available / expected.length) * 100) : null;
}

function canReprocessAsset(asset: AssetRecord | undefined): boolean {
  if (!asset) return false;
  if (asset.storageMode !== 'object-storage') return false;
  if (asset.processingStatus !== 'blocked' && asset.processingStatus !== 'failed') return false;
  if (asset.kind === 'video') return true;
  return asset.kind === 'image' && ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'].includes(String(asset.mimeType || '').trim().toLowerCase());
}

function buildProcessingHistory(asset: AssetRecord): Array<{ label: string; at?: string; detail?: string }> {
  const items: Array<{ label: string; at?: string; detail?: string }> = [
    {
      label: 'Asset created',
      at: asset.createdAt,
      detail: asset.processingStatus ? `Current status: ${asset.processingStatus}` : undefined,
    },
  ];

  if (typeof asset.processingAttempts === 'number' && asset.processingAttempts > 0) {
    items.push({
      label: `Processing attempt ${asset.processingAttempts}`,
      at: asset.processingLastRetryAt ?? undefined,
      detail: asset.processingMessage || undefined,
    });
  }

  if (asset.processingNextRetryAt) {
    items.push({
      label: 'Next automatic retry',
      at: asset.processingNextRetryAt,
      detail: 'Scheduled by worker backoff',
    });
  }

  if (asset.processingStatus === 'completed') {
    items.push({
      label: 'Derivatives ready',
      detail: 'Remote derivatives completed successfully',
    });
  }

  if (asset.processingStatus === 'failed') {
    items.push({
      label: 'Processing failed',
      detail: asset.processingMessage || 'Retries exhausted',
    });
  }

  if (asset.processingStatus === 'blocked') {
    items.push({
      label: 'Processing blocked',
      detail: asset.processingMessage || 'Worker requirements are missing',
    });
  }

  return items;
}

function hasRemoteDerivativeReadiness(asset: AssetRecord): boolean {
  const expected = describeExpectedDerivatives(asset);
  if (!expected.length) return false;
  return describeMissingDerivatives(asset).length === 0;
}

function assetPreview(asset: AssetRecord, previewUrl: string): JSX.Element {
  if (asset.kind === 'image') return <img src={previewUrl} alt={asset.name} className="asset-preview-media" />;
  if (asset.kind === 'video') return <video src={previewUrl} poster={asset.derivatives?.poster?.src ?? asset.posterSrc} muted className="asset-preview-media" />;
  if (asset.kind === 'font') return <div className="asset-preview-fallback asset-preview-fallback--font" style={buildFontAssetPreviewStyle(asset)}>Aa</div>;
  return <div className="asset-preview-fallback">FILE</div>;
}

function useRenameDraft(asset?: AssetRecord): [string, Dispatch<SetStateAction<string>>] {
  const [value, setValue] = useState(asset?.name ?? '');
  useEffect(() => {
    setValue(asset?.name ?? '');
  }, [asset?.id, asset?.name]);
  return [value, setValue];
}

export function AssetLibrarySection({
  controller,
  onOpenLibraryModal,
}: {
  controller: LeftRailController;
  onOpenLibraryModal: () => void;
}): JSX.Element {
  const {
    assetQuery,
    setAssetQuery,
    assetFilter,
    setAssetFilter,
    assetSort,
    setAssetSort,
    assetUrl,
    setAssetUrl,
    assetName,
    setAssetName,
    assetScope,
    setAssetScope,
    fileInputRef,
    handleFileUpload,
    addAssetFromUrl,
    filteredAssets,
    selectedAsset,
    selectedAssetQuality,
    selectedAssetId,
    setSelectedAssetId,
    primaryWidget,
    selectedWidgetAcceptsAsset,
    assignAsset,
    getAssetQualityPreference,
    setAssetQualityPreference,
    resolveAssetPreviewUrl,
    deleteAsset,
    renameSelectedAsset,
    reprocessSelectedAsset,
    canCreateAssets,
    canDeleteAssets,
    canUpdateAssets,
    assetBusy,
    assetError,
    assetCounts,
    targetChannel,
  } = controller;
  const [isDropActive, setIsDropActive] = useState(false);
  const [renameDraft, setRenameDraft] = useRenameDraft(selectedAsset);

  const compatibleWithSelection = useMemo(() => {
    if (!selectedAsset || !primaryWidget) return false;
    return acceptsAssetKind(getWidgetDefinition(primaryWidget.type), selectedAsset.kind as 'image' | 'video' | 'font');
  }, [primaryWidget, selectedAsset]);

  const acceptedAssetKinds = useMemo(
    () => (primaryWidget ? getAcceptedAssetKinds(getWidgetDefinition(primaryWidget.type)) : []),
    [primaryWidget],
  );

  function onDrop(event: DragEvent<HTMLDivElement>): void {
    event.preventDefault();
    setIsDropActive(false);
    const file = event.dataTransfer.files?.[0];
    if (file) handleFileUpload(file);
  }

  return (
    <>
      <input ref={fileInputRef} type="file" accept="image/*,video/*,.ttf,.otf,.woff,.woff2,font/*" hidden onChange={(event) => { const file = event.target.files?.[0]; if (file) handleFileUpload(file); event.currentTarget.value = ''; }} />
      <div className="left-card left-card--section">
        <div className="meta-line meta-line--between">
          <strong>Assets</strong>
          <span className="pill">{assetCounts.all}</span>
        </div>
        <div
          className={`asset-dropzone${isDropActive ? ' is-active' : ''}`}
          onDragOver={(event) => { event.preventDefault(); setIsDropActive(true); }}
          onDragLeave={() => setIsDropActive(false)}
          onDrop={onDrop}
          role="button"
          tabIndex={0}
          onClick={() => fileInputRef.current?.click()}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              fileInputRef.current?.click();
            }
          }}
        >
          <strong>Drop images, videos, or fonts here</strong>
          <small className="muted">Upload direct to the library, then reuse them across widgets.</small>
        </div>
        <div className="field-stack section-offset-top">
          <input placeholder="Search assets" value={assetQuery} onChange={(event) => setAssetQuery(event.target.value)} />
          <div className="asset-filter-chips">
            {([
              ['all', `All ${assetCounts.all}`],
              ['image', `Images ${assetCounts.image}`],
              ['video', `Videos ${assetCounts.video}`],
              ['font', `Fonts ${assetCounts.font}`],
              ['other', `Other ${assetCounts.other}`],
            ] as const).map(([value, label]) => (
              <Button key={value} variant="ghost" size="sm" className={`chip${assetFilter === value ? ' is-active' : ''}`} onClick={() => setAssetFilter(value)}>{label}</Button>
            ))}
          </div>
          {assetCounts.processing ? <small className="muted">{assetCounts.processing} asset{assetCounts.processing === 1 ? '' : 's'} still processing. The library will refresh automatically.</small> : null}
          <div className="asset-settings-grid">
            <select value={assetSort} onChange={(event) => setAssetSort(event.target.value as typeof assetSort)}>
              <option value="recent">Newest first</option>
              <option value="name">Name</option>
              <option value="size">Largest files</option>
            </select>
            <select value={assetScope} onChange={(event) => setAssetScope(event.target.value as 'client' | 'private')}>
              <option value="client">Client shared</option>
              <option value="private">Private</option>
            </select>
          </div>
          <input placeholder="Paste remote asset URL" value={assetUrl} onChange={(event) => setAssetUrl(event.target.value)} />
          <input placeholder="Optional asset name" value={assetName} onChange={(event) => setAssetName(event.target.value)} />
          <div className="rail-action-grid">
            <Button className="left-button compact-action" size="sm" onClick={() => void addAssetFromUrl()} disabled={!canCreateAssets || assetBusy}>Add URL asset</Button>
            <Button className="left-button compact-action" size="sm" onClick={() => fileInputRef.current?.click()} disabled={!canCreateAssets || assetBusy}>Upload file</Button>
          </div>
          <Button className="left-button compact-action" size="sm" variant="ghost" onClick={onOpenLibraryModal}>
            Open library modal
          </Button>
          {assetBusy ? <small className="muted">Processing asset…</small> : null}
          {assetError ? <small className="muted" role="alert">{assetError}</small> : null}

          {filteredAssets.length ? (
            <div className="asset-library-grid">
              {filteredAssets.map((asset) => {
                const isSelected = asset.id === (selectedAssetId || selectedAsset?.id);
                const dimensions = formatAssetDimensions(asset.width, asset.height);
                const durationLabel = formatAssetDuration(asset.durationMs);
                const processingLabel = formatProcessingLabel(asset);
                const remoteReady = hasRemoteDerivativeReadiness(asset);
                const missingDerivatives = describeMissingDerivatives(asset);
                const derivativeProgress = resolveDerivativeProgress(asset);
                return (
                  <Tooltip
                    key={asset.id}
                    content={(asset.kind === 'image' || asset.kind === 'video') ? 'Click to select, double-click to apply, or drag to canvas' : 'Click to select or double-click to apply'}
                  >
                    <div
                      draggable={asset.kind === 'image' || asset.kind === 'video'}
                      role="button"
                      tabIndex={0}
                      className={`asset-tile${isSelected ? ' is-selected' : ''} ${(asset.kind === 'image' || asset.kind === 'video') ? 'is-draggable' : ''}`}
                      onClick={() => setSelectedAssetId(asset.id)}
                      onDoubleClick={() => compatibleWithSelection ? assignAsset(asset) : undefined}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          setSelectedAssetId(asset.id);
                        }
                      }}
                      onDragStart={(event) => {
                        if (asset.kind !== 'image' && asset.kind !== 'video') return;
                        writeAssetLibraryDragPayload(event.dataTransfer, createAssetLibraryDragPayload(asset));
                      }}
                      onDragEnd={() => {
                        clearAssetLibraryDragPayload();
                      }}
                    >
                      <div className="asset-tile-preview">{assetPreview(asset, resolveAssetPreviewUrl(asset))}</div>
                      <div className="asset-tile-meta">
                        <strong title={asset.name}>{asset.name}</strong>
                        <small className="muted">{asset.kind}</small>
                        <div className="asset-tile-badges">
                          {dimensions ? <span className="pill">{dimensions}</span> : null}
                          {durationLabel ? <span className="pill">{durationLabel}</span> : null}
                          {processingLabel ? <span className="pill">{processingLabel}</span> : null}
                          {derivativeProgress !== null ? <span className="pill">{derivativeProgress}%</span> : null}
                          {remoteReady ? <span className="pill">remote ready</span> : null}
                          {!remoteReady && missingDerivatives.length ? <span className="pill">missing tiers</span> : null}
                        </div>
                      </div>
                    </div>
                  </Tooltip>
                );
              })}
            </div>
          ) : <small className="muted">No assets saved yet.</small>}

          {selectedAsset ? (() => {
            const dimensions = formatAssetDimensions(selectedAsset.width, selectedAsset.height);
            const sizeLabel = formatAssetMetaBytes(selectedAsset.sizeBytes);
            const durationLabel = formatAssetDuration(selectedAsset.durationMs);
            const processingLabel = formatProcessingLabel(selectedAsset);
            const derivativeLabels = describeAvailableDerivatives(selectedAsset);
            const missingDerivativeLabels = describeMissingDerivatives(selectedAsset);
            const remoteReady = hasRemoteDerivativeReadiness(selectedAsset);
            const derivativeProgress = resolveDerivativeProgress(selectedAsset);
            const reprocessable = canReprocessAsset(selectedAsset);
            const processingHistory = buildProcessingHistory(selectedAsset);
            const resolvedTier = (selectedAsset.kind === 'image' || selectedAsset.kind === 'video')
              ? resolveAssetQualityPreference(selectedAsset, targetChannel, selectedAssetQuality)
              : null;
            const selectedDerivative = (selectedAsset.kind === 'image' || selectedAsset.kind === 'video')
              ? selectAssetDerivative(selectedAsset, targetChannel, selectedAssetQuality)
              : undefined;
            const selectedDerivativeSize = selectedDerivative?.sizeBytes ? formatAssetMetaBytes(selectedDerivative.sizeBytes) : null;
            return (
              <div className="asset-detail-card">
                <div className="meta-line asset-detail-head">
                  <div className="asset-detail-title">
                    <strong>Selected asset</strong>
                    <small className="muted">{describeAssetSource(selectedAsset.sourceType, selectedAsset.storageMode)} · {selectedAsset.accessScope ?? 'client'}</small>
                  </div>
                  <span className="pill">{new Date(selectedAsset.createdAt).toLocaleDateString()}</span>
                </div>
                <div className="asset-detail-preview">{assetPreview(selectedAsset, resolveAssetPreviewUrl(selectedAsset))}</div>
                <div className="field-stack section-offset-top">
                    <div>
                      <label>Name</label>
                      <div className="asset-inline-actions">
                        <input value={renameDraft} onChange={(event) => setRenameDraft(event.target.value)} />
                        <Button variant="ghost" size="sm" className="chip" disabled={!canUpdateAssets || !renameDraft.trim() || renameDraft.trim() === selectedAsset.name} onClick={() => void renameSelectedAsset(renameDraft)}>Save</Button>
                      </div>
                    </div>
                  <div className="meta-line meta-line--gap-md">
                    <span className="pill">{selectedAsset.kind}</span>
                    {dimensions ? <span className="pill">{dimensions}</span> : null}
                    {sizeLabel ? <span className="pill">{sizeLabel}</span> : null}
                    {durationLabel ? <span className="pill">{durationLabel}</span> : null}
                    {processingLabel ? <span className="pill">{processingLabel}</span> : null}
                    {selectedAsset.originUrl ? <span className="pill">Remote source</span> : null}
                    {remoteReady ? <span className="pill">Remote derivatives ready</span> : null}
                    {resolvedTier ? <span className="pill">Using {resolvedTier} for {targetChannel}</span> : null}
                  </div>
                  {selectedAsset.processingMessage ? <small className="muted">{selectedAsset.processingMessage}</small> : null}
                  {typeof selectedAsset.processingAttempts === 'number' && selectedAsset.processingAttempts > 0 ? (
                    <small className="muted">Attempts: {selectedAsset.processingAttempts}</small>
                  ) : null}
                  {selectedAsset.processingLastRetryAt ? (
                    <small className="muted">Last retry: {new Date(selectedAsset.processingLastRetryAt).toLocaleString()}</small>
                  ) : null}
                  {selectedAsset.processingNextRetryAt ? (
                    <small className="muted">Next retry: {new Date(selectedAsset.processingNextRetryAt).toLocaleString()}</small>
                  ) : null}
                  {derivativeProgress !== null ? (
                    <div className="asset-upload-progress-track" aria-label={`Derivative progress ${derivativeProgress}%`}>
                      <div className="asset-upload-progress-bar" style={buildAssetDerivativeProgressStyle(derivativeProgress)} />
                    </div>
                  ) : null}
                  {derivativeProgress !== null ? <small className="muted">Derivative progress: {derivativeProgress}%</small> : null}
                  {derivativeLabels.length ? (
                    <small className="muted">Available derivatives: {derivativeLabels.join(', ')}{selectedDerivativeSize ? ` · active ${selectedDerivativeSize}` : ''}</small>
                  ) : null}
                  {missingDerivativeLabels.length ? (
                    <small className="muted">Missing derivatives: {missingDerivativeLabels.join(', ')}</small>
                  ) : null}
                  {processingHistory.length ? (
                    <div>
                      <label>Job history</label>
                      <div className="field-stack asset-history-list">
                        {processingHistory.map((entry, index) => (
                          <div key={`${entry.label}-${entry.at ?? index}`} className="meta-line asset-history-item">
                            <div className="asset-history-copy">
                              <strong className="asset-history-label">{entry.label}</strong>
                              {entry.detail ? <small className="muted content-caption-block">{entry.detail}</small> : null}
                            </div>
                            {entry.at ? <span className="pill">{new Date(entry.at).toLocaleString()}</span> : null}
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                  {(selectedAsset.kind === 'image' || selectedAsset.kind === 'video') ? (
                    <div>
                      <label>Quality</label>
                      <div className="asset-inline-actions">
                        <select
                          value={selectedAssetQuality}
                          onChange={(event) => { void setAssetQualityPreference(selectedAsset.id, event.target.value as AssetQualityPreference); }}
                        >
                          <option value="auto">Auto</option>
                          <option value="low">Low</option>
                          <option value="mid">Mid</option>
                          <option value="high">High</option>
                        </select>
                        <span className="pill">{getAssetQualityPreference(selectedAsset)}</span>
                      </div>
                    </div>
                  ) : null}
                  <div className="rail-action-grid">
                    <Button className="left-button compact-action" size="sm" disabled={!selectedWidgetAcceptsAsset || !compatibleWithSelection} onClick={() => assignAsset(selectedAsset)}>{primaryWidget?.type === 'video-hero' || primaryWidget?.type === 'interactive-video' ? 'Use on selected video' : primaryWidget?.type === 'image-carousel' ? 'Add to carousel' : primaryWidget?.type === 'interactive-gallery' ? 'Add to gallery' : primaryWidget?.type === 'shoppable-sidebar' ? 'Add product' : acceptedAssetKinds.includes('font') ? 'Use on selected text' : 'Use on selected image'}</Button>
                    {reprocessable ? (
                      <Button className="left-button compact-action" size="sm" disabled={!canUpdateAssets || assetBusy} onClick={() => { void reprocessSelectedAsset(); }}>
                        Retry processing
                      </Button>
                    ) : null}
                    <Button variant="danger" className="left-button compact-action" size="sm" disabled={!canDeleteAssets} onClick={() => { void deleteAsset(selectedAsset.id); }}>Delete</Button>
                  </div>
                </div>
              </div>
            );
          })() : null}
        </div>
      </div>
    </>
  );
}
