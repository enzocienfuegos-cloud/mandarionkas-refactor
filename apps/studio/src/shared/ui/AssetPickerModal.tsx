import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import type { AssetRecord } from '../../assets/types';
import { resolveAssetPreviewUrl } from '../../assets/policy';
import { Button } from './Button';

type AssetPickerModalProps = {
  assets: AssetRecord[];
  title: string;
  onSelect: (asset: AssetRecord) => void;
  onClose: () => void;
};

export function AssetPickerModal({ assets, title, onSelect, onClose }: AssetPickerModalProps): JSX.Element | null {
  const [query, setQuery] = useState('');
  const filteredAssets = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return assets;
    return assets.filter((asset) => asset.name.toLowerCase().includes(normalizedQuery));
  }, [assets, query]);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div className="asset-library-modal-shell" onClick={onClose}>
      <div
        className="asset-library-browser"
        onClick={(event) => event.stopPropagation()}
        style={{ width: 'min(920px, calc(100vw - 36px))', height: 'min(82vh, 720px)', gridTemplateRows: '56px minmax(0, 1fr)' }}
      >
        <div className="asset-library-browser-header">
          <div style={{ display: 'grid', gap: 2 }}>
            <strong>{title}</strong>
            <small className="muted">{filteredAssets.length} assets disponibles</small>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>Close</Button>
        </div>
        <div className="asset-library-browser-main" style={{ gridTemplateRows: 'auto minmax(0, 1fr)' }}>
          <div className="asset-library-browser-controls" style={{ justifyContent: 'space-between' }}>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search assets"
              style={{ maxWidth: 280 }}
            />
          </div>
          <div style={{ overflow: 'auto' }}>
            <div className="asset-browser-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))' }}>
              {filteredAssets.map((asset) => {
                const previewUrl = resolveAssetPreviewUrl(asset);
                return (
                  <button
                    key={asset.id}
                    type="button"
                    className="asset-folder-card"
                    style={{ minHeight: 210, display: 'grid', alignContent: 'start', padding: 10, gap: 10 }}
                    onClick={() => onSelect(asset)}
                  >
                    <div className="inspector-preview-frame" style={{ width: '100%', minHeight: 128 }}>
                      {asset.kind === 'video' ? (
                        <video src={previewUrl} muted playsInline preload="metadata" className="inspector-preview-media" />
                      ) : (
                        <img src={previewUrl} alt={asset.name} decoding="async" loading="lazy" className="inspector-preview-media" />
                      )}
                    </div>
                    <div style={{ display: 'grid', gap: 2, textAlign: 'left' }}>
                      <strong className="asset-folder-name" style={{ whiteSpace: 'normal' }}>{asset.name}</strong>
                      <small className="muted">{asset.kind}</small>
                    </div>
                  </button>
                );
              })}
            </div>
            {!filteredAssets.length ? <small className="muted">No assets match this search.</small> : null}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
