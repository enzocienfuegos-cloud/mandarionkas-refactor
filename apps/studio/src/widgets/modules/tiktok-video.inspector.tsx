import { useEffect, useMemo, useState } from 'react';
import type { AssetRecord } from '../../assets/types';
import type { WidgetNode } from '../../domain/document/types';
import { useWidgetActions } from '../../hooks/use-studio-actions';
import { usePlatformSnapshot } from '../../platform/runtime';
import { listAssets } from '../../repositories/asset';
import { subscribeToAssetLibraryChanges } from '../../repositories/asset/events';
import { Button } from '../../shared/ui/Button';
import { requestOpenAssetLibrary } from '../../shared/asset-library-events';
import {
  TIKTOK_VIDEO_DEFAULT_CAPTION,
  TIKTOK_VIDEO_DEFAULT_COMMENTS_COUNT,
  TIKTOK_VIDEO_DEFAULT_CTA_LABEL,
  TIKTOK_VIDEO_DEFAULT_HASHTAGS,
  TIKTOK_VIDEO_DEFAULT_LIKES_COUNT,
  TIKTOK_VIDEO_DEFAULT_SHARES_COUNT,
  TIKTOK_VIDEO_DEFAULT_USERNAME,
} from './tiktok-video.shared';

function useAssets(kind: 'image' | 'video' | 'both'): AssetRecord[] {
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
          if (!cancelled) {
            setAssets(kind === 'both' ? records : records.filter((asset) => asset.kind === kind));
          }
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
  }, [platform.session.isAuthenticated, platform.session.sessionId, kind]);

  return assets;
}

function VideoAssetPicker({ node }: { node: WidgetNode }): JSX.Element {
  const { updateWidgetProps } = useWidgetActions();
  const assets = useAssets('video');
  const linkedId = String(node.props.videoAssetId ?? '');
  const linkedAsset = useMemo(() => assets.find((asset) => asset.id === linkedId), [assets, linkedId]);

  return (
    <div className="field-stack">
      <div>
        <label>Video URL (MP4)</label>
        <input
          value={String(node.props.videoSrc ?? '')}
          placeholder="https://.../video.mp4"
          onChange={(event) => updateWidgetProps(node.id, { videoSrc: event.target.value, videoAssetId: '' })}
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
                asset ? { videoAssetId: asset.id, videoSrc: asset.src } : { videoAssetId: '', videoSrc: '' },
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
          <Button size="sm" className="left-button compact-action" onClick={requestOpenAssetLibrary}>Open library</Button>
        </div>
      </div>
      {linkedAsset ? <small className="muted">Linked: {linkedAsset.name}</small> : null}
    </div>
  );
}

