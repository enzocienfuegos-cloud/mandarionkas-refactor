import { useEffect, useMemo, useState } from 'react';
import type { AssetRecord } from '../../assets/types';
import type { WidgetNode } from '../../domain/document/types';
import { useUiActions, useWidgetActions } from '../../hooks/use-studio-actions';
import { listAssets } from '../../repositories/asset';
import { subscribeToAssetLibraryChanges } from '../../repositories/asset/events';
import { usePlatformSnapshot } from '../../platform/runtime';

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
  const uiActions = useUiActions();
  const n = slideIndex;

  const srcKey = `slide${n}Src` as const;
  const assetIdKey = `slide${n}AssetId` as const;
  const kindKey = `slide${n}Kind` as const;
  const durKey = `slide${n}DurationMs` as const;

  const currentKind = String(node.props[kindKey] ?? 'image');
  const currentAssetId = String(node.props[assetIdKey] ?? '');
  const currentDur = Number(node.props[durKey] ?? 5000);

  const eligibleAssets = useMemo(
    () => assets.filter((a) => a.kind === currentKind),
    [assets, currentKind],
  );

  return (
    <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)', paddingTop: 12, marginTop: 4 }}>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', opacity: 0.6, marginBottom: 8 }}>
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
        <div>
          <label>Source URL</label>
          <input
            value={String(node.props[srcKey] ?? '')}
            placeholder={currentKind === 'video' ? 'https://.../video.mp4' : 'https://.../image.jpg'}
            onChange={(e) => updateWidgetProps(node.id, { [srcKey]: e.target.value, [assetIdKey]: '' })}
          />
        </div>

        {/* Asset library picker */}
        <div>
          <label>Asset library</label>
          <div className="asset-inline-actions">
            <select
              value={currentAssetId}
              onChange={(e) => {
                const asset = eligibleAssets.find((a) => a.id === e.target.value);
                updateWidgetProps(node.id, asset
                  ? { [assetIdKey]: asset.id, [srcKey]: asset.src }
                  : { [assetIdKey]: '', [srcKey]: '' });
              }}
            >
              <option value="">No linked asset</option>
              {eligibleAssets.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
            <button type="button" className="left-button compact-action" onClick={() => uiActions.setLeftTab('assets')}>
              Open library
            </button>
          </div>
        </div>

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
          <div style={{ fontSize: 11, opacity: 0.55, padding: '2px 0' }}>
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
  const uiActions = useUiActions();
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
              value={String(node.props.username ?? 'yourbrand')}
              placeholder="yourbrand"
              onChange={(e) => updateWidgetProps(node.id, { username: e.target.value })}
            />
          </div>
          <div>
            <label>Avatar URL</label>
            <input
              value={String(node.props.avatarSrc ?? '')}
              placeholder="https://.../avatar.jpg"
              onChange={(e) => updateWidgetProps(node.id, { avatarSrc: e.target.value, avatarAssetId: '' })}
            />
          </div>
          <div>
            <label>Avatar from library</label>
            <div className="asset-inline-actions">
              <select
                value={String(node.props.avatarAssetId ?? '')}
                onChange={(e) => {
                  const asset = avatarAssets.find((a) => a.id === e.target.value);
                  updateWidgetProps(node.id, asset
                    ? { avatarAssetId: asset.id, avatarSrc: asset.src }
                    : { avatarAssetId: '', avatarSrc: '' });
                }}
              >
                <option value="">No linked asset</option>
                {avatarAssets.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
              <button type="button" className="left-button compact-action" onClick={() => uiActions.setLeftTab('assets')}>
                Open library
              </button>
            </div>
          </div>
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
