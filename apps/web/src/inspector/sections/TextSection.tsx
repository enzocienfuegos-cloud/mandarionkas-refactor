import { useEffect, useMemo, useState } from 'react';
import { ColorControl } from '../../shared/ui/ColorControl';
import { useUiActions, useWidgetActions } from '../../hooks/use-studio-actions';
import type { WidgetNode } from '../../domain/document/types';
import { listAssets } from '../../repositories/asset';
import { subscribeToAssetLibraryChanges } from '../../repositories/asset/events';
import type { AssetRecord } from '../../assets/types';
import { resolveFontAssetFamily } from '../../assets/FontAssetRuntime';
import { usePlatformSnapshot } from '../../platform/runtime';

export function TextSection({ widget }: { widget: WidgetNode }): JSX.Element {
  const { updateWidgetProps, updateWidgetStyle } = useWidgetActions();
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
        .then((records) => { if (!cancelled) setAssets(records); })
        .catch(() => { if (!cancelled) setAssets([]); });
    };
    syncAssets();
    const unsubscribe = subscribeToAssetLibraryChanges(syncAssets);
    return () => { cancelled = true; unsubscribe(); };
  }, [platform.session.isAuthenticated, platform.session.sessionId]);

  const fontAssets = useMemo(() => assets.filter((asset) => asset.kind === 'font'), [assets]);

  return (
    <section className="section section-premium">
      <h3>Text</h3>
      <div className="field-stack">
        <div>
          <label>Text value</label>
          <textarea rows={4} value={String(widget.props.text ?? '')} onChange={(event) => updateWidgetProps(widget.id, { text: event.target.value })} />
        </div>
        <div className="fields-grid">
          <div>
            <label>Font size</label>
            <input type="number" value={Number(widget.style.fontSize ?? 16)} onChange={(event) => updateWidgetStyle(widget.id, { fontSize: Number(event.target.value) })} />
          </div>
          <ColorControl label="Text color" value={String(widget.style.color ?? '#ffffff')} fallback="#ffffff" onChange={(value) => updateWidgetStyle(widget.id, { color: value })} />
        </div>
        <div className="fields-grid">
          <div>
            <label>Horizontal align</label>
            <select value={String(widget.style.horizontalAlign ?? widget.style.textAlign ?? 'center')} onChange={(event) => updateWidgetStyle(widget.id, { horizontalAlign: event.target.value, textAlign: event.target.value })}>
              <option value="left">Left</option>
              <option value="center">Center</option>
              <option value="right">Right</option>
            </select>
          </div>
          <div>
            <label>Vertical align</label>
            <select value={String(widget.style.verticalAlign ?? 'center')} onChange={(event) => updateWidgetStyle(widget.id, { verticalAlign: event.target.value })}>
              <option value="top">Top</option>
              <option value="center">Center</option>
              <option value="bottom">Bottom</option>
            </select>
          </div>
        </div>
        <div>
          <label>Font family</label>
          <input value={String(widget.style.fontFamily ?? '')} onChange={(event) => updateWidgetStyle(widget.id, { fontFamily: event.target.value })} placeholder="System or custom font family" />
        </div>
        <div>
          <label>Font asset</label>
          <div className="asset-inline-actions">
            <select value={String(widget.props.fontAssetId ?? '')} onChange={(event) => {
              const assetId = event.target.value;
              const asset = fontAssets.find((item) => item.id === assetId);
              if (!asset) {
                updateWidgetProps(widget.id, { fontAssetId: '', fontAssetSrc: '' });
                return;
              }
              updateWidgetProps(widget.id, { fontAssetId: asset.id, fontAssetSrc: asset.src });
              updateWidgetStyle(widget.id, { fontFamily: resolveFontAssetFamily(asset) });
            }}>
              <option value="">No linked font</option>
              {fontAssets.map((asset) => <option key={asset.id} value={asset.id}>{asset.name}</option>)}
            </select>
            <button type="button" className="left-button compact-action" onClick={() => uiActions.setLeftTab('assets')}>Browse fonts</button>
          </div>
        </div>
      </div>
    </section>
  );
}
