import { useEffect, useMemo, useState } from 'react';
import type { AssetRecord } from '../../assets/types';
import type { WidgetNode } from '../../domain/document/types';
import { useUiActions, useWidgetActions } from '../../hooks/use-studio-actions';
import { listAssets } from '../../repositories/asset';
import { subscribeToAssetLibraryChanges } from '../../repositories/asset/events';
import { usePlatformSnapshot } from '../../platform/runtime';

function useAssets() {
  const platform = usePlatformSnapshot();
  const [assets, setAssets] = useState<AssetRecord[]>([]);
  useEffect(() => {
    if (!platform.session.isAuthenticated) { setAssets([]); return; }
    let cancelled = false;
    const sync = () => void listAssets().then((r) => { if (!cancelled) setAssets(r); }).catch(() => { if (!cancelled) setAssets([]); });
    sync();
    const unsub = subscribeToAssetLibraryChanges(sync);
    return () => { cancelled = true; unsub(); };
  }, [platform.session.isAuthenticated, platform.session.sessionId]);
  return assets;
}

function AssetPicker({ node, srcKey, assetIdKey, kindFilter, placeholder }: {
  node: WidgetNode; srcKey: string; assetIdKey: string;
  kindFilter: 'image' | 'video'; placeholder?: string;
}) {
  const { updateWidgetProps } = useWidgetActions();
  const uiActions = useUiActions();
  const assets = useAssets();
  const eligible = useMemo(() => assets.filter((a) => a.kind === kindFilter), [assets, kindFilter]);

  return (
    <>
      <div>
        <label>Source URL</label>
        <input value={String(node.props[srcKey] ?? '')} placeholder={placeholder ?? 'https://...'}
          onChange={(e) => updateWidgetProps(node.id, { [srcKey]: e.target.value, [assetIdKey]: '' })} />
      </div>
      <div>
        <label>Asset library</label>
        <div className="asset-inline-actions">
          <select value={String(node.props[assetIdKey] ?? '')}
            onChange={(e) => {
              const asset = eligible.find((a) => a.id === e.target.value);
              updateWidgetProps(node.id, asset ? { [assetIdKey]: asset.id, [srcKey]: asset.src } : { [assetIdKey]: '', [srcKey]: '' });
            }}>
            <option value="">No linked asset</option>
            {eligible.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
          <button type="button" className="left-button compact-action" onClick={() => uiActions.setLeftTab('assets')}>Open library</button>
        </div>
      </div>
    </>
  );
}

export function TeadsLayout2Inspector({ node }: { node: WidgetNode }): JSX.Element {
  const { updateWidgetProps } = useWidgetActions();
  const mediaKind = String(node.props.mediaKind ?? 'image');

  return (
    <>
      <section className="section section-premium">
        <h3>Brand</h3>
        <div className="field-stack">
          <div><label>Brand name</label><input value={String(node.props.brandName ?? '')} onChange={(e) => updateWidgetProps(node.id, { brandName: e.target.value })} /></div>
          <AssetPicker node={node} srcKey="brandLogoSrc" assetIdKey="brandLogoAssetId" kindFilter="image" placeholder="https://.../logo.png" />
        </div>
      </section>

      <section className="section section-premium">
        <h3>Media</h3>
        <div className="field-stack">
          <div>
            <label>Type</label>
            <select value={mediaKind} onChange={(e) => updateWidgetProps(node.id, { mediaKind: e.target.value, mediaSrc: '', mediaAssetId: '' })}>
              <option value="image">Image</option>
              <option value="video">Video</option>
            </select>
          </div>
          <AssetPicker node={node} srcKey="mediaSrc" assetIdKey="mediaAssetId" kindFilter={mediaKind as 'image' | 'video'} />
        </div>
      </section>

      <section className="section section-premium">
        <h3>CTA</h3>
        <div className="field-stack">
          <div><label>CTA label</label><input value={String(node.props.ctaLabel ?? 'Learn More')} onChange={(e) => updateWidgetProps(node.id, { ctaLabel: e.target.value })} /></div>
          <div><label>CTA URL</label><input value={String(node.props.ctaUrl ?? '')} placeholder="https://..." onChange={(e) => updateWidgetProps(node.id, { ctaUrl: e.target.value })} /></div>
        </div>
      </section>

      <section className="section section-premium">
        <h3>Primary text</h3>
        <div className="field-stack">
          <div><textarea rows={4} value={String(node.props.primaryText ?? '')} onChange={(e) => updateWidgetProps(node.id, { primaryText: e.target.value })} /></div>
        </div>
      </section>
    </>
  );
}
