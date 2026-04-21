import { useEffect, useMemo, useState } from 'react';
import type { AssetRecord } from '../../assets/types';
import type { WidgetNode } from '../../domain/document/types';
import { useUiActions, useWidgetActions } from '../../hooks/use-studio-actions';
import { usePlatformSnapshot } from '../../platform/runtime';
import { listAssets } from '../../repositories/asset';
import { subscribeToAssetLibraryChanges } from '../../repositories/asset/events';

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
        <div style={{ borderRadius: 8, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)', aspectRatio: '16/9', background: 'rgba(255,255,255,0.04)' }}>
          <img src={previewSrc} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
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
          <button type="button" className="left-button compact-action" onClick={() => uiActions.setLeftTab('assets')}>
            Open library
          </button>
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
    <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8, alignItems: 'end' }}>
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
        style={{ width: 36, height: 36, borderRadius: 6, border: '1px solid rgba(255,255,255,0.12)', padding: 2, cursor: 'pointer', background: 'transparent' }}
        onChange={(event) => updateWidgetProps(node.id, { [propKey]: event.target.value })}
      />
    </div>
  );
}

type FaceDir = 'up' | 'down' | 'left' | 'right';
const FACE_LABELS: Record<FaceDir, string> = { up: 'Up', down: 'Down', left: 'Left', right: 'Right' };
const FACE_DEFAULT_HEADER: Record<FaceDir, string> = { up: '#C8102E', down: '#F5C400', left: '#ffffff', right: '#1A1A1A' };
const FACE_DEFAULT_COPY: Record<FaceDir, string> = { up: '#ffffff', down: '#1A1A1A', left: '#ffffff', right: '#ffffff' };
const FACE_DEFAULT_TITLE: Record<FaceDir, string> = { up: '#1a1a1a', down: '#ffffff', left: '#1a1a1a', right: '#1a1a1a' };
const FACE_DEFAULT_BODY: Record<FaceDir, string> = { up: '#555555', down: 'rgba(255,255,255,0.75)', left: '#555555', right: '#555555' };
const FACE_DEFAULT_CTA: Record<FaceDir, string> = { up: '#C8102E', down: '#F5C400', left: '#C8102E', right: '#C8102E' };
const FACE_DEFAULT_CTA_TEXT: Record<FaceDir, string> = { up: '#ffffff', down: '#1a1a1a', left: '#ffffff', right: '#ffffff' };

function FaceSection({ node, dir }: { node: WidgetNode; dir: FaceDir }): JSX.Element {
  const { updateWidgetProps } = useWidgetActions();

  return (
    <section className="section section-premium">
      <h3>Face {FACE_LABELS[dir]}</h3>
      <div className="field-stack">
        <div>
          <label>Title</label>
          <input
            value={String(node.props[`${dir}Title`] ?? '')}
            placeholder="Title"
            onChange={(event) => updateWidgetProps(node.id, { [`${dir}Title`]: event.target.value })}
          />
        </div>
        <ColorField node={node} propKey={`${dir}TitleColor`} label="Title color" defaultValue={FACE_DEFAULT_TITLE[dir]} />
        <div>
          <label>Body copy</label>
          <textarea
            rows={2}
            value={String(node.props[`${dir}Body`] ?? '')}
            placeholder="Description..."
            onChange={(event) => updateWidgetProps(node.id, { [`${dir}Body`]: event.target.value })}
          />
        </div>
        <ColorField node={node} propKey={`${dir}BodyColor`} label="Body color" defaultValue={FACE_DEFAULT_BODY[dir]} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <div>
            <label>CTA label</label>
            <input
              value={String(node.props[`${dir}CtaLabel`] ?? '')}
              placeholder="Learn more"
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
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 10, marginTop: 2 }}>
          <div style={{ fontSize: 11, opacity: 0.5, marginBottom: 8, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Colors</div>
          <div className="field-stack">
            <ColorField node={node} propKey={`${dir}HeaderBg`} label="Header background" defaultValue={FACE_DEFAULT_HEADER[dir]} />
            <ColorField node={node} propKey={`${dir}CopyBg`} label="Copy area background" defaultValue={FACE_DEFAULT_COPY[dir]} />
            <ColorField node={node} propKey={`${dir}CtaBg`} label="CTA button color" defaultValue={FACE_DEFAULT_CTA[dir]} />
            <ColorField node={node} propKey={`${dir}CtaTextColor`} label="CTA text color" defaultValue={FACE_DEFAULT_CTA_TEXT[dir]} />
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
          <ColorField node={node} propKey="accentColor" label="Accent color" defaultValue="#C8102E" />
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
            <label>Swipe threshold — {Number(node.props.swipeThreshold ?? 40)} px</label>
            <input
              type="range"
              min={20}
              max={80}
              step={5}
              value={Number(node.props.swipeThreshold ?? 40)}
              onChange={(event) => updateWidgetProps(node.id, { swipeThreshold: Number(event.target.value) })}
            />
          </div>
          <ColorField node={node} propKey="closeButtonBg" label="Close button background" defaultValue="rgba(0,0,0,0.5)" />
          <ColorField node={node} propKey="closeButtonColor" label="Close button color" defaultValue="#ffffff" />
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
          <ColorField node={node} propKey="brandColor" label="Brand color" defaultValue="#C8102E" />
          <div>
            <label>Logo image (replaces brand name if set)</label>
            <AssetPicker node={node} srcKey="logoSrc" assetIdKey="logoAssetId" />
          </div>
          <div>
            <label>Headline</label>
            <textarea
              rows={2}
              value={String(node.props.homeTitle ?? '')}
              placeholder="Headline principal"
              onChange={(event) => updateWidgetProps(node.id, { homeTitle: event.target.value })}
            />
          </div>
          <ColorField node={node} propKey="homeTitleColor" label="Headline color" defaultValue="#1a1a1a" />
          <div>
            <label>Subtitle</label>
            <textarea
              rows={2}
              value={String(node.props.homeSubtitle ?? '')}
              placeholder="Short description or value proposition"
              onChange={(event) => updateWidgetProps(node.id, { homeSubtitle: event.target.value })}
            />
          </div>
          <ColorField node={node} propKey="homeSubtitleColor" label="Subtitle color" defaultValue="#555555" />
          <div>
            <label>Swipe hint text</label>
            <input
              value={String(node.props.homeHintText ?? '')}
              placeholder="Swipe to explore"
              onChange={(event) => updateWidgetProps(node.id, { homeHintText: event.target.value })}
            />
          </div>
          <ColorField node={node} propKey="homeHintColor" label="Hint color" defaultValue="#999999" />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div>
              <label>CTA label</label>
              <input
                value={String(node.props.homeCtaLabel ?? '')}
                placeholder="Learn more"
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
          <ColorField node={node} propKey="homeCtaBg" label="CTA background" defaultValue="#C8102E" />
          <ColorField node={node} propKey="homeCtaTextColor" label="CTA text color" defaultValue="#ffffff" />
          <div>
            <label>Hero image</label>
            <AssetPicker node={node} srcKey="heroSrc" assetIdKey="heroAssetId" />
          </div>
          <ColorField node={node} propKey="homeBg" label="Background color" defaultValue="#F2F2F2" />
        </div>
      </section>

      <FaceSection node={node} dir="up" />
      <FaceSection node={node} dir="down" />
      <FaceSection node={node} dir="left" />
      <FaceSection node={node} dir="right" />
    </>
  );
}
