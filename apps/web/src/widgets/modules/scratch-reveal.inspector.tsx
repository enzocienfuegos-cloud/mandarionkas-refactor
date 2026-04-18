import { useEffect, useState } from 'react';
import type { WidgetNode } from '../../domain/document/types';
import type { AssetRecord } from '../../assets/types';
import { listAssets } from '../../repositories/asset';
import { subscribeToAssetLibraryChanges } from '../../repositories/asset/events';
import { usePlatformSnapshot } from '../../platform/runtime';
import { useUiActions, useWidgetActions } from '../../hooks/use-studio-actions';

export function ScratchRevealInspector({ widget }: { widget: WidgetNode }): JSX.Element {
  const widgetActions = useWidgetActions();
  const uiActions = useUiActions();
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
          <select value={String(widget.props.beforeImage ?? '')} onChange={(event) => widgetActions.updateWidgetProps(widget.id, { beforeImage: event.target.value })}>
            <option value="">No image</option>
            {assets.map((asset) => <option key={asset.id} value={asset.src}>{asset.name}</option>)}
          </select>
        </div>
        <div>
          <label>Reveal image</label>
          <select value={String(widget.props.afterImage ?? '')} onChange={(event) => widgetActions.updateWidgetProps(widget.id, { afterImage: event.target.value })}>
            <option value="">No image</option>
            {assets.map((asset) => <option key={asset.id} value={asset.src}>{asset.name}</option>)}
          </select>
        </div>
        <div className="asset-inline-actions">
          <button type="button" className="left-button compact-action" onClick={() => uiActions.setLeftTab('assets')}>Open library</button>
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
