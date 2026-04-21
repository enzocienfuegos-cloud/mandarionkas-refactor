import { useEffect, useMemo, useState } from 'react';
import type { AssetRecord } from '../../assets/types';
import type { WidgetNode } from '../../domain/document/types';
import { useUiActions, useWidgetActions } from '../../hooks/use-studio-actions';
import { listAssets } from '../../repositories/asset';
import { subscribeToAssetLibraryChanges } from '../../repositories/asset/events';
import { usePlatformSnapshot } from '../../platform/runtime';

export function ShapeMaskInspector({ node }: { node: WidgetNode }): JSX.Element {
  const { updateWidgetProps } = useWidgetActions();
  const uiActions = useUiActions();
  const platform = usePlatformSnapshot();
  const [assets, setAssets] = useState<AssetRecord[]>([]);

  useEffect(() => {
    if (!platform.session.isAuthenticated || !platform.session.sessionId) {
      setAssets([]);
      return;
    }
    let cancelled = false;
    const sync = () => {
      void listAssets()
        .then((records) => { if (!cancelled) setAssets(records); })
        .catch(() => { if (!cancelled) setAssets([]); });
    };
    sync();
    const unsub = subscribeToAssetLibraryChanges(sync);
    return () => { cancelled = true; unsub(); };
  }, [platform.session.isAuthenticated, platform.session.sessionId]);

  const imageAssets = useMemo(
    () => assets.filter((a) => a.kind === 'image'),
    [assets],
  );

  const hasMask = Boolean(String(node.props.maskSrc ?? '').trim());

  function clearMask() {
    updateWidgetProps(node.id, { maskSrc: '', maskAssetId: '' });
  }

  return (
    <section className="section section-premium">
      <h3>Image mask</h3>
      <div className="field-stack">
        <div>
          <label>Image source (URL)</label>
          <input
            value={String(node.props.maskSrc ?? '')}
            placeholder="https://.../image.jpg"
            onChange={(e) => updateWidgetProps(node.id, { maskSrc: e.target.value, maskAssetId: '' })}
          />
        </div>
        <div>
          <label>Asset library</label>
          <div className="asset-inline-actions">
            <select
              value={String(node.props.maskAssetId ?? '')}
              onChange={(e) => {
                const asset = imageAssets.find((a) => a.id === e.target.value);
                updateWidgetProps(node.id, asset
                  ? { maskAssetId: asset.id, maskSrc: asset.src }
                  : { maskAssetId: '', maskSrc: '' });
              }}
            >
              <option value="">No linked asset</option>
              {imageAssets.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
            <button type="button" className="left-button compact-action" onClick={() => uiActions.setLeftTab('assets')}>
              Open library
            </button>
          </div>
        </div>
        {hasMask && (
          <>
            <div>
              <label>Fit</label>
              <select
                value={String(node.props.maskFit ?? 'cover')}
                onChange={(e) => updateWidgetProps(node.id, { maskFit: e.target.value })}
              >
                <option value="cover">Cover</option>
                <option value="contain">Contain</option>
              </select>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <div>
                <label>Focal X (%)</label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={String(node.props.maskFocalX ?? 50)}
                  onChange={(e) => updateWidgetProps(node.id, { maskFocalX: Number(e.target.value) })}
                />
              </div>
              <div>
                <label>Focal Y (%)</label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={String(node.props.maskFocalY ?? 50)}
                  onChange={(e) => updateWidgetProps(node.id, { maskFocalY: Number(e.target.value) })}
                />
              </div>
            </div>
            <button type="button" className="ghost compact-action" onClick={clearMask}>
              Remove image mask
            </button>
          </>
        )}
      </div>
    </section>
  );
}
