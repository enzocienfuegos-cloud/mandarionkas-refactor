import { useEffect, useMemo, useState } from 'react';
import type { AssetRecord } from '../../assets/types';
import type { WidgetNode } from '../../domain/document/types';
import { useWidgetActions } from '../../hooks/use-studio-actions';
import { listAssets } from '../../repositories/asset';
import { subscribeToAssetLibraryChanges } from '../../repositories/asset/events';
import { usePlatformSnapshot } from '../../platform/runtime';
import { AssetPickerButton } from '../../shared/ui/AssetPickerButton';
import { INSTAGRAM_STORY_DEFAULT_USERNAME } from './instagram-story.shared';

// ─── Shared asset hook ────────────────────────────────────────────────────────

function useAssets() {
  const platform = usePlatformSnapshot();
  const [assets, setAssets] = useState<AssetRecord[]>([]);

  useEffect(() => {
    if (!platform.session.isAuthenticated || !platform.session.sessionId) {
      setAssets([]);
      return;
    }
    let cancelled = false;
    const sync = () => void listAssets()
      .then((r) => { if (!cancelled) setAssets(r); })
      .catch(() => { if (!cancelled) setAssets([]); });
    sync();
    const unsub = subscribeToAssetLibraryChanges(sync);
    return () => { cancelled = true; unsub(); };
  }, [platform.session.isAuthenticated, platform.session.sessionId]);

  return assets;
}

// ─── Per-slide asset picker ───────────────────────────────────────────────────

function SlideConfig({
  node,
  slideIndex,
  assets,
}: {
  node: WidgetNode;
  slideIndex: 1 | 2 | 3;
  assets: AssetRecord[];
}) {
  const { updateWidgetProps } = useWidgetActions();
  const n = slideIndex;

  const srcKey = `slide${n}Src` as const;
  const assetIdKey = `slide${n}AssetId` as const;
  const kindKey = `slide${n}Kind` as const;
  const durKey = `slide${n}DurationMs` as const;

  const currentKind = String(node.props[kindKey] ?? 'image');
  const currentAssetId = String(node.props[assetIdKey] ?? '');
  const currentDur = Number(node.props[durKey] ?? 5000);

  return (
    <div className="inspector-subsection inspector-subsection--spacious">
      <div className="inspector-subsection-title">
        Slide {n}
      </div>
      <div className="field-stack">
        {/* Kind toggle */}
        <div>
          <label>Type</label>
          <select
            value={currentKind}
            onChange={(e) => updateWidgetProps(node.id, {
              [kindKey]: e.target.value,
              [srcKey]: '',
              [assetIdKey]: '',
            })}
          >
            <option value="image">Image</option>
            <option value="video">Video</option>
          </select>
        </div>

        {/* Source URL */}
        <AssetPickerButton
          label={currentKind === 'video' ? 'Slide video' : 'Slide image'}
          assetId={currentAssetId || undefined}
          imageUrl={String(node.props[srcKey] ?? '')}
          accept={currentKind === 'video' ? 'video' : 'image'}
          assets={assets.filter((asset) => asset.kind === currentKind)}
          onChange={(asset) => updateWidgetProps(node.id, { [assetIdKey]: asset.id, [srcKey]: asset.src })}
          onClear={() => updateWidgetProps(node.id, { [assetIdKey]: '', [srcKey]: '' })}
        />

        {/* Duration (only for image slides — video duration is auto) */}
        {currentKind === 'image' && (
          <div>
            <label>Duration (ms)</label>
            <input
              type="number"
              min={500}
              step={500}
              value={currentDur}
              onChange={(e) => updateWidgetProps(node.id, { [durKey]: Math.max(500, Number(e.target.value)) })}
            />
          </div>
        )}
        {currentKind === 'video' && (
          <div className="inspector-inline-note">
            Duration is determined by the video file.
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Full inspector ───────────────────────────────────────────────────────────

export function InstagramStoryInspector({ node }: { node: WidgetNode }): JSX.Element {
  const { updateWidgetProps } = useWidgetActions();
  const assets = useAssets();

  const avatarAssets = useMemo(() => assets.filter((a) => a.kind === 'image'), [assets]);

  return (
    <>
      {/* Account info */}
      <section className="section section-premium">
        <h3>Account</h3>
        <div className="field-stack">
          <div>
            <label>Username</label>
            <input
              value={String(node.props.username ?? INSTAGRAM_STORY_DEFAULT_USERNAME)}
              placeholder={INSTAGRAM_STORY_DEFAULT_USERNAME}
              onChange={(e) => updateWidgetProps(node.id, { username: e.target.value })}
            />
          </div>
          <AssetPickerButton
            label="Avatar"
            assetId={String(node.props.avatarAssetId ?? '') || undefined}
            imageUrl={String(node.props.avatarSrc ?? '')}
            accept="image"
            assets={avatarAssets}
            onChange={(asset) => updateWidgetProps(node.id, { avatarAssetId: asset.id, avatarSrc: asset.src })}
            onClear={() => updateWidgetProps(node.id, { avatarAssetId: '', avatarSrc: '' })}
          />
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={Boolean(node.props.muted ?? true)}
              onChange={(e) => updateWidgetProps(node.id, { muted: e.target.checked })}
            />
            Start muted
          </label>
        </div>
      </section>

      {/* Slides */}
      <section className="section section-premium">
        <h3>Slides</h3>
        <SlideConfig node={node} slideIndex={1} assets={assets} />
        <SlideConfig node={node} slideIndex={2} assets={assets} />
        <SlideConfig node={node} slideIndex={3} assets={assets} />
      </section>
    </>
  );
}