function ImageAssetPicker({
  node,
  srcKey,
  assetIdKey,
  label,
}: {
  node: WidgetNode;
  srcKey: string;
  assetIdKey: string;
  label: string;
}): JSX.Element {
  const { updateWidgetProps } = useWidgetActions();
  const assets = useAssets('image');
  const linkedId = String(node.props[assetIdKey] ?? '');

  const previewSrc = useMemo(() => {
    if (!linkedId) return String(node.props[srcKey] ?? '');
    const asset = assets.find((record) => record.id === linkedId);
    return asset?.thumbnailUrl ?? asset?.derivatives?.thumbnail?.src ?? asset?.src ?? String(node.props[srcKey] ?? '');
  }, [assets, linkedId, node.props, srcKey]);

  return (
    <div className="field-stack">
      {previewSrc ? (
        <div className="inspector-preview-frame inspector-preview-frame--avatar">
          <img src={previewSrc} alt="" className="inspector-preview-media" />
        </div>
      ) : null}
      <div>
        <label>{label} URL</label>
        <input
          value={String(node.props[srcKey] ?? '')}
          placeholder="https://.../image.jpg"
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
          <Button size="sm" className="left-button compact-action" onClick={requestOpenAssetLibrary}>Open library</Button>
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

export function TikTokVideoInspector({ node }: { node: WidgetNode }): JSX.Element {
  const { updateWidgetProps } = useWidgetActions();

  return (
    <>
      <section className="section section-premium">
        <h3>Background video</h3>
        <div className="field-stack">
          <VideoAssetPicker node={node} />
          <small className="muted">MP4 recomendado · ratio 9:16 · se reproduce en loop y muted por defecto</small>
        </div>
      </section>

      <section className="section section-premium">
        <h3>Profile</h3>
        <div className="field-stack">
          <div>
            <label>Username (without @)</label>
            <input
              value={String(node.props.username ?? TIKTOK_VIDEO_DEFAULT_USERNAME)}
              placeholder={TIKTOK_VIDEO_DEFAULT_USERNAME}
              onChange={(event) => updateWidgetProps(node.id, { username: event.target.value })}
            />
          </div>
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={Boolean(node.props.showVerified ?? true)}
              onChange={(event) => updateWidgetProps(node.id, { showVerified: event.target.checked })}
            />
            Show verified badge
          </label>
          <ImageAssetPicker node={node} srcKey="avatarSrc" assetIdKey="avatarAssetId" label="Avatar" />
        </div>
      </section>

      <section className="section section-premium">
        <h3>Post content</h3>
        <div className="field-stack">
          <div>
            <label>Caption</label>
            <textarea
              rows={3}
              value={String(node.props.caption ?? TIKTOK_VIDEO_DEFAULT_CAPTION)}
              placeholder={TIKTOK_VIDEO_DEFAULT_CAPTION}
              onChange={(event) => updateWidgetProps(node.id, { caption: event.target.value })}
            />
          </div>
          <div>
            <label>Hashtags</label>
            <input
              value={String(node.props.hashtags ?? TIKTOK_VIDEO_DEFAULT_HASHTAGS)}
              placeholder={TIKTOK_VIDEO_DEFAULT_HASHTAGS}
              onChange={(event) => updateWidgetProps(node.id, { hashtags: event.target.value })}
            />
          </div>
        </div>
      </section>

      <section className="section section-premium">
        <h3>Social stats</h3>
        <div className="field-stack">
          <div className="inspector-three-col-grid">
            <div>
              <label>Likes</label>
              <input
                value={String(node.props.likesCount ?? TIKTOK_VIDEO_DEFAULT_LIKES_COUNT)}
                onChange={(event) => updateWidgetProps(node.id, { likesCount: event.target.value })}
              />
            </div>
            <div>
              <label>Comments</label>
              <input
                value={String(node.props.commentsCount ?? TIKTOK_VIDEO_DEFAULT_COMMENTS_COUNT)}
                onChange={(event) => updateWidgetProps(node.id, { commentsCount: event.target.value })}
              />
            </div>
            <div>
              <label>Shares</label>
              <input
                value={String(node.props.sharesCount ?? TIKTOK_VIDEO_DEFAULT_SHARES_COUNT)}
                onChange={(event) => updateWidgetProps(node.id, { sharesCount: event.target.value })}
              />
            </div>
          </div>
        </div>
      </section>

      <section className="section section-premium">
        <h3>CTA button</h3>
        <div className="field-stack">
          <div>
            <label>Label</label>
            <input
              value={String(node.props.ctaLabel ?? TIKTOK_VIDEO_DEFAULT_CTA_LABEL)}
              placeholder={TIKTOK_VIDEO_DEFAULT_CTA_LABEL}
              onChange={(event) => updateWidgetProps(node.id, { ctaLabel: event.target.value })}
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
          <ColorField node={node} propKey="ctaColor" label="Background color" defaultValue="#fe2c55" />
          <ColorField node={node} propKey="ctaTextColor" label="Text color" defaultValue="#ffffff" />
        </div>
      </section>

      <section className="section section-premium">
        <h3>Features</h3>
        <div className="field-stack">
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={Boolean(node.props.showHearts ?? true)}
              onChange={(event) => updateWidgetProps(node.id, { showHearts: event.target.checked })}
            />
            Floating hearts animation
          </label>
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={Boolean(node.props.showProgressBar ?? true)}
              onChange={(event) => updateWidgetProps(node.id, { showProgressBar: event.target.checked })}
            />
            Video progress bar
          </label>
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={Boolean(node.props.showMuteButton ?? true)}
              onChange={(event) => updateWidgetProps(node.id, { showMuteButton: event.target.checked })}
            />
            Mute/unmute button
          </label>
        </div>
      </section>
    </>
  );
}
