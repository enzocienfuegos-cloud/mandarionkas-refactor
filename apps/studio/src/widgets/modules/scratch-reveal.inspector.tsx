import { useEffect, useState } from 'react';
import { assetHasSourceUrl, resolveAssetDeliveryUrl } from '../../assets/policy';
import type { WidgetNode } from '../../domain/document/types';
import type { AssetRecord } from '../../assets/types';
import { useStudioStore } from '../../core/store/use-studio-store';
import { listAssets } from '../../repositories/asset';
import { subscribeToAssetLibraryChanges } from '../../repositories/asset/events';
import { usePlatformSnapshot } from '../../platform/runtime';
import { useWidgetActions } from '../../hooks/use-studio-actions';
import { Button } from '../../shared/ui/Button';
import { requestOpenAssetLibrary } from '../../shared/asset-library-events';

export function ScratchRevealInspector({ widget }: { widget: WidgetNode }): JSX.Element {
  const widgetActions = useWidgetActions();
  const platform = usePlatformSnapshot();
  const targetChannel = useStudioStore((state) => state.document.metadata.release.targetChannel);
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

  const linkedBeforeAssetId = String(widget.props.beforeAssetId ?? '').trim()
    || assets.find((asset) => assetHasSourceUrl(asset, String(widget.props.beforeImage ?? '').trim(), targetChannel))?.id
    || '';
  const linkedAfterAssetId = String(widget.props.afterAssetId ?? '').trim()
    || assets.find((asset) => assetHasSourceUrl(asset, String(widget.props.afterImage ?? '').trim(), targetChannel))?.id
    || '';

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
        <div>
          <label>Cover image</label>
          <select value={linkedBeforeAssetId} onChange={(event) => {
            const asset = assets.find((item) => item.id === event.target.value);
            widgetActions.updateWidgetProps(
              widget.id,
              asset
                ? {
                    beforeAssetId: asset.id,
                    beforeImage: resolveAssetDeliveryUrl(asset, targetChannel, asset.qualityPreference ?? 'auto'),
                  }
                : { beforeAssetId: '', beforeImage: '' },
            );
          }}>
            <option value="">No image</option>
            {assets.map((asset) => <option key={asset.id} value={asset.id}>{asset.name}</option>)}
          </select>
        </div>
        <div>
          <label>Reveal image</label>
          <select value={linkedAfterAssetId} onChange={(event) => {
            const asset = assets.find((item) => item.id === event.target.value);
            widgetActions.updateWidgetProps(
              widget.id,
              asset
                ? {
                    afterAssetId: asset.id,
                    afterImage: resolveAssetDeliveryUrl(asset, targetChannel, asset.qualityPreference ?? 'auto'),
                  }
                : { afterAssetId: '', afterImage: '' },
            );
          }}>
            <option value="">No image</option>
            {assets.map((asset) => <option key={asset.id} value={asset.id}>{asset.name}</option>)}
          </select>
        </div>
        <div className="asset-inline-actions">
          <Button size="sm" className="left-button compact-action" onClick={requestOpenAssetLibrary}>Open library</Button>
        </div>
        <div>
          <label>Cover blur</label>
          <input type="number" step="1" value={String(widget.props.coverBlur ?? 6)} onChange={(event) => widgetActions.updateWidgetProps(widget.id, { coverBlur: Number(event.target.value) })} />
        </div>
        <div>
          <label>Scratch radius</label>
          <input type="number" step="1" value={String(widget.props.scratchRadius ?? 22)} onChange={(event) => widgetActions.updateWidgetProps(widget.id, { scratchRadius: Number(event.target.value) })} />
        </div>
      </div>
    </section>
  );
}
