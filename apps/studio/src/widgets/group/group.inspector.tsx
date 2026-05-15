import { useEffect, useState } from 'react';
import { assetHasSourceUrl } from '../../assets/policy';
import type { AssetRecord } from '../../assets/types';
import { useStudioStore } from '../../core/store/use-studio-store';
import type { ReleaseTarget, WidgetNode } from '../../domain/document/types';
import { useWidgetActions } from '../../hooks/use-studio-actions';
import { usePlatformSnapshot } from '../../platform/runtime';
import { listAssets } from '../../repositories/asset';
import { subscribeToAssetLibraryChanges } from '../../repositories/asset/events';
import { requestOpenAssetLibrary } from '../../shared/asset-library-events';
import { Button } from '../../shared/ui/Button';

function resolveLinkedImageAsset(assets: AssetRecord[], assetId: string, imageUrl: string, targetChannel: ReleaseTarget): AssetRecord | undefined {
  return assets.find((asset) => asset.id === assetId)
    ?? assets.find((asset) => assetHasSourceUrl(asset, imageUrl, targetChannel));
}

function GroupScratchImageSlot({
  imageUrl,
  asset,
  onChoose,
  onClear,
}: {
  imageUrl: string;
  asset?: AssetRecord;
  onChoose: () => void;
  onClear: () => void;
}): JSX.Element {
  return (
    <div className="field-stack">
      <label>Scratch cover image</label>
      {imageUrl ? (
        <div className="asset-detail-card">
          <div className="asset-detail-preview">
            <img className="asset-detail-img" src={imageUrl} alt={asset?.name ?? 'Scratch cover'} />
          </div>
          <div className="meta-line asset-detail-head">
            <div className="asset-detail-title">
              <strong>{asset?.name ?? 'Selected image'}</strong>
              <small>{imageUrl}</small>
            </div>
          </div>
        </div>
      ) : (
        <small className="muted">No scratch cover image selected yet.</small>
      )}
      <div className="asset-inline-actions">
        <Button size="sm" className="left-button compact-action" onClick={onChoose}>
          Choose from library
        </Button>
        <Button variant="ghost" size="sm" className="compact-action" onClick={onClear} disabled={!imageUrl}>
          Clear
        </Button>
      </div>
    </div>
  );
}

export function GroupInspector({ widget }: { widget: WidgetNode }): JSX.Element {
  const widgetActions = useWidgetActions();
  const platform = usePlatformSnapshot();
  const targetChannel = useStudioStore((state) => state.document.metadata.release.targetChannel) as ReleaseTarget;
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

  const scratchEnabled = Boolean(widget.props.scratchEnabled);
  const beforeImage = String(widget.props.beforeImage ?? '').trim();
  const linkedBeforeAsset = resolveLinkedImageAsset(
    assets,
    String(widget.props.scratchCoverAssetId ?? widget.props.beforeAssetId ?? '').trim(),
    beforeImage,
    targetChannel,
  );

  return (
    <section className="section section-premium">
      <h3>Group</h3>
      <div className="field-stack">
        <div>
          <label>Title</label>
          <input value={String(widget.props.title ?? '')} onChange={(event) => widgetActions.updateWidgetProps(widget.id, { title: event.target.value })} />
        </div>
        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={scratchEnabled}
            onChange={(event) => widgetActions.updateWidgetProps(widget.id, { scratchEnabled: event.target.checked })}
          />
          Enable scratch cover
        </label>
        {scratchEnabled ? (
          <>
            <div>
              <label>Cover label</label>
              <input
                value={String(widget.props.coverLabel ?? 'Scratch to reveal')}
                onChange={(event) => widgetActions.updateWidgetProps(widget.id, { coverLabel: event.target.value })}
              />
            </div>
            <GroupScratchImageSlot
              imageUrl={beforeImage}
              asset={linkedBeforeAsset}
              onChoose={() => requestOpenAssetLibrary({ target: 'group-scratch-cover' })}
              onClear={() => widgetActions.updateWidgetProps(widget.id, {
                scratchCoverAssetId: '',
                beforeAssetId: '',
                beforeImage: '',
              })}
            />
            <div>
              <label>Cover blur</label>
              <input type="number" step="1" value={String(widget.props.coverBlur ?? 0)} onChange={(event) => widgetActions.updateWidgetProps(widget.id, { coverBlur: Number(event.target.value) })} />
            </div>
            <div>
              <label>Scratch radius</label>
              <input type="number" step="1" value={String(widget.props.scratchRadius ?? 22)} onChange={(event) => widgetActions.updateWidgetProps(widget.id, { scratchRadius: Number(event.target.value) })} />
            </div>
            <div>
              <label>Auto reveal %</label>
              <input
                type="number"
                step="1"
                min="0"
                max="100"
                value={String(widget.props.autoRevealThresholdPercent ?? 10)}
                onChange={(event) => widgetActions.updateWidgetProps(widget.id, { autoRevealThresholdPercent: Number(event.target.value) })}
              />
            </div>
            <small className="muted">
              This group now behaves like a scratch cover over its child layers. Text, CTA, and images inside the group remain real layers underneath.
            </small>
          </>
        ) : null}
      </div>
    </section>
  );
}
