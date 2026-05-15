import { useEffect, useMemo, useState } from 'react';
import { ColorControl } from '../../shared/ui/ColorControl';
import { useWidgetActions } from '../../hooks/use-studio-actions';
import type { WidgetNode } from '../../domain/document/types';
import { listAssets } from '../../repositories/asset';
import { subscribeToAssetLibraryChanges } from '../../repositories/asset/events';
import type { AssetRecord } from '../../assets/types';
import { resolveFontAssetFamily } from '../../assets/font-family';
import { usePlatformSnapshot } from '../../platform/runtime';
import { Button } from '../../shared/ui/Button';
import { badgeStateFromInheritance, useWidgetInheritance, type InheritanceBadgeState } from '../use-widget-inheritance';
import { requestOpenAssetLibrary } from '../../shared/asset-library-events';

function hasAny(keys: Set<string>, targets: string[]): boolean {
  return targets.some((target) => keys.has(target));
}

const TYPOGRAPHY_STYLE_KEYS = [
  'fontSize',
  'fontWeight',
  'fontStyle',
  'lineHeight',
  'letterSpacing',
  'textTransform',
  'textDecoration',
  'color',
  'horizontalAlign',
  'textAlign',
  'verticalAlign',
  'fontFamily',
] as const;

export function TextSection({ widget }: { widget: WidgetNode }): JSX.Element {
  const { updateWidgetProps, updateWidgetStyle } = useWidgetActions();
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
    || hasAny(localVariantStyleOverrideKeys, [...TYPOGRAPHY_STYLE_KEYS])
    || hasAny(localScenePropsOverrideKeys, ['text', 'fontAssetId', 'fontAssetSrc'])
    || hasAny(localSceneStyleOverrideKeys, [...TYPOGRAPHY_STYLE_KEYS]);

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
      fontWeight: resetTarget.style.fontWeight,
      fontStyle: resetTarget.style.fontStyle,
      lineHeight: resetTarget.style.lineHeight,
      letterSpacing: resetTarget.style.letterSpacing,
      textTransform: resetTarget.style.textTransform,
      textDecoration: resetTarget.style.textDecoration,
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
          <div>
            <label className="inspector-field-label">
              <span>Font weight</span>
              {renderInheritanceBadge(badgeStateFromInheritance({
                sceneLocal: localSceneStyleOverrideKeys.has('fontWeight'),
                variantLocal: localVariantStyleOverrideKeys.has('fontWeight'),
                sharedClone: isSharedLayerClone,
                isMasterVariant,
              }))}
            </label>
            <select value={String(widget.style.fontWeight ?? 700)} onChange={(event) => updateWidgetStyle(widget.id, { fontWeight: Number(event.target.value) })}>
              <option value="300">Light</option>
              <option value="400">Regular</option>
              <option value="500">Medium</option>
              <option value="600">Semibold</option>
              <option value="700">Bold</option>
              <option value="800">Extra bold</option>
              <option value="900">Black</option>
            </select>
          </div>
        </div>
        <div className="fields-grid">
          <div>
            <label className="inspector-field-label">
              <span>Line height</span>
              {renderInheritanceBadge(badgeStateFromInheritance({
                sceneLocal: localSceneStyleOverrideKeys.has('lineHeight'),
                variantLocal: localVariantStyleOverrideKeys.has('lineHeight'),
                sharedClone: isSharedLayerClone,
                isMasterVariant,
              }))}
            </label>
            <input type="number" step="0.05" min="0.8" value={Number(widget.style.lineHeight ?? 1.1)} onChange={(event) => updateWidgetStyle(widget.id, { lineHeight: Number(event.target.value) })} />
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
              <span>Font style</span>
              {renderInheritanceBadge(badgeStateFromInheritance({
                sceneLocal: localSceneStyleOverrideKeys.has('fontStyle'),
                variantLocal: localVariantStyleOverrideKeys.has('fontStyle'),
                sharedClone: isSharedLayerClone,
                isMasterVariant,
              }))}
            </label>
            <select value={String(widget.style.fontStyle ?? 'normal')} onChange={(event) => updateWidgetStyle(widget.id, { fontStyle: event.target.value })}>
              <option value="normal">Regular</option>
              <option value="italic">Italic</option>
            </select>
          </div>
          <div>
            <label className="inspector-field-label">
              <span>Letter spacing</span>
              {renderInheritanceBadge(badgeStateFromInheritance({
                sceneLocal: localSceneStyleOverrideKeys.has('letterSpacing'),
                variantLocal: localVariantStyleOverrideKeys.has('letterSpacing'),
                sharedClone: isSharedLayerClone,
                isMasterVariant,
              }))}
            </label>
            <input value={String(widget.style.letterSpacing ?? 'normal')} onChange={(event) => updateWidgetStyle(widget.id, { letterSpacing: event.target.value })} placeholder="normal, 0.04em, 1px" />
          </div>
        </div>
        <div className="fields-grid">
          <div>
            <label className="inspector-field-label">
              <span>Text transform</span>
              {renderInheritanceBadge(badgeStateFromInheritance({
                sceneLocal: localSceneStyleOverrideKeys.has('textTransform'),
                variantLocal: localVariantStyleOverrideKeys.has('textTransform'),
                sharedClone: isSharedLayerClone,
                isMasterVariant,
              }))}
            </label>
            <select value={String(widget.style.textTransform ?? 'none')} onChange={(event) => updateWidgetStyle(widget.id, { textTransform: event.target.value })}>
              <option value="none">None</option>
              <option value="uppercase">Uppercase</option>
              <option value="lowercase">Lowercase</option>
              <option value="capitalize">Capitalize</option>
            </select>
          </div>
          <div>
            <label className="inspector-field-label">
              <span>Decoration</span>
              {renderInheritanceBadge(badgeStateFromInheritance({
                sceneLocal: localSceneStyleOverrideKeys.has('textDecoration'),
                variantLocal: localVariantStyleOverrideKeys.has('textDecoration'),
                sharedClone: isSharedLayerClone,
                isMasterVariant,
              }))}
            </label>
            <select value={String(widget.style.textDecoration ?? 'none')} onChange={(event) => updateWidgetStyle(widget.id, { textDecoration: event.target.value })}>
              <option value="none">None</option>
              <option value="underline">Underline</option>
              <option value="line-through">Strikethrough</option>
            </select>
          </div>
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
              updateWidgetProps(widget.id, { fontAssetId: asset.id, fontAssetSrc: asset.publicUrl ?? asset.src });
              updateWidgetStyle(widget.id, { fontFamily: resolveFontAssetFamily(asset) });
            }}>
              <option value="">No linked font</option>
              {fontAssets.map((asset) => <option key={asset.id} value={asset.id}>{asset.name}</option>)}
            </select>
            <Button size="sm" className="left-button compact-action" onClick={requestOpenAssetLibrary}>Install font</Button>
          </div>
          <small className="muted">
            Upload/install the font in the asset library first, then select it here from the dropdown.
          </small>
        </div>
      </div>
    </section>
  );
}
