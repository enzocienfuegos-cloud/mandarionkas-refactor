import { useEffect, useMemo, useState } from 'react';
import { assetHasSourceUrl } from '../../assets/policy';
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
  const { updateWidgetProps, updateWidgetFrame } = useWidgetActions();
  const canvas = useStudioStore((state) => state.document.canvas);
  const assets = useImageAssets();
  const targetChannel = useStudioStore((state) => state.document.metadata.release.targetChannel);
  const currentSrc = String(widget.props.src ?? '').trim();
  const linkedAsset = useMemo(() => {
    const explicitAssetId = String(widget.props.assetId ?? '').trim();
    if (explicitAssetId) return assets.find((asset) => asset.id === explicitAssetId);
    return assets.find((asset) => assetHasSourceUrl(asset, currentSrc, targetChannel));
  }, [assets, currentSrc, targetChannel, widget.props.assetId]);
  const hasImage = currentSrc.length > 0;
  const imageTitle = linkedAsset?.name ?? (hasImage ? 'Selected image' : 'No image selected');

  return (
    <section className="section section-premium">
      <h3>Image source</h3>
      <div className="field-stack">
        {hasImage ? (
          <div className="asset-detail-card">
            <div className="meta-line asset-detail-head">
              <div className="asset-detail-title">
                <strong>{imageTitle}</strong>
                <small>{linkedAsset ? 'Linked from the asset library.' : 'Attached to this widget.'}</small>
              </div>
            </div>
            <div className="asset-detail-preview">
              <img className="asset-detail-img" src={currentSrc} alt={imageTitle} />
            </div>
          </div>
        ) : (
          <small className="muted">No image selected yet. Choose one from the asset library.</small>
        )}
        <div className="asset-inline-actions">
          <Button size="sm" className="left-button compact-action" onClick={requestOpenAssetLibrary}>
            {hasImage ? 'Change image' : 'Choose image'}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="compact-action"
            disabled={!hasImage}
            onClick={() => updateWidgetProps(widget.id, { assetId: '', src: '', alt: '' })}
          >
            Remove image
          </Button>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="compact-action"
          title="Resize and reposition this widget to cover the full canvas"
          onClick={() => updateWidgetFrame(widget.id, { x: 0, y: 0, width: canvas.width, height: canvas.height, rotation: 0 })}
        >
          Fit to canvas
        </Button>
      </div>
    </section>
  );
}
