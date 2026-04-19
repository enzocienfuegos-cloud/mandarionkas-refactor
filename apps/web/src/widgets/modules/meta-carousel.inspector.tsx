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
  kindFilter: 'image' | 'video' | 'both'; placeholder?: string;
}) {
  const { updateWidgetProps } = useWidgetActions();
  const uiActions = useUiActions();
  const assets = useAssets();
  const eligible = useMemo(() => assets.filter((a) =>
    kindFilter === 'both' ? a.kind === 'image' || a.kind === 'video'
    : a.kind === kindFilter
  ), [assets, kindFilter]);

  return (
    <div className="field-stack">
      <div>
        <label>Source URL</label>
        <input
          value={String(node.props[srcKey] ?? '')}
          placeholder={placeholder ?? 'https://...'}
          onChange={(e) => updateWidgetProps(node.id, { [srcKey]: e.target.value, [assetIdKey]: '' })}
        />
      </div>
      <div>
        <label>Asset library</label>
        <div className="asset-inline-actions">
          <select
            value={String(node.props[assetIdKey] ?? '')}
            onChange={(e) => {
              const asset = eligible.find((a) => a.id === e.target.value);
              updateWidgetProps(node.id, asset
                ? { [assetIdKey]: asset.id, [srcKey]: asset.src }
                : { [assetIdKey]: '', [srcKey]: '' });
            }}
          >
            <option value="">No linked asset</option>
            {eligible.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
          <button type="button" className="left-button compact-action" onClick={() => uiActions.setLeftTab('assets')}>
            Open library
          </button>
        </div>
      </div>
    </div>
  );
}

function SlideSection({ node, n }: { node: WidgetNode; n: 1 | 2 | 3 | 4 | 5 }) {
  const { updateWidgetProps } = useWidgetActions();
  const currentKind = String(node.props[`slide${n}Kind`] ?? 'image');
  return (
    <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)', paddingTop: 10, marginTop: 4 }}>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', opacity: 0.55, marginBottom: 8 }}>
        Slide {n}
      </div>
      <div className="field-stack">
        <div>
          <label>Type</label>
          <select value={currentKind} onChange={(e) => updateWidgetProps(node.id, { [`slide${n}Kind`]: e.target.value, [`slide${n}Src`]: '', [`slide${n}AssetId`]: '' })}>
            <option value="image">Image</option>
            <option value="video">Video</option>
          </select>
        </div>
        <AssetPicker node={node} srcKey={`slide${n}Src`} assetIdKey={`slide${n}AssetId`} kindFilter={currentKind as 'image' | 'video'} />
        <div>
          <label>Title</label>
          <input value={String(node.props[`slide${n}Title`] ?? '')} onChange={(e) => updateWidgetProps(node.id, { [`slide${n}Title`]: e.target.value })} />
        </div>
        <div>
          <label>Description</label>
          <input value={String(node.props[`slide${n}Description`] ?? '')} onChange={(e) => updateWidgetProps(node.id, { [`slide${n}Description`]: e.target.value })} />
        </div>
      </div>
    </div>
  );
}

export function MetaCarouselInspector({ node }: { node: WidgetNode }): JSX.Element {
  const { updateWidgetProps } = useWidgetActions();
  const slideCount = Math.min(5, Math.max(1, Number(node.props.slideCount ?? 3)));

  return (
    <>
      <section className="section section-premium">
        <h3>Brand</h3>
        <div className="field-stack">
          <div><label>Brand name</label><input value={String(node.props.brandName ?? '')} onChange={(e) => updateWidgetProps(node.id, { brandName: e.target.value })} /></div>
          <div><label>Sponsored label</label><input value={String(node.props.sponsoredLabel ?? 'Sponsored')} onChange={(e) => updateWidgetProps(node.id, { sponsoredLabel: e.target.value })} /></div>
          <AssetPicker node={node} srcKey="brandAvatarSrc" assetIdKey="brandAvatarAssetId" kindFilter="image" placeholder="https://.../avatar.jpg" />
        </div>
      </section>

      <section className="section section-premium">
        <h3>Post</h3>
        <div className="field-stack">
          <div><label>Primary text</label><textarea rows={3} value={String(node.props.primaryText ?? '')} onChange={(e) => updateWidgetProps(node.id, { primaryText: e.target.value })} /></div>
          <div><label>CTA label (all slides)</label><input value={String(node.props.ctaLabel ?? 'Shop Now')} onChange={(e) => updateWidgetProps(node.id, { ctaLabel: e.target.value })} /></div>
          <div><label>CTA URL</label><input value={String(node.props.ctaUrl ?? '')} placeholder="https://..." onChange={(e) => updateWidgetProps(node.id, { ctaUrl: e.target.value })} /></div>
        </div>
      </section>

      <section className="section section-premium">
        <h3>Slides</h3>
        <div className="field-stack">
          <div>
            <label>Number of slides</label>
            <select value={slideCount} onChange={(e) => updateWidgetProps(node.id, { slideCount: Number(e.target.value) })}>
              {[1,2,3,4,5].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
        </div>
        {Array.from({ length: slideCount }, (_, i) => (
          <SlideSection key={i + 1} node={node} n={(i + 1) as 1 | 2 | 3 | 4 | 5} />
        ))}
      </section>
    </>
  );
}
