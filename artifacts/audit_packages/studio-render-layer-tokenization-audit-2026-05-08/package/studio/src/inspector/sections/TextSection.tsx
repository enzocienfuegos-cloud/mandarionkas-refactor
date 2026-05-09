import { useEffect, useMemo, useState } from 'react';
import { ColorControl } from '../../shared/ui/ColorControl';
import { useUiActions, useWidgetActions } from '../../hooks/use-studio-actions';
import type { WidgetNode } from '../../domain/document/types';
import { listAssets } from '../../repositories/asset';
import { subscribeToAssetLibraryChanges } from '../../repositories/asset/events';
import type { AssetRecord } from '../../assets/types';
import { resolveFontAssetFamily } from '../../assets/FontAssetRuntime';
import { usePlatformSnapshot } from '../../platform/runtime';
import { Button } from '../../shared/ui/Button';
import { badgeStateFromInheritance, useWidgetInheritance, type InheritanceBadgeState } from '../use-widget-inheritance';

function hasAny(keys: Set<string>, targets: string[]): boolean {
  return targets.some((target) => keys.has(target));
}

export function TextSection({ widget }: { widget: WidgetNode }): JSX.Element {
  const { updateWidgetProps, updateWidgetStyle } = useWidgetActions();
  const uiActions = useUiActions();
  const platform = usePlatformSnapshot();
  const {
    baseWidget,
    inheritedSharedBaseWidget,
    isMasterVariant,
    isSharedLayerBase,
    isSharedLayerClone,
    localVariantStyleOverrideKeys,
    localVariantPropsOverrideKeys,
    localSceneStyleOverrideKeys,
    localScenePropsOverrideKeys,
  } = useWidgetInheritance(widget);
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
  const resetTarget = isSharedLayerClone ? inheritedSharedBaseWidget : baseWidget;
  const hasTextSectionOverride = hasAny(localVariantPropsOverrideKeys, ['text', 'fontAssetId', 'fontAssetSrc'])
    || hasAny(localVariantStyleOverrideKeys, ['fontSize', 'color', 'horizontalAlign', 'textAlign', 'verticalAlign', 'fontFamily'])
    || hasAny(localScenePropsOverrideKeys, ['text', 'fontAssetId', 'fontAssetSrc'])
    || hasAny(localSceneStyleOverrideKeys, ['fontSize', 'color', 'horizontalAlign', 'textAlign', 'verticalAlign', 'fontFamily']);

  function renderInheritanceBadge(state: InheritanceBadgeState): JSX.Element | null {
    if (state === 'none') return null;
    if (state === 'local') return <span className="inspector-override-badge is-local">✱</span>;
    if (state === 'shared') return <span className="inspector-override-badge is-shared">S</span>;
    return <span className="inspector-override-badge is-master">M</span>;
  }

  function resetToMaster(): void {
    if (!resetTarget) return;
    updateWidgetProps(widget.id, {
      text: resetTarget.props.text,
      fontAssetId: resetTarget.props.fontAssetId,
      fontAssetSrc: resetTarget.props.fontAssetSrc,
    });
    updateWidgetStyle(widget.id, {
      fontSize: resetTarget.style.fontSize,
      color: resetTarget.style.color,
      horizontalAlign: resetTarget.style.horizontalAlign,
      textAlign: resetTarget.style.textAlign,
      verticalAlign: resetTarget.style.verticalAlign,
      fontFamily: resetTarget.style.fontFamily,
    });
  }

  return (
    <section className="section section-premium">
      <div className="section-heading-row">
        <div>
          <h3>Text</h3>
          {isSharedLayerClone ? (
            <small className="muted">
              Text inherits from the shared base layer unless this scene overrides it locally.
            </small>
          ) : isSharedLayerBase ? (
            <small className="muted">
              Text changes here propagate to every scene using this shared layer unless a scene has a local exception.
            </small>
          ) : !isMasterVariant ? (
            <small className="muted">
              Text content and typography inherit from the master size unless this size overrides them locally.
            </small>
          ) : null}
        </div>
        {(isSharedLayerClone || !isMasterVariant) && hasTextSectionOverride ? (
          <Button variant="ghost" size="sm" className="subtle-action" onClick={resetToMaster}>
            {isSharedLayerClone ? 'Reset scene override' : 'Reset to master'}
          </Button>
        ) : null}
      </div>
      <div className="field-stack">
        <div>
          <label className="inspector-field-label">
            <span>Text value</span>
            {renderInheritanceBadge(badgeStateFromInheritance({
              sceneLocal: localScenePropsOverrideKeys.has('text'),
              variantLocal: localVariantPropsOverrideKeys.has('text'),
              sharedClone: isSharedLayerClone,
              isMasterVariant,
            }))}
          </label>
          <textarea rows={4} value={String(widget.props.text ?? '')} onChange={(event) => updateWidgetProps(widget.id, { text: event.target.value })} />
        </div>
        <div className="fields-grid">
          <div>
            <label className="inspector-field-label">
              <span>Font size</span>
              {renderInheritanceBadge(badgeStateFromInheritance({
                sceneLocal: localSceneStyleOverrideKeys.has('fontSize'),
                variantLocal: localVariantStyleOverrideKeys.has('fontSize'),
                sharedClone: isSharedLayerClone,
                isMasterVariant,
              }))}
            </label>
            <input type="number" value={Number(widget.style.fontSize ?? 16)} onChange={(event) => updateWidgetStyle(widget.id, { fontSize: Number(event.target.value) })} />
          </div>
          <ColorControl
            label="Text color"
            labelAccessory={renderInheritanceBadge(badgeStateFromInheritance({
              sceneLocal: localSceneStyleOverrideKeys.has('color'),
              variantLocal: localVariantStyleOverrideKeys.has('color'),
              sharedClone: isSharedLayerClone,
              isMasterVariant,
            })) ?? undefined}
            value={String(widget.style.color ?? '#ffffff')}
            fallback="#ffffff"
            onChange={(value) => updateWidgetStyle(widget.id, { color: value })}
          />
        </div>
        <div className="fields-grid">
          <div>
            <label className="inspector-field-label">
              <span>Horizontal align</span>
              {renderInheritanceBadge(badgeStateFromInheritance({
                sceneLocal: hasAny(localSceneStyleOverrideKeys, ['horizontalAlign', 'textAlign']),
                variantLocal: hasAny(localVariantStyleOverrideKeys, ['horizontalAlign', 'textAlign']),
                sharedClone: isSharedLayerClone,
                isMasterVariant,
              }))}
            </label>
            <select value={String(widget.style.horizontalAlign ?? widget.style.textAlign ?? 'center')} onChange={(event) => updateWidgetStyle(widget.id, { horizontalAlign: event.target.value, textAlign: event.target.value })}>
              <option value="left">Left</option>
              <option value="center">Center</option>
              <option value="right">Right</option>
            </select>
          </div>
          <div>
            <label className="inspector-field-label">
              <span>Vertical align</span>
              {renderInheritanceBadge(badgeStateFromInheritance({
                sceneLocal: localSceneStyleOverrideKeys.has('verticalAlign'),
                variantLocal: localVariantStyleOverrideKeys.has('verticalAlign'),
                sharedClone: isSharedLayerClone,
                isMasterVariant,
              }))}
            </label>
            <select value={String(widget.style.verticalAlign ?? 'center')} onChange={(event) => updateWidgetStyle(widget.id, { verticalAlign: event.target.value })}>
              <option value="top">Top</option>
              <option value="center">Center</option>
              <option value="bottom">Bottom</option>
            </select>
          </div>
        </div>
        <div>
          <label className="inspector-field-label">
            <span>Font family</span>
            {renderInheritanceBadge(badgeStateFromInheritance({
              sceneLocal: localSceneStyleOverrideKeys.has('fontFamily'),
              variantLocal: localVariantStyleOverrideKeys.has('fontFamily'),
              sharedClone: isSharedLayerClone,
              isMasterVariant,
            }))}
          </label>
          <input value={String(widget.style.fontFamily ?? '')} onChange={(event) => updateWidgetStyle(widget.id, { fontFamily: event.target.value })} placeholder="System or custom font family" />
        </div>
        <div>
          <label className="inspector-field-label">
            <span>Font asset</span>
            {renderInheritanceBadge(badgeStateFromInheritance({
              sceneLocal: hasAny(localScenePropsOverrideKeys, ['fontAssetId', 'fontAssetSrc']),
              variantLocal: hasAny(localVariantPropsOverrideKeys, ['fontAssetId', 'fontAssetSrc']),
              sharedClone: isSharedLayerClone,
              isMasterVariant,
            }))}
          </label>
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
            <Button size="sm" className="left-button compact-action" onClick={() => uiActions.setLeftTab('assets')}>Browse fonts</Button>
          </div>
        </div>
      </div>
    </section>
  );
}
