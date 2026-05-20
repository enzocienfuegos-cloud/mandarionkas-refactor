import { useEffect, useState } from 'react';
import { assetHasSourceUrl } from '../../assets/policy';
import type { ReleaseTarget, SceneNode } from '../../domain/document/types';
import type { WidgetNode } from '../../domain/document/types';
import type { AssetRecord } from '../../assets/types';
import { useStudioStore } from '../../core/store/use-studio-store';
import { listAssets } from '../../repositories/asset';
import { subscribeToAssetLibraryChanges } from '../../repositories/asset/events';
import { usePlatformSnapshot } from '../../platform/runtime';
import { useWidgetActions } from '../../hooks/use-studio-actions';
import { Button } from '../../shared/ui/Button';
import { InspectorRangeField } from '../../shared/ui/InspectorRangeField';
import { requestOpenAssetLibrary } from '../../shared/asset-library-events';
import type { ScratchRevealMode } from './scratch-reveal.renderer';

function resolveLinkedImageAsset(
  assets: AssetRecord[],
  assetId: string,
  imageUrl: string,
  targetChannel: ReleaseTarget,
): AssetRecord | undefined {
  return assets.find((a) => a.id === assetId)
    ?? assets.find((a) => assetHasSourceUrl(a, imageUrl, targetChannel));
}

function ScratchImageSlot({
  label,
  imageUrl,
  asset,
  emptyLabel,
  onChoose,
  onClear,
}: {
  label: string;
  imageUrl: string;
  asset?: AssetRecord;
  emptyLabel: string;
  onChoose: () => void;
  onClear: () => void;
}): JSX.Element {
  return (
    <div className="field-stack">
      <label>{label}</label>
      {imageUrl ? (
        <div className="asset-detail-card">
          <div className="meta-line asset-detail-head">
            <div className="asset-detail-title">
              <strong>{asset?.name ?? 'Selected image'}</strong>
              <small>{asset ? 'Linked from asset library.' : 'Attached to this scratch slot.'}</small>
            </div>
          </div>
          <div className="asset-detail-preview">
            <img className="asset-detail-img" src={imageUrl} alt={asset?.name ?? label} />
          </div>
        </div>
      ) : (
        <small className="muted">{emptyLabel}</small>
      )}
      <div className="asset-inline-actions">
        <Button size="sm" className="left-button compact-action" onClick={onChoose}>
          {imageUrl ? 'Change image' : 'Choose image'}
        </Button>
        <Button variant="ghost" size="sm" className="compact-action" onClick={onClear} disabled={!imageUrl}>
          Remove
        </Button>
      </div>
    </div>
  );
}

