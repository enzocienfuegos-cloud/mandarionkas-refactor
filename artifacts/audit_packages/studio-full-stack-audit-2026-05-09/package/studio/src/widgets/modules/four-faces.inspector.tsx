import { useEffect, useMemo, useState } from 'react';
import type { AssetRecord } from '../../assets/types';
import type { WidgetNode } from '../../domain/document/types';
import { useUiActions, useWidgetActions } from '../../hooks/use-studio-actions';
import { usePlatformSnapshot } from '../../platform/runtime';
import { listAssets } from '../../repositories/asset';
import { subscribeToAssetLibraryChanges } from '../../repositories/asset/events';
import { Button } from '../../shared/ui/Button';
import { FOUR_FACES_DEFAULT_GLOBAL, FOUR_FACES_DEFAULT_HOME, FOUR_FACES_FACE_DEFAULTS, FOUR_FACES_FACE_LABELS, type FaceDir } from './four-faces.shared';

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

function AssetPicker({ node, srcKey, assetIdKey }: { node: WidgetNode; srcKey: string; assetIdKey: string }): JSX.Element {
  const { updateWidgetProps } = useWidgetActions();
  const uiActions = useUiActions();
  const assets = useImageAssets();
  const linkedId = String(node.props[assetIdKey] ?? '');

  const previewSrc = useMemo(() => {
    if (!linkedId) return String(node.props[srcKey] ?? '');
    const asset = assets.find((record) => record.id === linkedId);
    return asset?.thumbnailUrl ?? asset?.derivatives?.thumbnail?.src ?? asset?.src ?? String(node.props[srcKey] ?? '');
  }, [assets, linkedId, node.props, srcKey]);

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
          placeholder="https://..."
          onChange={(event) => updateWidgetProps(node.id, { [srcKey]: event.target.value, [assetIdKey]: '' })}
        />
      </div>
      <div>
        <label>Asset library</label>
        <div className="asset-inline-actions">
          <select
            value={linkedId}
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

function FaceSection({ node, dir }: { node: WidgetNode; dir: FaceDir }): JSX.Element {
  const { updateWidgetProps } = useWidgetActions();
  const defaults = FOUR_FACES_FACE_DEFAULTS[dir];

  return (
    <section className="section section-premium">
      <h3>Face {FOUR_FACES_FACE_LABELS[dir]}</h3>
      <div className="field-stack">
        <div>
          <label>Title</label>
          <input
            value={String(node.props[`${dir}Title`] ?? '')}
            placeholder="Title"
            onChange={(event) => updateWidgetProps(node.id, { [`${dir}Title`]: event.target.value })}
          />
        </div>
        <ColorField node={node} propKey={`${dir}TitleColor`} label="Title color" defaultValue={defaults.titleColor} />
        <div>
          <label>Body copy</label>
          <textarea
            rows={2}
            value={String(node.props[`${dir}Body`] ?? '')}
            placeholder="Description..."
            onChange={(event) => updateWidgetProps(node.id, { [`${dir}Body`]: event.target.value })}
          />
        </div>
        <ColorField node={node} propKey={`${dir}BodyColor`} label="Body color" defaultValue={defaults.bodyColor} />
        <div className="inspector-two-col-grid">
          <div>
            <label>CTA label</label>
            <input
              value={String(node.props[`${dir}CtaLabel`] ?? '')}
              placeholder={defaults.ctaLabel}
              onChange={(event) => updateWidgetProps(node.id, { [`${dir}CtaLabel`]: event.target.value })}
            />
          </div>
          <div>
            <label>CTA URL</label>
            <input
              value={String(node.props[`${dir}CtaUrl`] ?? '')}
              placeholder="https://..."
              onChange={(event) => updateWidgetProps(node.id, { [`${dir}CtaUrl`]: event.target.value })}
            />
          </div>
        </div>
        <div>
          <label>Face image</label>
          <AssetPicker node={node} srcKey={`${dir}ImageSrc`} assetIdKey={`${dir}ImageAssetId`} />
        </div>
        <div className="inspector-subsection">
          <div className="inspector-subsection-title">Colors</div>
          <div className="field-stack">
            <ColorField node={node} propKey={`${dir}HeaderBg`} label="Header background" defaultValue={defaults.headerBg} />
            <ColorField node={node} propKey={`${dir}CopyBg`} label="Copy area background" defaultValue={defaults.copyBg} />
            <ColorField node={node} propKey={`${dir}CtaBg`} label="CTA button color" defaultValue={defaults.ctaBg} />
            <ColorField node={node} propKey={`${dir}CtaTextColor`} label="CTA text color" defaultValue={defaults.ctaTextColor} />
          </div>
        </div>
      </div>
    </section>
  );
}

export function FourFacesInspector({ node }: { node: WidgetNode }): JSX.Element {
  const { updateWidgetProps } = useWidgetActions();

  return (
    <>
      <section className="section section-premium">
        <h3>Global</h3>
        <div className="field-stack">
          <ColorField node={node} propKey="accentColor" label="Accent color" defaultValue={FOUR_FACES_DEFAULT_GLOBAL.accentColor} />
          <label className="checkbox-row">
            <input type="checkbox" checked={Boolean(node.props.showDots ?? true)} onChange={(event) => updateWidgetProps(node.id, { showDots: event.target.checked })} />
            Show navigation dots
          </label>
          <label className="checkbox-row">
            <input type="checkbox" checked={Boolean(node.props.showArrows ?? true)} onChange={(event) => updateWidgetProps(node.id, { showArrows: event.target.checked })} />
            Show swipe arrows on home
          </label>
          <label className="checkbox-row">
            <input type="checkbox" checked={Boolean(node.props.showCloseButton ?? true)} onChange={(event) => updateWidgetProps(node.id, { showCloseButton: event.target.checked })} />
            Show close button
          </label>
          <div>
            <label>Swipe threshold — {Number(node.props.swipeThreshold ?? FOUR_FACES_DEFAULT_GLOBAL.swipeThreshold)} px</label>
            <input
              type="range"
              min={20}
              max={80}
              step={5}
              value={Number(node.props.swipeThreshold ?? FOUR_FACES_DEFAULT_GLOBAL.swipeThreshold)}
              onChange={(event) => updateWidgetProps(node.id, { swipeThreshold: Number(event.target.value) })}
            />
          </div>
          <ColorField node={node} propKey="closeButtonBg" label="Close button background" defaultValue={FOUR_FACES_DEFAULT_GLOBAL.closeButtonBg} />
          <ColorField node={node} propKey="closeButtonColor" label="Close button color" defaultValue={FOUR_FACES_DEFAULT_GLOBAL.closeButtonColor} />
        </div>
      </section>

      <section className="section section-premium">
        <h3>Home panel</h3>
        <div className="field-stack">
          <div>
            <label>Brand name</label>
            <input
              value={String(node.props.brandName ?? '')}
              placeholder="Brand Name"
              onChange={(event) => updateWidgetProps(node.id, { brandName: event.target.value })}
            />
          </div>
          <ColorField node={node} propKey="brandColor" label="Brand color" defaultValue={FOUR_FACES_DEFAULT_GLOBAL.brandColor} />
          <div>
            <label>Logo image (replaces brand name if set)</label>
            <AssetPicker node={node} srcKey="logoSrc" assetIdKey="logoAssetId" />
          </div>
          <div>
            <label>Headline</label>
            <textarea
              rows={2}
              value={String(node.props.homeTitle ?? '')}
              placeholder={FOUR_FACES_DEFAULT_HOME.title}
              onChange={(event) => updateWidgetProps(node.id, { homeTitle: event.target.value })}
            />
          </div>
          <ColorField node={node} propKey="homeTitleColor" label="Headline color" defaultValue={FOUR_FACES_DEFAULT_HOME.titleColor} />
          <div>
            <label>Subtitle</label>
            <textarea
              rows={2}
              value={String(node.props.homeSubtitle ?? '')}
              placeholder={FOUR_FACES_DEFAULT_HOME.subtitle}
              onChange={(event) => updateWidgetProps(node.id, { homeSubtitle: event.target.value })}
            />
          </div>
          <ColorField node={node} propKey="homeSubtitleColor" label="Subtitle color" defaultValue={FOUR_FACES_DEFAULT_HOME.subtitleColor} />
          <div>
            <label>Swipe hint text</label>
            <input
              value={String(node.props.homeHintText ?? '')}
              placeholder={FOUR_FACES_DEFAULT_HOME.hintText}
              onChange={(event) => updateWidgetProps(node.id, { homeHintText: event.target.value })}
            />
          </div>
          <ColorField node={node} propKey="homeHintColor" label="Hint color" defaultValue={FOUR_FACES_DEFAULT_HOME.hintColor} />
          <div className="inspector-two-col-grid">
            <div>
              <label>CTA label</label>
              <input
                value={String(node.props.homeCtaLabel ?? '')}
                placeholder={FOUR_FACES_DEFAULT_HOME.ctaLabel}
                onChange={(event) => updateWidgetProps(node.id, { homeCtaLabel: event.target.value })}
              />
            </div>
            <div>
              <label>CTA URL</label>
              <input
                value={String(node.props.homeCtaUrl ?? '')}
                placeholder="https://..."
                onChange={(event) => updateWidgetProps(node.id, { homeCtaUrl: event.target.value })}
              />
            </div>
          </div>
          <ColorField node={node} propKey="homeCtaBg" label="CTA background" defaultValue={FOUR_FACES_DEFAULT_HOME.ctaBg} />
          <ColorField node={node} propKey="homeCtaTextColor" label="CTA text color" defaultValue={FOUR_FACES_DEFAULT_HOME.ctaTextColor} />
          <div>
            <label>Hero image</label>
            <AssetPicker node={node} srcKey="heroSrc" assetIdKey="heroAssetId" />
          </div>
          <ColorField node={node} propKey="homeBg" label="Background color" defaultValue={FOUR_FACES_DEFAULT_HOME.bg} />
        </div>
      </section>

      <FaceSection node={node} dir="up" />
      <FaceSection node={node} dir="down" />
      <FaceSection node={node} dir="left" />
      <FaceSection node={node} dir="right" />
    </>
  );
}
