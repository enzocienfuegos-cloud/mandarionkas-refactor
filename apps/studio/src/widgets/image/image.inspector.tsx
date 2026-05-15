import { useEffect, useMemo, useState } from 'react';
import { assetHasSourceUrl, resolveAssetDeliveryUrl } from '../../assets/policy';
import type { AssetRecord } from '../../assets/types';
import { useStudioStore } from '../../core/store/use-studio-store';
import type { WidgetNode } from '../../domain/document/types';
import { useWidgetActions } from '../../hooks/use-studio-actions';
import { usePlatformSnapshot } from '../../platform/runtime';
import { listAssets } from '../../repositories/asset';
import { subscribeToAssetLibraryChanges } from '../../repositories/asset/events';
import { requestOpenAssetLibrary } from '../../shared/asset-library-events';
import { Button } from '../../shared/ui/Button';

function useImageAssets(): AssetRecord[] {
  const platform = usePlatformSnapshot();
  const [assets, setAssets] = useState<AssetRecord[]>([]);

  useEffect(() => {
    if (!platform.session.isAuthenticated || !platform.session.sessionId) {
      setAssets([]);
      return;
    }

    let cancelled = false;
    const syncAssets = () => {
      void listAssets()
        .then((records) => {
          if (!cancelled) setAssets(records.filter((asset) => asset.kind === 'image'));
        })
        .catch(() => {
          if (!cancelled) setAssets([]);
        });
    };

    syncAssets();
    const unsubscribe = subscribeToAssetLibraryChanges(syncAssets);
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [platform.session.isAuthenticated, platform.session.sessionId]);

  return assets;
}

export function ImageInspector({ widget }: { widget: WidgetNode }): JSX.Element {
  const { updateWidgetProps } = useWidgetActions();
  const assets = useImageAssets();
  const targetChannel = useStudioStore((state) => state.document.metadata.release.targetChannel);
  const linkedAssetId = useMemo(() => {
    const explicitAssetId = String(widget.props.assetId ?? '').trim();
    if (explicitAssetId) return explicitAssetId;
    const currentSrc = String(widget.props.src ?? '').trim();
    return assets.find((asset) => assetHasSourceUrl(asset, currentSrc, targetChannel))?.id ?? '';
  }, [assets, targetChannel, widget.props.assetId, widget.props.src]);

  return (
    <section className="section section-premium">
      <h3>Image source</h3>
      <div className="field-stack">
        <div>
          <label>Source URL</label>
          <input
            value={String(widget.props.src ?? '')}
            placeholder="https://.../image.jpg"
            onChange={(event) => updateWidgetProps(widget.id, { src: event.target.value, assetId: '' })}
          />
        </div>
        <div>
          <label>Asset library</label>
          <div className="asset-inline-actions">
            <select
              value={linkedAssetId}
              onChange={(event) => {
                const asset = assets.find((item) => item.id === event.target.value);
                updateWidgetProps(
                  widget.id,
                  asset
                    ? {
                        assetId: asset.id,
                        src: resolveAssetDeliveryUrl(asset, targetChannel, asset.qualityPreference ?? 'auto'),
                        assetQualityPreference: asset.qualityPreference ?? 'auto',
                        alt: asset.name,
                      }
                    : { assetId: '', src: '' },
                );
              }}
            >
              <option value="">No linked asset</option>
              {assets.map((asset) => <option key={asset.id} value={asset.id}>{asset.name}</option>)}
            </select>
            <Button size="sm" className="left-button compact-action" onClick={requestOpenAssetLibrary}>Open library</Button>
          </div>
        </div>
        <div>
          <label>Alt text</label>
          <input value={String(widget.props.alt ?? '')} onChange={(event) => updateWidgetProps(widget.id, { alt: event.target.value })} />
        </div>
      </div>
    </section>
  );
}
