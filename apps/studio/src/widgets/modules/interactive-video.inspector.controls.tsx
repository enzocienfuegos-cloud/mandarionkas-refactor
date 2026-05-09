import { useEffect, useMemo, useState } from 'react';
import type { AssetRecord } from '../../assets/types';
import type { WidgetNode } from '../../domain/document/types';
import { useUiActions, useWidgetActions } from '../../hooks/use-studio-actions';
import { usePlatformSnapshot } from '../../platform/runtime';
import { listAssets } from '../../repositories/asset';
import { subscribeToAssetLibraryChanges } from '../../repositories/asset/events';
import { Button } from '../../shared/ui/Button';

export function useAssets(kind: AssetRecord['kind']): AssetRecord[] {
  const platform = usePlatformSnapshot();
  const [assets, setAssets] = useState<AssetRecord[]>([]);

  useEffect(() => {
    if (!platform.session.isAuthenticated) {
      setAssets([]);
      return;
    }
    let cancelled = false;
    const sync = () => void listAssets()
      .then((records) => {
        if (!cancelled) setAssets(records.filter((asset) => asset.kind === kind));
      })
      .catch(() => {
        if (!cancelled) setAssets([]);
      });
    sync();
    const unsubscribe = subscribeToAssetLibraryChanges(sync);
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [kind, platform.session.isAuthenticated, platform.session.sessionId]);

  return assets;
}

export function AssetPicker({
  node,
  assets,
  label,
  srcKey,
  assetIdKey,
  placeholder,
}: {
  node: WidgetNode;
  assets: AssetRecord[];
  label: string;
  srcKey: string;
  assetIdKey: string;
  placeholder: string;
}): JSX.Element {
  const { updateWidgetProps } = useWidgetActions();
  const uiActions = useUiActions();
  const linkedId = String(node.props[assetIdKey] ?? '');
  const previewSrc = useMemo(() => {
    const asset = assets.find((record) => record.id === linkedId);
    return asset?.thumbnailUrl ?? asset?.posterSrc ?? asset?.src ?? String(node.props[srcKey] ?? '');
  }, [assets, linkedId, node.props, srcKey]);

  return (
    <div className="field-stack">
      {previewSrc ? (
        <div className="inspector-preview-frame">
          {label.toLowerCase().includes('poster')
            ? <img src={previewSrc} alt="" className="inspector-preview-media" />
            : <video src={previewSrc} muted playsInline className="inspector-preview-media" />}
        </div>
      ) : null}
      <div>
        <label>{label} URL</label>
        <input
          value={String(node.props[srcKey] ?? '')}
          placeholder={placeholder}
          onChange={(event) => updateWidgetProps(node.id, { [srcKey]: event.target.value, [assetIdKey]: '' })}
        />
      </div>
      <div>
        <label>{label} asset</label>
        <div className="asset-inline-actions">
          <select
            value={linkedId}
            onChange={(event) => {
              const asset = assets.find((record) => record.id === event.target.value);
              updateWidgetProps(node.id, asset
                ? { [assetIdKey]: asset.id, [srcKey]: asset.src, ...(srcKey === 'src' ? { posterSrc: asset.posterSrc ?? node.props.posterSrc } : {}) }
                : { [assetIdKey]: '', [srcKey]: '' });
            }}
          >
            <option value="">No linked asset</option>
            {assets.map((asset) => <option key={asset.id} value={asset.id}>{asset.name}</option>)}
          </select>
          <Button size="sm" className="left-button compact-action" onClick={() => uiActions.setLeftTab('assets')}>Open library</Button>
        </div>
      </div>
    </div>
  );
}

export function NumberField({
  node,
  propKey,
  label,
  value,
  min,
  max,
  step = 1,
}: {
  node: WidgetNode;
  propKey: string;
  label: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
}): JSX.Element {
  const { updateWidgetProps } = useWidgetActions();
  return (
    <div>
      <label>{label}</label>
      <input
        type="number"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => updateWidgetProps(node.id, { [propKey]: Number(event.target.value) })}
      />
    </div>
  );
}
