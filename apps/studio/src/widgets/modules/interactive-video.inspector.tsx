import { useEffect, useMemo, useState } from 'react';
import type { OverlayConfig, OverlayKind } from '@smx/contracts';
import { OVERLAY_SCHEMA_REGISTRY } from '@smx/contracts';
import type { AssetRecord } from '../../assets/types';
import type { WidgetNode } from '../../domain/document/types';
import { useUiActions, useWidgetActions } from '../../hooks/use-studio-actions';
import { usePlatformSnapshot } from '../../platform/runtime';
import { listAssets } from '../../repositories/asset';
import { subscribeToAssetLibraryChanges } from '../../repositories/asset/events';
import { OverlayConfigForm } from '../video/editor/OverlayConfigForm';

function useAssets(kind: AssetRecord['kind']): AssetRecord[] {
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

function AssetPicker({
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
        <div style={{ borderRadius: 8, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)', aspectRatio: '16/9', background: 'rgba(255,255,255,0.04)' }}>
          {label.toLowerCase().includes('poster')
            ? <img src={previewSrc} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
            : <video src={previewSrc} muted playsInline style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />}
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
          <button type="button" className="left-button compact-action" onClick={() => uiActions.setLeftTab('assets')}>
            Open library
          </button>
        </div>
      </div>
    </div>
  );
}

function NumberField({
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

export function InteractiveVideoInspector({ node }: { node: WidgetNode }): JSX.Element {
  const { updateWidgetProps } = useWidgetActions();
  const videoAssets = useAssets('video');
  const imageAssets = useAssets('image');
  const [editingOverlayId, setEditingOverlayId] = useState<string | null>(null);
  const configuredOverlays = useMemo(() => (
    Array.isArray(node.props.overlaysConfig) ? (node.props.overlaysConfig as OverlayConfig[]) : []
  ), [node.props.overlaysConfig]);

  function updateConfiguredOverlays(next: OverlayConfig[]): void {
    updateWidgetProps(node.id, { overlaysConfig: next });
  }

  function addOverlay(kind: OverlayKind): void {
    const schema = OVERLAY_SCHEMA_REGISTRY[kind];
    if (!schema) return;
    const content = schema.fields.reduce<Record<string, unknown>>((acc, field) => {
      if (field.defaultValue !== undefined) {
        const parts = field.key.split('.');
        let current: Record<string, unknown> = acc;
        while (parts.length > 1) {
          const part = parts.shift()!;
          current[part] = (current[part] as Record<string, unknown>) ?? {};
          current = current[part] as Record<string, unknown>;
        }
        current[parts[0]!] = field.defaultValue;
      }
      return acc;
    }, {});
    const overlay: OverlayConfig = {
      id: `overlay-${Date.now()}`,
      kind,
      triggerMs: 0,
      position: { left: 5, top: 5, width: 30 },
      content: content as unknown as OverlayConfig['content'],
    };
    updateConfiguredOverlays([...configuredOverlays, overlay]);
    setEditingOverlayId(overlay.id);
  }

  function updateOverlay(updated: OverlayConfig): void {
    updateConfiguredOverlays(configuredOverlays.map((item) => item.id === updated.id ? updated : item));
  }

  function removeOverlay(id: string): void {
    updateConfiguredOverlays(configuredOverlays.filter((item) => item.id !== id));
    if (editingOverlayId === id) setEditingOverlayId(null);
  }

  return (
    <>
      <section className="section section-premium">
        <h3>Media</h3>
        <div className="field-stack">
          <div>
            <label>Title</label>
            <input value={String(node.props.title ?? '')} onChange={(event) => updateWidgetProps(node.id, { title: event.target.value })} />
          </div>
          <AssetPicker node={node} assets={videoAssets} label="Video" srcKey="src" assetIdKey="assetId" placeholder="https://.../video.mp4" />
          <AssetPicker node={node} assets={imageAssets} label="Poster" srcKey="posterSrc" assetIdKey="posterAssetId" placeholder="https://.../poster.jpg" />
          <div className="fields-grid">
            <div>
              <label>MIME type</label>
              <input value={String(node.props.mimeType ?? '')} placeholder="video/mp4" onChange={(event) => updateWidgetProps(node.id, { mimeType: event.target.value })} />
            </div>
            <div>
              <label>Aspect ratio</label>
              <input value={String(node.props.aspectRatio ?? '9/16')} placeholder="9/16" onChange={(event) => updateWidgetProps(node.id, { aspectRatio: event.target.value })} />
            </div>
          </div>
          <div>
            <label>ARIA label</label>
            <input value={String(node.props.ariaLabel ?? '')} placeholder="Interactive video" onChange={(event) => updateWidgetProps(node.id, { ariaLabel: event.target.value })} />
          </div>
        </div>
      </section>

      <section className="section section-premium">
        <h3>Playback</h3>
        <div className="field-stack">
          <label className="checkbox-row"><input type="checkbox" checked={Boolean(node.props.autoPlay ?? true)} onChange={(event) => updateWidgetProps(node.id, { autoPlay: event.target.checked })} /> Autoplay</label>
          <label className="checkbox-row"><input type="checkbox" checked={Boolean(node.props.startMuted ?? true)} onChange={(event) => updateWidgetProps(node.id, { startMuted: event.target.checked })} /> Start muted</label>
          <label className="checkbox-row"><input type="checkbox" checked={Boolean(node.props.loop ?? false)} onChange={(event) => updateWidgetProps(node.id, { loop: event.target.checked })} /> Loop</label>
          <label className="checkbox-row"><input type="checkbox" checked={Boolean(node.props.showControls ?? false)} onChange={(event) => updateWidgetProps(node.id, { showControls: event.target.checked })} /> Show native controls</label>
          <label className="checkbox-row"><input type="checkbox" checked={Boolean(node.props.clickToToggle ?? true)} onChange={(event) => updateWidgetProps(node.id, { clickToToggle: event.target.checked })} /> Click to toggle play/pause</label>
          <label className="checkbox-row"><input type="checkbox" checked={Boolean(node.props.showMuteButton ?? true)} onChange={(event) => updateWidgetProps(node.id, { showMuteButton: event.target.checked })} /> Show mute button</label>
        </div>
      </section>

      <section className="section section-premium">
        <h3>VAST</h3>
        <div className="field-stack">
          <div>
            <label>VAST tag URL</label>
            <input value={String(node.props.vastTagUrl ?? '')} placeholder="https://ads.example.com/vast" onChange={(event) => updateWidgetProps(node.id, { vastTagUrl: event.target.value })} />
          </div>
          <div className="fields-grid">
            <NumberField node={node} propKey="vastMaxRedirects" label="Max redirects" value={Number(node.props.vastMaxRedirects ?? 5)} min={0} max={10} />
            <NumberField node={node} propKey="vastTimeoutMs" label="Timeout ms" value={Number(node.props.vastTimeoutMs ?? 8000)} min={1000} />
          </div>
          <div className="fields-grid">
            <div>
              <label>Skip offset override (seconds)</label>
              <input value={String(node.props.vastSkipOffsetOverride ?? '')} placeholder="Leave empty to use tag value" onChange={(event) => updateWidgetProps(node.id, { vastSkipOffsetOverride: event.target.value })} />
            </div>
            <div>
              <label>Companion zone ID</label>
              <input value={String(node.props.vastCompanionZoneId ?? '')} placeholder="sidebar" onChange={(event) => updateWidgetProps(node.id, { vastCompanionZoneId: event.target.value })} />
            </div>
          </div>
          <div className="fields-grid">
            <div>
              <label>Skip counting label</label>
              <input value={String(node.props.skipCountingLabel ?? 'Skip in {seconds}')} onChange={(event) => updateWidgetProps(node.id, { skipCountingLabel: event.target.value })} />
            </div>
            <div>
              <label>Skip label</label>
              <input value={String(node.props.skipLabel ?? 'Skip Ad ›')} onChange={(event) => updateWidgetProps(node.id, { skipLabel: event.target.value })} />
            </div>
          </div>
          <div>
            <label>Skip button position</label>
            <select value={String(node.props.skipPosition ?? 'bottom-right')} onChange={(event) => updateWidgetProps(node.id, { skipPosition: event.target.value })}>
              <option value="bottom-right">Bottom right</option>
              <option value="bottom-left">Bottom left</option>
              <option value="top-right">Top right</option>
              <option value="top-left">Top left</option>
            </select>
          </div>
          <label className="checkbox-row"><input type="checkbox" checked={Boolean(node.props.showCompanionSlot ?? true)} onChange={(event) => updateWidgetProps(node.id, { showCompanionSlot: event.target.checked })} /> Show companion slot in preview</label>
          <label className="checkbox-row"><input type="checkbox" checked={Boolean(node.props.showCompanionPlaceholder ?? true)} onChange={(event) => updateWidgetProps(node.id, { showCompanionPlaceholder: event.target.checked })} /> Show placeholder when no companion is returned</label>
          <label className="checkbox-row"><input type="checkbox" checked={Boolean(node.props.showVastDebug ?? true)} onChange={(event) => updateWidgetProps(node.id, { showVastDebug: event.target.checked })} /> Show VAST debug card in preview</label>
          <div className="fields-grid">
            <NumberField node={node} propKey="companionLeftPct" label="Companion left %" value={Number(node.props.companionLeftPct ?? 66)} min={0} max={100} />
            <NumberField node={node} propKey="companionTopPct" label="Companion top %" value={Number(node.props.companionTopPct ?? 8)} min={0} max={100} />
            <NumberField node={node} propKey="companionWidthPct" label="Companion width %" value={Number(node.props.companionWidthPct ?? 28)} min={1} max={100} />
            <NumberField node={node} propKey="companionHeightPct" label="Companion height %" value={Number(node.props.companionHeightPct ?? 20)} min={1} max={100} />
          </div>
          <div style={{ fontSize: '0.78rem', opacity: 0.7 }}>
            Use a real VAST tag URL, hit preview, and the stage will show VAST status, media resolution, errors, and any returned companion creative in-place.
          </div>
        </div>
      </section>

      <section className="section section-premium">
        <h3>Analytics</h3>
        <div className="field-stack">
          <label className="checkbox-row"><input type="checkbox" checked={Boolean(node.props.showAnalyticsDebug ?? true)} onChange={(event) => updateWidgetProps(node.id, { showAnalyticsDebug: event.target.checked })} /> Show analytics event log in preview</label>
          <NumberField node={node} propKey="analyticsEventLimit" label="Events kept in log" value={Number(node.props.analyticsEventLimit ?? 8)} min={1} max={30} />
          <div style={{ fontSize: '0.78rem', opacity: 0.7 }}>
            The preview log captures video, CTA, VAST, skip, companion, mute/unmute, seek, hover and error events emitted by this widget.
          </div>
        </div>
      </section>

      <section className="section section-premium">
        <h3>Overlay Stack</h3>
        <div className="field-stack">
          {configuredOverlays.length === 0 ? (
            <div style={{ fontSize: '0.78rem', opacity: 0.68 }}>
              No schema-driven overlays yet. Add one below. These overlays override the legacy quick fields when present.
            </div>
          ) : configuredOverlays.map((overlay) => (
            <div key={overlay.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ fontSize: '0.8rem' }}>
                {OVERLAY_SCHEMA_REGISTRY[overlay.kind]?.label ?? overlay.kind}
                <span style={{ opacity: 0.55, marginLeft: 6 }}>@ {overlay.triggerMs}ms</span>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button type="button" className="left-button compact-action" onClick={() => setEditingOverlayId(editingOverlayId === overlay.id ? null : overlay.id)}>
                  {editingOverlayId === overlay.id ? 'Close' : 'Edit'}
                </button>
                <button type="button" className="left-button compact-action" onClick={() => removeOverlay(overlay.id)}>
                  Remove
                </button>
              </div>
            </div>
          ))}

          {editingOverlayId ? (() => {
            const overlay = configuredOverlays.find((item) => item.id === editingOverlayId);
            return overlay ? <OverlayConfigForm overlay={overlay} onChange={updateOverlay} /> : null;
          })() : null}

          <div>
            <label>Add overlay</label>
            <select defaultValue="" onChange={(event) => {
              const value = event.target.value as OverlayKind;
              if (value) addOverlay(value);
              event.target.value = '';
            }}>
              <option value="" disabled>Choose overlay type…</option>
              {Object.values(OVERLAY_SCHEMA_REGISTRY).map((schema) => (
                <option key={schema.kind} value={schema.kind}>{schema.label}</option>
              ))}
            </select>
          </div>
        </div>
      </section>

      <section className="section section-premium">
        <h3>Countdown overlay</h3>
        <div className="field-stack">
          <label className="checkbox-row"><input type="checkbox" checked={Boolean(node.props.showCountdownOverlay ?? false)} onChange={(event) => updateWidgetProps(node.id, { showCountdownOverlay: event.target.checked })} /> Enable countdown</label>
          <div className="fields-grid">
            <NumberField node={node} propKey="countdownFromSeconds" label="From seconds" value={Number(node.props.countdownFromSeconds ?? 3)} min={1} max={30} />
            <NumberField node={node} propKey="countdownTriggerMs" label="Trigger ms" value={Number(node.props.countdownTriggerMs ?? 0)} min={0} />
            <NumberField node={node} propKey="countdownDurationMs" label="Visible ms" value={Number(node.props.countdownDurationMs ?? 3000)} min={100} />
          </div>
          <div className="fields-grid">
            <NumberField node={node} propKey="countdownLeftPct" label="Left %" value={Number(node.props.countdownLeftPct ?? 42)} min={0} max={100} />
            <NumberField node={node} propKey="countdownTopPct" label="Top %" value={Number(node.props.countdownTopPct ?? 12)} min={0} max={100} />
            <NumberField node={node} propKey="countdownWidthPct" label="Width %" value={Number(node.props.countdownWidthPct ?? 16)} min={1} max={100} />
          </div>
          <div>
            <label>Completed label</label>
            <input value={String(node.props.countdownCompletedLabel ?? 'Go')} onChange={(event) => updateWidgetProps(node.id, { countdownCompletedLabel: event.target.value })} />
          </div>
          <div className="fields-grid">
            <div><label>Text color</label><input value={String(node.props.countdownTextColor ?? '#ffffff')} onChange={(event) => updateWidgetProps(node.id, { countdownTextColor: event.target.value })} /></div>
            <div><label>Background</label><input value={String(node.props.countdownBg ?? 'rgba(0,0,0,0.35)')} onChange={(event) => updateWidgetProps(node.id, { countdownBg: event.target.value })} /></div>
          </div>
        </div>
      </section>

      <section className="section section-premium">
        <h3>CTA overlay</h3>
        <div className="field-stack">
          <label className="checkbox-row"><input type="checkbox" checked={Boolean(node.props.showCtaOverlay ?? false)} onChange={(event) => updateWidgetProps(node.id, { showCtaOverlay: event.target.checked })} /> Enable CTA</label>
          <div className="fields-grid">
            <div><label>Label</label><input value={String(node.props.ctaLabel ?? 'Learn more')} onChange={(event) => updateWidgetProps(node.id, { ctaLabel: event.target.value })} /></div>
            <div><label>URL</label><input value={String(node.props.ctaUrl ?? '')} placeholder="https://..." onChange={(event) => updateWidgetProps(node.id, { ctaUrl: event.target.value })} /></div>
          </div>
          <label className="checkbox-row"><input type="checkbox" checked={Boolean(node.props.ctaOpenInNewTab ?? true)} onChange={(event) => updateWidgetProps(node.id, { ctaOpenInNewTab: event.target.checked })} /> Open in new tab</label>
          <div className="fields-grid">
            <NumberField node={node} propKey="ctaTriggerMs" label="Trigger ms" value={Number(node.props.ctaTriggerMs ?? 1500)} min={0} />
            <NumberField node={node} propKey="ctaDurationMs" label="Visible ms" value={Number(node.props.ctaDurationMs ?? 4000)} min={100} />
            <NumberField node={node} propKey="ctaWidthPct" label="Width %" value={Number(node.props.ctaWidthPct ?? 34)} min={1} max={100} />
          </div>
          <div className="fields-grid">
            <NumberField node={node} propKey="ctaLeftPct" label="Left %" value={Number(node.props.ctaLeftPct ?? 33)} min={0} max={100} />
            <NumberField node={node} propKey="ctaTopPct" label="Top %" value={Number(node.props.ctaTopPct ?? 78)} min={0} max={100} />
            <NumberField node={node} propKey="ctaRadius" label="Radius" value={Number(node.props.ctaRadius ?? 999)} min={0} />
          </div>
          <div className="fields-grid">
            <div><label>Background</label><input value={String(node.props.ctaBg ?? '#ffffff')} onChange={(event) => updateWidgetProps(node.id, { ctaBg: event.target.value })} /></div>
            <div><label>Text color</label><input value={String(node.props.ctaTextColor ?? '#111111')} onChange={(event) => updateWidgetProps(node.id, { ctaTextColor: event.target.value })} /></div>
          </div>
        </div>
      </section>

      <section className="section section-premium">
        <h3>Logo overlay</h3>
        <div className="field-stack">
          <label className="checkbox-row"><input type="checkbox" checked={Boolean(node.props.showLogoOverlay ?? false)} onChange={(event) => updateWidgetProps(node.id, { showLogoOverlay: event.target.checked })} /> Enable logo</label>
          <AssetPicker node={node} assets={imageAssets} label="Logo" srcKey="logoPreviewSrc" assetIdKey="logoAssetId" placeholder="https://.../logo.png" />
          <div>
            <label>Alt text</label>
            <input value={String(node.props.logoAltText ?? '')} onChange={(event) => updateWidgetProps(node.id, { logoAltText: event.target.value })} />
          </div>
          <div className="fields-grid">
            <NumberField node={node} propKey="logoTriggerMs" label="Trigger ms" value={Number(node.props.logoTriggerMs ?? 0)} min={0} />
            <NumberField node={node} propKey="logoDurationMs" label="Visible ms" value={Number(node.props.logoDurationMs ?? 0)} min={0} />
            <NumberField node={node} propKey="logoOpacity" label="Opacity" value={Number(node.props.logoOpacity ?? 1)} min={0} max={1} step={0.1} />
          </div>
          <div className="fields-grid">
            <NumberField node={node} propKey="logoLeftPct" label="Left %" value={Number(node.props.logoLeftPct ?? 5)} min={0} max={100} />
            <NumberField node={node} propKey="logoTopPct" label="Top %" value={Number(node.props.logoTopPct ?? 5)} min={0} max={100} />
            <NumberField node={node} propKey="logoWidthPct" label="Width %" value={Number(node.props.logoWidthPct ?? 18)} min={1} max={100} />
          </div>
        </div>
      </section>

      <section className="section section-premium">
        <h3>Custom HTML overlay</h3>
        <div className="field-stack">
          <label className="checkbox-row"><input type="checkbox" checked={Boolean(node.props.showCustomHtmlOverlay ?? false)} onChange={(event) => updateWidgetProps(node.id, { showCustomHtmlOverlay: event.target.checked })} /> Enable custom HTML</label>
          <div>
            <label>HTML content</label>
            <textarea
              rows={6}
              value={String(node.props.customHtml ?? '<p>Custom content</p>')}
              onChange={(event) => updateWidgetProps(node.id, { customHtml: event.target.value })}
            />
          </div>
          <div className="fields-grid">
            <NumberField node={node} propKey="customHtmlTriggerMs" label="Trigger ms" value={Number(node.props.customHtmlTriggerMs ?? 0)} min={0} />
            <NumberField node={node} propKey="customHtmlDurationMs" label="Visible ms" value={Number(node.props.customHtmlDurationMs ?? 0)} min={0} />
          </div>
          <div className="fields-grid">
            <NumberField node={node} propKey="customHtmlLeftPct" label="Left %" value={Number(node.props.customHtmlLeftPct ?? 10)} min={0} max={100} />
            <NumberField node={node} propKey="customHtmlTopPct" label="Top %" value={Number(node.props.customHtmlTopPct ?? 10)} min={0} max={100} />
            <NumberField node={node} propKey="customHtmlWidthPct" label="Width %" value={Number(node.props.customHtmlWidthPct ?? 80)} min={1} max={100} />
            <NumberField node={node} propKey="customHtmlHeightPct" label="Height %" value={Number(node.props.customHtmlHeightPct ?? 40)} min={1} max={100} />
          </div>
        </div>
      </section>
    </>
  );
}
