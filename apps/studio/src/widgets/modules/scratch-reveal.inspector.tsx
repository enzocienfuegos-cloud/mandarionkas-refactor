import { useEffect, useState } from 'react';
import { assetHasSourceUrl } from '../../assets/policy';
import type { ReleaseTarget } from '../../domain/document/types';
import type { WidgetNode } from '../../domain/document/types';
import type { AssetRecord } from '../../assets/types';
import { useStudioStore } from '../../core/store/use-studio-store';
import { listAssets } from '../../repositories/asset';
import { subscribeToAssetLibraryChanges } from '../../repositories/asset/events';
import { usePlatformSnapshot } from '../../platform/runtime';
import { useWidgetActions } from '../../hooks/use-studio-actions';
import { Button } from '../../shared/ui/Button';
import { requestOpenAssetLibrary } from '../../shared/asset-library-events';

function resolveLinkedImageAsset(assets: AssetRecord[], assetId: string, imageUrl: string, targetChannel: ReleaseTarget): AssetRecord | undefined {
  return assets.find((asset) => asset.id === assetId)
    ?? assets.find((asset) => assetHasSourceUrl(asset, imageUrl, targetChannel));
}

function ScratchImageSlot({
  label,
  imageUrl,
  asset,
  emptyLabel,
  onChoose,
  onClear,
}: {
  label: string;
  imageUrl: string;
  asset?: AssetRecord;
  emptyLabel: string;
  onChoose: () => void;
  onClear: () => void;
}): JSX.Element {
  return (
    <div className="field-stack">
      <label>{label}</label>
      {imageUrl ? (
        <div className="asset-detail-card">
          <div className="meta-line asset-detail-head">
            <div className="asset-detail-title">
              <strong>{asset?.name ?? 'Selected image'}</strong>
              <small>{asset ? 'Linked from the asset library.' : 'Attached to this scratch slot.'}</small>
            </div>
          </div>
          <div className="asset-detail-preview">
            <img className="asset-detail-img" src={imageUrl} alt={asset?.name ?? label} />
          </div>
        </div>
      ) : (
        <small className="muted">{emptyLabel}</small>
      )}
      <div className="asset-inline-actions">
        <Button size="sm" className="left-button compact-action" onClick={onChoose}>
          {imageUrl ? 'Change image' : 'Choose image'}
        </Button>
        <Button variant="ghost" size="sm" className="compact-action" onClick={onClear} disabled={!imageUrl}>
          Remove image
        </Button>
      </div>
    </div>
  );
}

export function ScratchRevealInspector({ widget }: { widget: WidgetNode }): JSX.Element {
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

  const beforeImage = String(widget.props.beforeImage ?? '').trim();
  const afterImage = String(widget.props.afterImage ?? '').trim();
  const linkedBeforeAsset = resolveLinkedImageAsset(assets, String(widget.props.beforeAssetId ?? '').trim(), beforeImage, targetChannel);
  const linkedAfterAsset = resolveLinkedImageAsset(assets, String(widget.props.afterAssetId ?? '').trim(), afterImage, targetChannel);

  return (
    <section className="section section-premium">
      <h3>Scratch & reveal</h3>
      <div className="field-stack">
        <div>
          <label>Title</label>
          <input value={String(widget.props.title ?? '')} onChange={(event) => widgetActions.updateWidgetProps(widget.id, { title: event.target.value })} />
        </div>
        <div>
          <label>Cover label</label>
          <input value={String(widget.props.coverLabel ?? '')} onChange={(event) => widgetActions.updateWidgetProps(widget.id, { coverLabel: event.target.value })} />
        </div>
        <div>
          <label>Reveal label</label>
          <input value={String(widget.props.revealLabel ?? '')} onChange={(event) => widgetActions.updateWidgetProps(widget.id, { revealLabel: event.target.value })} />
        </div>
        <ScratchImageSlot
          label="Cover image"
          imageUrl={beforeImage}
          asset={linkedBeforeAsset}
          emptyLabel="No cover image selected yet."
          onChoose={() => requestOpenAssetLibrary({ target: 'scratch-cover' })}
          onClear={() => widgetActions.updateWidgetProps(widget.id, { beforeAssetId: '', beforeImage: '' })}
        />
        <ScratchImageSlot
          label="Reveal image"
          imageUrl={afterImage}
          asset={linkedAfterAsset}
          emptyLabel="No reveal image selected yet."
          onChoose={() => requestOpenAssetLibrary({ target: 'scratch-reveal' })}
          onClear={() => widgetActions.updateWidgetProps(widget.id, { afterAssetId: '', afterImage: '' })}
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
        <div>
          <label>Reveal animation</label>
          <select
            value={String(widget.props.revealAnimationPreset ?? 'none')}
            onChange={(event) => widgetActions.updateWidgetProps(widget.id, { revealAnimationPreset: event.target.value })}
          >
            <option value="none">None</option>
            <option value="appear">Appear</option>
            <option value="fade-up">Fade up</option>
            <option value="zoom-in">Zoom in</option>
          </select>
        </div>
        <div>
          <label>Reveal animation ms</label>
          <input
            type="number"
            step="50"
            min="150"
            max="3000"
            value={String(widget.props.revealAnimationDurationMs ?? 700)}
            onChange={(event) => widgetActions.updateWidgetProps(widget.id, { revealAnimationDurationMs: Number(event.target.value) })}
          />
        </div>
        <div>
          <label>Reveal delay ms</label>
          <input
            type="number"
            step="50"
            min="0"
            max="3000"
            value={String(widget.props.revealAnimationDelayMs ?? 0)}
            onChange={(event) => widgetActions.updateWidgetProps(widget.id, { revealAnimationDelayMs: Number(event.target.value) })}
          />
        </div>
      </div>
    </section>
  );
}
