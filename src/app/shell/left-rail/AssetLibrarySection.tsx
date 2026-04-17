import { useEffect, useMemo, useState, type Dispatch, type DragEvent, type SetStateAction } from 'react';
import { describeAssetSource } from '../../../assets/pipeline';
import type { AssetRecord } from '../../../assets/types';
import type { LeftRailController } from './use-left-rail-controller';
import { clearAssetLibraryDragPayload, createAssetLibraryDragPayload, writeAssetLibraryDragPayload } from '../../../canvas/stage/asset-library-drag';
import { resolveFontAssetFamily } from '../../../assets/FontAssetRuntime';

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

function assetPreview(asset: AssetRecord): JSX.Element {
  if (asset.kind === 'image') return <img src={asset.src} alt={asset.name} className="asset-preview-media" />;
  if (asset.kind === 'video') return <video src={asset.src} poster={asset.posterSrc} muted className="asset-preview-media" />;
  if (asset.kind === 'font') return <div className="asset-preview-fallback" style={{ fontFamily: resolveFontAssetFamily(asset), fontSize: 28, fontWeight: 700 }}>Aa</div>;
  return <div className="asset-preview-fallback">FILE</div>;
}

function useRenameDraft(asset?: AssetRecord): [string, Dispatch<SetStateAction<string>>] {
  const [value, setValue] = useState(asset?.name ?? '');
  useEffect(() => {
    setValue(asset?.name ?? '');
  }, [asset?.id, asset?.name]);
  return [value, setValue];
}

export function AssetLibrarySection({ controller }: { controller: LeftRailController }): JSX.Element {
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
    selectedAssetId,
    setSelectedAssetId,
    primaryWidget,
    selectedWidgetAcceptsAsset,
    assignAsset,
    deleteAsset,
    renameSelectedAsset,
    canCreateAssets,
    canDeleteAssets,
    canUpdateAssets,
    assetBusy,
    assetError,
    assetCounts,
  } = controller;
  const [isDropActive, setIsDropActive] = useState(false);
  const [renameDraft, setRenameDraft] = useRenameDraft(selectedAsset);

  const compatibleWithSelection = useMemo(() => {
    if (!selectedAsset || !primaryWidget) return false;
    if (primaryWidget.type === 'video-hero') return selectedAsset.kind === 'video';
    if (['text', 'cta', 'badge'].includes(primaryWidget.type)) return selectedAsset.kind === 'font';
    return selectedAsset.kind === 'image';
  }, [primaryWidget, selectedAsset]);

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
        <div className="meta-line" style={{ justifyContent: 'space-between' }}>
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
        <div className="field-stack" style={{ marginTop: 10 }}>
          <input placeholder="Search assets" value={assetQuery} onChange={(event) => setAssetQuery(event.target.value)} />
          <div className="asset-filter-chips">
            {([
              ['all', `All ${assetCounts.all}`],
              ['image', `Images ${assetCounts.image}`],
              ['video', `Videos ${assetCounts.video}`],
              ['font', `Fonts ${assetCounts.font}`],
              ['other', `Other ${assetCounts.other}`],
            ] as const).map(([value, label]) => (
              <button key={value} className={`chip${assetFilter === value ? ' is-active' : ''}`} onClick={() => setAssetFilter(value)}>{label}</button>
            ))}
          </div>
          <div style={{ display: 'grid', gap: 8, gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
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
            <button className="left-button compact-action" onClick={() => void addAssetFromUrl()} disabled={!canCreateAssets || assetBusy}>Add URL asset</button>
            <button className="left-button compact-action" onClick={() => fileInputRef.current?.click()} disabled={!canCreateAssets || assetBusy}>Upload file</button>
          </div>
          {assetBusy ? <small className="muted">Processing asset…</small> : null}
          {assetError ? <small className="muted" role="alert">{assetError}</small> : null}

          {filteredAssets.length ? (
            <div className="asset-library-grid">
              {filteredAssets.map((asset) => {
                const isSelected = asset.id === (selectedAssetId || selectedAsset?.id);
                const dimensions = formatAssetDimensions(asset.width, asset.height);
                const durationLabel = formatAssetDuration(asset.durationMs);
                return (
                  <div
                    key={asset.id}
                    draggable={asset.kind === 'image' || asset.kind === 'video'}
                    role="button"
                    tabIndex={0}
                    className={`asset-tile${isSelected ? ' is-selected' : ''} ${(asset.kind === 'image' || asset.kind === 'video') ? 'is-draggable' : ''}`}
                    onClick={() => setSelectedAssetId(asset.id)}
                    onDoubleClick={() => compatibleWithSelection ? assignAsset(asset) : undefined}
                    title={(asset.kind === 'image' || asset.kind === 'video') ? 'Click to select, double-click to apply, or drag to canvas' : 'Click to select or double-click to apply'}
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
                    <div className="asset-tile-preview">{assetPreview(asset)}</div>
                    <div className="asset-tile-meta">
                      <strong title={asset.name}>{asset.name}</strong>
                      <small className="muted">{asset.kind}</small>
                      <div className="asset-tile-badges">
                        {dimensions ? <span className="pill">{dimensions}</span> : null}
                        {durationLabel ? <span className="pill">{durationLabel}</span> : null}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : <small className="muted">No assets saved yet.</small>}

          {selectedAsset ? (() => {
            const dimensions = formatAssetDimensions(selectedAsset.width, selectedAsset.height);
            const sizeLabel = formatAssetMetaBytes(selectedAsset.sizeBytes);
            const durationLabel = formatAssetDuration(selectedAsset.durationMs);
            return (
              <div className="asset-detail-card">
                <div className="meta-line" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ minWidth: 0 }}>
                    <strong style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis' }}>Selected asset</strong>
                    <small className="muted">{describeAssetSource(selectedAsset.sourceType, selectedAsset.storageMode)} · {selectedAsset.accessScope ?? 'client'}</small>
                  </div>
                  <span className="pill">{new Date(selectedAsset.createdAt).toLocaleDateString()}</span>
                </div>
                <div className="asset-detail-preview">{assetPreview(selectedAsset)}</div>
                <div className="field-stack" style={{ marginTop: 10 }}>
                  <div>
                    <label>Name</label>
                    <div className="asset-inline-actions">
                      <input value={renameDraft} onChange={(event) => setRenameDraft(event.target.value)} />
                      <button className="chip" disabled={!canUpdateAssets || !renameDraft.trim() || renameDraft.trim() === selectedAsset.name} onClick={() => void renameSelectedAsset(renameDraft)}>Save</button>
                    </div>
                  </div>
                  <div className="meta-line" style={{ gap: 8, flexWrap: 'wrap' }}>
                    <span className="pill">{selectedAsset.kind}</span>
                    {dimensions ? <span className="pill">{dimensions}</span> : null}
                    {sizeLabel ? <span className="pill">{sizeLabel}</span> : null}
                    {durationLabel ? <span className="pill">{durationLabel}</span> : null}
                    {selectedAsset.originUrl ? <span className="pill">Remote source</span> : null}
                  </div>
                  <div className="rail-action-grid">
                    <button className="left-button compact-action" disabled={!selectedWidgetAcceptsAsset || !compatibleWithSelection} onClick={() => assignAsset(selectedAsset)}>{primaryWidget?.type === 'video-hero' ? 'Use on selected video' : ['text', 'cta', 'badge'].includes(primaryWidget?.type ?? '') ? 'Use on selected text' : 'Use on selected image'}</button>
                    <button className="left-button compact-action" disabled={!canDeleteAssets} onClick={() => { void deleteAsset(selectedAsset.id); }}>Delete</button>
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
