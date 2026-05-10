import { useEffect, useMemo, useState } from 'react';
import type { AssetRecord } from '../../assets/types';
import type { WidgetNode } from '../../domain/document/types';
import { useUiActions, useWidgetActions } from '../../hooks/use-studio-actions';
import { usePlatformSnapshot } from '../../platform/runtime';
import { listAssets } from '../../repositories/asset';
import { subscribeToAssetLibraryChanges } from '../../repositories/asset/events';
import { Button } from '../../shared/ui/Button';
import { VERTICAL_ACCORDION_DEFAULTS, VERTICAL_ACCORDION_ROW_DEFAULTS } from './vertical-accordion.shared';

function useImageAssets(): AssetRecord[] {
  const platform = usePlatformSnapshot();
  const [assets, setAssets] = useState<AssetRecord[]>([]);

  useEffect(() => {
    if (!platform.session.isAuthenticated) {
      setAssets([]);
      return;
    }
    let cancelled = false;
    const sync = () =>
      void listAssets()
        .then((records) => {
          if (!cancelled) setAssets(records.filter((asset) => asset.kind === 'image'));
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
  }, [platform.session.isAuthenticated, platform.session.sessionId]);

  return assets;
}

function AssetPicker({
  node,
  srcKey,
  assetIdKey,
  placeholder,
}: {
  node: WidgetNode;
  srcKey: string;
  assetIdKey: string;
  placeholder?: string;
}): JSX.Element {
  const { updateWidgetProps } = useWidgetActions();
  const uiActions = useUiActions();
  const assets = useImageAssets();
  const linkedAssetId = String(node.props[assetIdKey] ?? '');

  const previewSrc = useMemo(() => {
    if (!linkedAssetId) return String(node.props[srcKey] ?? '');
    const asset = assets.find((record) => record.id === linkedAssetId);
    return asset?.thumbnailUrl ?? asset?.derivatives?.thumbnail?.src ?? asset?.src ?? String(node.props[srcKey] ?? '');
  }, [assets, linkedAssetId, node.props, srcKey]);

  return (
    <div className="field-stack">
      {previewSrc ? (
        <div className="inspector-preview-frame">
          <img src={previewSrc} alt="" className="inspector-preview-media" />
        </div>
      ) : null}
      <div>
        <label>URL</label>
        <input
          value={String(node.props[srcKey] ?? '')}
          placeholder={placeholder ?? 'https://...'}
          onChange={(event) => updateWidgetProps(node.id, { [srcKey]: event.target.value, [assetIdKey]: '' })}
        />
      </div>
      <div>
        <label>Asset library</label>
        <div className="asset-inline-actions">
          <select
            value={linkedAssetId}
            onChange={(event) => {
              const asset = assets.find((record) => record.id === event.target.value);
              updateWidgetProps(
                node.id,
                asset ? { [assetIdKey]: asset.id, [srcKey]: asset.src } : { [assetIdKey]: '', [srcKey]: '' },
              );
            }}
          >
            <option value="">No linked asset</option>
            {assets.map((asset) => (
              <option key={asset.id} value={asset.id}>
                {asset.name}
              </option>
            ))}
          </select>
          <Button size="sm" className="left-button compact-action" onClick={() => uiActions.setLeftTab('assets')}>Open library</Button>
        </div>
      </div>
    </div>
  );
}

function ColorField({
  node,
  propKey,
  label,
  defaultValue,
}: {
  node: WidgetNode;
  propKey: string;
  label: string;
  defaultValue: string;
}): JSX.Element {
  const { updateWidgetProps } = useWidgetActions();
  const value = String(node.props[propKey] ?? defaultValue);

  return (
    <div className="inspector-input-with-swatch">
      <div>
        <label>{label}</label>
        <input
          value={value}
          placeholder={defaultValue}
          onChange={(event) => updateWidgetProps(node.id, { [propKey]: event.target.value })}
        />
      </div>
      <input
        type="color"
        value={value.startsWith('#') ? value : defaultValue}
        className="inspector-color-swatch"
        onChange={(event) => updateWidgetProps(node.id, { [propKey]: event.target.value })}
      />
    </div>
  );
}

function RowSection({ node, rowNumber }: { node: WidgetNode; rowNumber: 1 | 2 | 3 }): JSX.Element {
  const { updateWidgetProps } = useWidgetActions();
  const defaults = VERTICAL_ACCORDION_ROW_DEFAULTS[rowNumber];

  return (
    <section className="section section-premium">
      <h3>Row {rowNumber}</h3>
      <div className="field-stack">
        <div>
          <label>Title</label>
          <input
            value={String(node.props[`row${rowNumber}Title`] ?? '')}
            placeholder={defaults.title}
            onChange={(event) => updateWidgetProps(node.id, { [`row${rowNumber}Title`]: event.target.value })}
          />
        </div>
        <div>
          <label>Chip text</label>
          <input
            value={String(node.props[`row${rowNumber}Chip`] ?? '')}
            placeholder="Optional label"
            onChange={(event) => updateWidgetProps(node.id, { [`row${rowNumber}Chip`]: event.target.value })}
          />
        </div>
        <div>
          <label>Hero image</label>
          <AssetPicker node={node} srcKey={`row${rowNumber}Src`} assetIdKey={`row${rowNumber}AssetId`} />
        </div>
        <ColorField node={node} propKey={`row${rowNumber}Bg`} label="Background color" defaultValue={defaults.bg} />
        <ColorField node={node} propKey={`row${rowNumber}TextColor`} label="Text color" defaultValue={defaults.textColor} />
      </div>
    </section>
  );
}

export function VerticalAccordionInspector({ node }: { node: WidgetNode }): JSX.Element {
  const { updateWidgetProps } = useWidgetActions();

  return (
    <>
      <section className="section section-premium">
        <h3>Behavior</h3>
        <div className="field-stack">
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={Boolean(node.props.autoplay ?? true)}
              onChange={(event) => updateWidgetProps(node.id, { autoplay: event.target.checked })}
            />
            Autoplay on load
          </label>
          <div>
            <label>Autoplay interval — {Number(node.props.autoplayIntervalMs ?? 1000)} ms per row</label>
            <input
              type="range"
              min={400}
              max={4000}
              step={100}
              value={Number(node.props.autoplayIntervalMs ?? 1000)}
              onChange={(event) => updateWidgetProps(node.id, { autoplayIntervalMs: Number(event.target.value) })}
            />
          </div>
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={Boolean(node.props.showDots ?? true)}
              onChange={(event) => updateWidgetProps(node.id, { showDots: event.target.checked })}
            />
            Show progress dots during autoplay
          </label>
        </div>
      </section>

      <section className="section section-premium">
        <h3>Sizing</h3>
        <div className="field-stack">
          <div>
            <label>Collapsed strip height — {Number(node.props.stripHeight ?? 56)} px</label>
            <input
              type="range"
              min={36}
              max={80}
              step={2}
              value={Number(node.props.stripHeight ?? 56)}
              onChange={(event) => updateWidgetProps(node.id, { stripHeight: Number(event.target.value) })}
            />
          </div>
          <div>
            <label>Expanded row height — {Number(node.props.expandedHeight ?? 280)} px</label>
            <input
              type="range"
              min={100}
              max={420}
              step={4}
              value={Number(node.props.expandedHeight ?? 280)}
              onChange={(event) => updateWidgetProps(node.id, { expandedHeight: Number(event.target.value) })}
            />
          </div>
        </div>
      </section>

      <section className="section section-premium">
        <h3>Top bar</h3>
        <div className="field-stack">
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={Boolean(node.props.showTopbar ?? true)}
              onChange={(event) => updateWidgetProps(node.id, { showTopbar: event.target.checked })}
            />
            Show top bar
          </label>
          <div>
            <label>Brand line 1</label>
            <input
              value={String(node.props.brandLine1 ?? '')}
              placeholder={VERTICAL_ACCORDION_DEFAULTS.brandLine1}
              onChange={(event) => updateWidgetProps(node.id, { brandLine1: event.target.value })}
            />
          </div>
          <div>
            <label>Brand line 2</label>
            <input
              value={String(node.props.brandLine2 ?? '')}
              placeholder={VERTICAL_ACCORDION_DEFAULTS.brandLine2}
              onChange={(event) => updateWidgetProps(node.id, { brandLine2: event.target.value })}
            />
          </div>
          <div>
            <label>Logo image</label>
            <AssetPicker node={node} srcKey="logoSrc" assetIdKey="logoAssetId" placeholder="https://.../logo.png" />
          </div>
        </div>
      </section>

      <RowSection node={node} rowNumber={1} />
      <RowSection node={node} rowNumber={2} />
      <RowSection node={node} rowNumber={3} />

      <section className="section section-premium">
        <h3>End card</h3>
        <div className="field-stack">
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={Boolean(node.props.showEndcard ?? true)}
              onChange={(event) => updateWidgetProps(node.id, { showEndcard: event.target.checked })}
            />
            Show end card
          </label>
          <div>
            <label>Line 1</label>
            <input
              value={String(node.props.endcardLine1 ?? '')}
              placeholder={VERTICAL_ACCORDION_DEFAULTS.endcardLine1}
              onChange={(event) => updateWidgetProps(node.id, { endcardLine1: event.target.value })}
            />
          </div>
          <div>
            <label>Line 2</label>
            <input
              value={String(node.props.endcardLine2 ?? '')}
              placeholder={VERTICAL_ACCORDION_DEFAULTS.brandLine2}
              onChange={(event) => updateWidgetProps(node.id, { endcardLine2: event.target.value })}
            />
          </div>
          <ColorField node={node} propKey="endcardBg" label="Background color" defaultValue={VERTICAL_ACCORDION_DEFAULTS.endcardBg} />
          <ColorField node={node} propKey="endcardTextColor" label="Text color" defaultValue={VERTICAL_ACCORDION_DEFAULTS.endcardTextColor} />
        </div>
      </section>

      <section className="section section-premium">
        <h3>CTA bar</h3>
        <div className="field-stack">
          <div>
            <label>Label</label>
            <input
              value={String(node.props.ctaText ?? '')}
              placeholder={VERTICAL_ACCORDION_DEFAULTS.ctaText}
              onChange={(event) => updateWidgetProps(node.id, { ctaText: event.target.value })}
            />
          </div>
          <div>
            <label>URL</label>
            <input
              value={String(node.props.ctaUrl ?? '')}
              placeholder="https://..."
              onChange={(event) => updateWidgetProps(node.id, { ctaUrl: event.target.value })}
            />
          </div>
          <ColorField node={node} propKey="ctaBg" label="Background color" defaultValue={VERTICAL_ACCORDION_DEFAULTS.ctaBg} />
          <ColorField node={node} propKey="ctaTextColor" label="Text color" defaultValue={VERTICAL_ACCORDION_DEFAULTS.ctaTextColor} />
        </div>
      </section>
    </>
  );
}
