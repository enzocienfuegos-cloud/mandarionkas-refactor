import { ColorControl } from '../../shared/ui/ColorControl';
import { useEffect, useMemo, useState } from 'react';
import { listAssets } from '../../repositories/asset';
import { subscribeToAssetLibraryChanges } from '../../repositories/asset/events';
import type { AssetRecord } from '../../assets/types';
import type { WidgetNode } from '../../domain/document/types';
import { useUiActions, useWidgetActions } from '../../hooks/use-studio-actions';
import { usePlatformSnapshot } from '../../platform/runtime';

export function FillSection({ widget }: { widget: WidgetNode }): JSX.Element {
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
          if (!cancelled) setAssets(records);
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

  const eligibleAssets = useMemo(
    () => assets.filter((asset) => widget.type === 'video-hero' ? asset.kind === 'video' : asset.kind === 'image'),
    [assets, widget.type],
  );

  return (
    <section className="section section-premium">
      <h3>Fill / colors</h3>
      <div className="fields-grid">
        <ColorControl label="Background" value={String(widget.style.backgroundColor ?? '#1f2937')} fallback="#1f2937" onChange={(value) => widgetActions.updateWidgetStyle(widget.id, { backgroundColor: value })} />
        <ColorControl label="Accent" value={String(widget.style.accentColor ?? '#f59e0b')} fallback="#f59e0b" onChange={(value) => widgetActions.updateWidgetStyle(widget.id, { accentColor: value })} />
      </div>
      {['image', 'hero-image', 'video-hero'].includes(widget.type) ? (
        <div className="field-stack" style={{ marginTop: 10 }}>
          <div>
            <label>{widget.type === 'video-hero' ? 'Video source' : 'Image source'}</label>
            <input value={String(widget.props.src ?? '')} onChange={(event) => widgetActions.updateWidgetProps(widget.id, { src: event.target.value })} placeholder={widget.type === 'video-hero' ? 'https://.../video.mp4' : 'https://.../image.jpg'} />
          </div>
          <div>
            <label>Asset library</label>
            <div className="asset-inline-actions">
              <select value={String(widget.props.assetId ?? '')} onChange={(event) => {
              const assetId = event.target.value;
              const asset = eligibleAssets.find((item) => item.id === assetId);
              widgetActions.updateWidgetProps(
                widget.id,
                asset
                  ? { assetId: asset.id, src: asset.src, alt: asset.name, posterSrc: asset.posterSrc ?? widget.props.posterSrc }
                  : { assetId: '', src: '' },
              );
            }}>
              <option value="">No linked asset</option>
              {eligibleAssets.map((asset) => <option key={asset.id} value={asset.id}>{asset.name}</option>)}
            </select>
              <button type="button" className="left-button compact-action" onClick={() => uiActions.setLeftTab('assets')}>Open library</button>
            </div>
          </div>
          {widget.type === 'video-hero' ? <div>
            <label>Poster source</label>
            <input value={String(widget.props.posterSrc ?? '')} onChange={(event) => widgetActions.updateWidgetProps(widget.id, { posterSrc: event.target.value })} placeholder="https://.../poster.jpg" />
          </div> : null}
          {widget.type !== 'video-hero' ? <div>
            <label>Fit</label>
            <select value={String(widget.style.fit ?? 'cover')} onChange={(event) => widgetActions.updateWidgetStyle(widget.id, { fit: event.target.value })}>
              <option value="cover">cover</option>
              <option value="contain">contain</option>
            </select>
          </div> : null}
        </div>
      ) : null}
    </section>
  );
}