export function ScratchRevealInspector({ widget }: { widget: WidgetNode }): JSX.Element {
  const widgetActions = useWidgetActions();
  const platform = usePlatformSnapshot();
  const targetChannel = useStudioStore((state) => state.document.metadata.release.targetChannel) as ReleaseTarget;
  const scenes = useStudioStore((state) => state.document.scenes);
  const currentSceneId = widget.sceneId;
  const otherScenes: SceneNode[] = scenes.filter((s) => s.id !== currentSceneId);

  const [assets, setAssets] = useState<AssetRecord[]>([]);

  useEffect(() => {
    if (!platform.session.isAuthenticated || !platform.session.sessionId) {
      setAssets([]);
      return;
    }
    let cancelled = false;
    const sync = () => {
      void listAssets()
        .then((records) => { if (!cancelled) setAssets(records.filter((a) => a.kind === 'image')); })
        .catch(() => { if (!cancelled) setAssets([]); });
    };
    sync();
    const unsub = subscribeToAssetLibraryChanges(sync);
    return () => { cancelled = true; unsub(); };
  }, [platform.session.isAuthenticated, platform.session.sessionId]);

  const revealMode = String(widget.props.revealMode ?? 'image') as ScratchRevealMode;
  const beforeImage = String(widget.props.beforeImage ?? '').trim();
  const afterImage = String(widget.props.afterImage ?? '').trim();
  const coverColor = String(widget.props.coverColor ?? '').trim();
  const revealTargetSceneId = String(widget.props.revealTargetSceneId ?? '').trim();

  const linkedBeforeAsset = resolveLinkedImageAsset(assets, String(widget.props.beforeAssetId ?? '').trim(), beforeImage, targetChannel);
  const linkedAfterAsset = resolveLinkedImageAsset(assets, String(widget.props.afterAssetId ?? '').trim(), afterImage, targetChannel);

  const set = (patch: Record<string, unknown>) => widgetActions.updateWidgetProps(widget.id, patch);

  return (
    <section className="section section-premium">
      <h3>Scratch & reveal</h3>
      <div className="field-stack">

        {/* ── Reveal mode ───────────────────────────────── */}
        <strong>Reveal mode</strong>
        <div>
          <label>When threshold is reached</label>
          <select value={revealMode} onChange={(e) => set({ revealMode: e.target.value })}>
            <option value="image">Show a reveal image</option>
            <option value="layers-below">Reveal layers below this widget</option>
            <option value="scene">Transition to another scene</option>
          </select>
        </div>

        {revealMode === 'layers-below' && (
          <div className="meta-line">
            This widget acts as a scratch cover overlay. Position it on top of the widgets you want to reveal.
            Those widgets keep all their animations (fade, float, pulse) — they&apos;re never canvas-painted.
          </div>
        )}

        {revealMode === 'scene' && (
          <div>
            <label>Go to scene</label>
            <select
              value={revealTargetSceneId}
              onChange={(e) => set({ revealTargetSceneId: e.target.value })}
            >
              <option value="">Select scene…</option>
              {otherScenes.map((s) => (
                <option key={s.id} value={s.id}>{s.name || `Scene ${s.order}`}</option>
              ))}
            </select>
            {!revealTargetSceneId && (
              <small className="muted">Pick a destination scene above.</small>
            )}
          </div>
        )}

        {revealMode === 'image' && (
          <ScratchImageSlot
            label="Reveal image"
            imageUrl={afterImage}
            asset={linkedAfterAsset}
            emptyLabel="No reveal image selected yet."
            onChoose={() => requestOpenAssetLibrary({ target: 'scratch-reveal' })}
            onClear={() => set({ afterAssetId: '', afterImage: '' })}
          />
        )}

        {/* ── Cover ─────────────────────────────────────── */}
        <strong>Cover</strong>
        <ScratchImageSlot
          label="Cover image (optional)"
          imageUrl={beforeImage}
          asset={linkedBeforeAsset}
          emptyLabel="No cover image — a solid color will be used."
          onChoose={() => requestOpenAssetLibrary({ target: 'scratch-cover' })}
          onClear={() => set({ beforeAssetId: '', beforeImage: '' })}
        />
        <div>
          <label>Cover color</label>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              type="color"
              value={coverColor || '#1e293b'}
              onChange={(e) => set({ coverColor: e.target.value })}
              style={{ width: 40, height: 32, padding: 2, cursor: 'pointer' }}
            />
            <span style={{ fontSize: 12, opacity: 0.7 }}>
              {beforeImage ? 'Image takes priority over color' : 'Used as fallback when no image'}
            </span>
          </div>
        </div>
        <InspectorRangeField
          label="Cover blur"
          min={0}
          max={20}
          step={1}
          unit="px"
          value={Number(widget.props.coverBlur ?? 0)}
          onChange={(v) => set({ coverBlur: v })}
        />

        {/* ── Scratch ───────────────────────────────────── */}
        <strong>Scratch</strong>
        <InspectorRangeField
          label="Brush radius"
          min={8}
          max={80}
          step={1}
          unit="px"
          value={Number(widget.props.scratchRadius ?? 22)}
          onChange={(v) => set({ scratchRadius: v })}
          helpText="Larger brush clears more area per swipe."
        />
        <InspectorRangeField
          label="Auto-reveal threshold"
          min={0}
          max={100}
          step={1}
          unit="%"
          value={Number(widget.props.autoRevealThresholdPercent ?? 60)}
          onChange={(v) => set({ autoRevealThresholdPercent: v })}
          helpText="How much must be cleared to auto-complete. 0 = manual only."
        />

        {/* ── Reveal animation (image mode only) ────────── */}
        {revealMode === 'image' && (
          <>
            <strong>Reveal animation</strong>
            <div>
              <label>Animation preset</label>
              <select
                value={String(widget.props.revealAnimationPreset ?? 'none')}
                onChange={(e) => set({ revealAnimationPreset: e.target.value })}
              >
                <option value="none">None</option>
                <option value="appear">Appear (fade in)</option>
                <option value="fade-up">Fade up</option>
                <option value="zoom-in">Zoom in</option>
              </select>
            </div>
            <InspectorRangeField
              label="Duration"
              min={150}
              max={3000}
              step={50}
              unit="ms"
              value={Number(widget.props.revealAnimationDurationMs ?? 700)}
              onChange={(v) => set({ revealAnimationDurationMs: v })}
            />
            <InspectorRangeField
              label="Delay"
              min={0}
              max={3000}
              step={50}
              unit="ms"
              value={Number(widget.props.revealAnimationDelayMs ?? 0)}
              onChange={(v) => set({ revealAnimationDelayMs: v })}
            />
            <div>
              <label>Title</label>
              <input value={String(widget.props.title ?? '')} onChange={(e) => set({ title: e.target.value })} />
            </div>
            <div>
              <label>Cover label</label>
              <input value={String(widget.props.coverLabel ?? '')} onChange={(e) => set({ coverLabel: e.target.value })} />
            </div>
            <div>
              <label>Reveal label</label>
              <input value={String(widget.props.revealLabel ?? '')} onChange={(e) => set({ revealLabel: e.target.value })} />
            </div>
          </>
        )}

      </div>
    </section>
  );
}
