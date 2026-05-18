import { useEffect, useMemo, useState } from 'react';
import type { AssetRecord, AssetKind } from '../../assets/types';
import { resolveAssetDeliveryUrl, resolveAssetPreviewUrl } from '../../assets/policy';
import { useStudioStore } from '../../core/store/use-studio-store';
import { listAssets } from '../../repositories/asset';
import { AssetPickerModal } from './AssetPickerModal';
import { Button } from './Button';

export type AssetPickerAccept = Extract<AssetKind, 'image' | 'video'> | 'any';

type AssetPickerButtonProps = {
  label: string;
  assetId?: string;
  imageUrl?: string;
  accept: AssetPickerAccept;
  assets?: AssetRecord[];
  emptyLabel?: string;
  onChange: (asset: AssetRecord) => void;
  onClear: () => void;
};

function matchesAccept(asset: AssetRecord, accept: AssetPickerAccept): boolean {
  return accept === 'any' || asset.kind === accept;
}

export function AssetPickerButton({
  label,
  assetId,
  imageUrl,
  accept,
  assets,
  emptyLabel = 'No asset selected.',
  onChange,
  onClear,
}: AssetPickerButtonProps): JSX.Element {
  const [open, setOpen] = useState(false);
  const [localAssets, setLocalAssets] = useState<AssetRecord[]>([]);
  const targetChannel = useStudioStore((state) => state.document.metadata.release.targetChannel);

  useEffect(() => {
    if (assets) return undefined;
    let cancelled = false;
    void listAssets()
      .then((records) => {
        if (!cancelled) setLocalAssets(records.filter((asset) => matchesAccept(asset, accept)));
      })
      .catch(() => {
        if (!cancelled) setLocalAssets([]);
      });
    return () => {
      cancelled = true;
    };
  }, [accept, assets]);

  const availableAssets = useMemo(
    () => (assets ?? localAssets).filter((asset) => matchesAccept(asset, accept)),
    [accept, assets, localAssets],
  );
  const resolvedAsset = useMemo(
    () => availableAssets.find((asset) => asset.id === assetId),
    [availableAssets, assetId],
  );
  const previewUrl = imageUrl || (resolvedAsset ? resolveAssetPreviewUrl(resolvedAsset, targetChannel) : '');
  const hasPreview = previewUrl.trim().length > 0;

  return (
    <div className="field-stack">
      <label>{label}</label>
      {hasPreview ? (
        <div className="asset-detail-card">
          <div className="meta-line asset-detail-head">
            <div className="asset-detail-title">
              <strong>{resolvedAsset?.name ?? 'Selected asset'}</strong>
              <small>{resolvedAsset ? 'Linked from the asset library.' : 'Attached to this field.'}</small>
            </div>
          </div>
          <div className="asset-detail-preview">
            {accept === 'video' ? (
              <video className="asset-detail-img" src={previewUrl} muted playsInline preload="metadata" />
            ) : (
              <img className="asset-detail-img" src={previewUrl} alt={resolvedAsset?.name ?? label} />
            )}
          </div>
        </div>
      ) : (
        <small className="muted">{emptyLabel}</small>
      )}
      <div className="asset-inline-actions">
        <Button size="sm" className="left-button compact-action" onClick={() => setOpen(true)}>
          {hasPreview ? 'Change asset' : 'Choose from library'}
        </Button>
        <Button variant="ghost" size="sm" className="compact-action" onClick={onClear} disabled={!hasPreview}>
          Remove asset
        </Button>
      </div>
      {open ? (
        <AssetPickerModal
          assets={availableAssets}
          title={label}
          onSelect={(asset) => {
            onChange({
              ...asset,
              src: resolveAssetDeliveryUrl(asset, targetChannel, asset.qualityPreference ?? 'auto'),
              posterSrc: asset.derivatives?.poster?.src ?? asset.posterSrc,
            });
            setOpen(false);
          }}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </div>
  );
}
