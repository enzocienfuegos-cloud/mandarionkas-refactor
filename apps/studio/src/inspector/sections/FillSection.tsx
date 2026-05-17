import { ColorControl } from '../../shared/ui/ColorControl';
import { useEffect, useMemo, useState } from 'react';
import { assetHasSourceUrl, resolveAssetDeliveryUrl } from '../../assets/policy';
import { listAssets } from '../../repositories/asset';
import { subscribeToAssetLibraryChanges } from '../../repositories/asset/events';
import type { AssetRecord } from '../../assets/types';
import type { WidgetNode } from '../../domain/document/types';
import { useWidgetActions } from '../../hooks/use-studio-actions';
import { useStudioStore } from '../../core/store/use-studio-store';
import { usePlatformSnapshot } from '../../platform/runtime';
import { AssetPickerButton } from '../../shared/ui/AssetPickerButton';
import { Button } from '../../shared/ui/Button';
import { getCapability } from '../../widgets/registry/widget-definition';
import { getWidgetDefinition } from '../../widgets/registry/widget-registry';
import { badgeStateFromInheritance, useWidgetInheritance, type InheritanceBadgeState } from '../use-widget-inheritance';
import { requestOpenAssetLibrary } from '../../shared/asset-library-events';

function hasAny(keys: Set<string>, targets: string[]): boolean {
  return targets.some((target) => keys.has(target));
}

export function FillSection({ widget }: { widget: WidgetNode }): JSX.Element {
  const widgetActions = useWidgetActions();
  const platform = usePlatformSnapshot();
  const targetChannel = useStudioStore((state) => state.document.metadata.release.targetChannel);
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
  const definition = useMemo(() => getWidgetDefinition(widget.type), [widget.type]);
  const acceptsVideoAsset = Boolean(getCapability(definition, 'acceptsVideoAsset'));
  const acceptsImageAsset = Boolean(getCapability(definition, 'acceptsImageAsset'));
  const supportsAssetSwap = acceptsVideoAsset || acceptsImageAsset;

  useEffect(() => {
    if (!platform.session.isAuthenticated || !platform.session.sessionId) {
      setAssets([]);
      return;
    }
    let cancelled = false;
    const syncAssets = () => {
      void listAssets()
        .then((records) => {
          if (!cancelled) setAssets(records);
        })
        .catch(() => {
          if (!cancelled) setAssets([]);
        });
    };
    syncAssets();
    const unsubscribe = subscribeToAssetLibraryChanges(syncAssets);
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [platform.session.isAuthenticated, platform.session.sessionId]);

  const eligibleAssets = useMemo(
    () => assets.filter((asset) => (acceptsVideoAsset ? asset.kind === 'video' : acceptsImageAsset ? asset.kind === 'image' : false)),
    [acceptsImageAsset, acceptsVideoAsset, assets],
  );
  const linkedAssetId = useMemo(() => {
    const explicitAssetId = String(widget.props.assetId ?? '').trim();
    if (explicitAssetId) return explicitAssetId;
    const currentSrc = String(widget.props.src ?? '').trim();
    return eligibleAssets.find((asset) => assetHasSourceUrl(asset, currentSrc, targetChannel))?.id ?? '';
  }, [eligibleAssets, targetChannel, widget.props.assetId, widget.props.src]);
  const resetTarget = isSharedLayerClone ? inheritedSharedBaseWidget : baseWidget;
  const hasFillSectionOverride = hasAny(localVariantStyleOverrideKeys, ['backgroundColor', 'fit'])
    || hasAny(localVariantPropsOverrideKeys, ['src', 'assetId', 'alt', 'posterSrc', 'posterAssetId'])
    || hasAny(localSceneStyleOverrideKeys, ['backgroundColor', 'fit'])
    || hasAny(localScenePropsOverrideKeys, ['src', 'assetId', 'alt', 'posterSrc', 'posterAssetId']);

  function renderInheritanceBadge(state: InheritanceBadgeState): JSX.Element | null {
    if (state === 'none') return null;
    if (state === 'local') return <span className="inspector-override-badge is-local">✱</span>;
    if (state === 'shared') return <span className="inspector-override-badge is-shared">S</span>;
    return <span className="inspector-override-badge is-master">M</span>;
  }

  function resetToMaster(): void {
    if (!resetTarget) return;
    widgetActions.updateWidgetStyle(widget.id, {
      backgroundColor: resetTarget.style.backgroundColor,
      fit: resetTarget.style.fit,
    });
    widgetActions.updateWidgetProps(widget.id, {
      src: resetTarget.props.src,
      assetId: resetTarget.props.assetId,
      alt: resetTarget.props.alt,
      posterSrc: resetTarget.props.posterSrc,
      posterAssetId: resetTarget.props.posterAssetId,
    });
  }

  return (
    <section className="section section-premium">
      <div className="section-heading-row">
        <div>
          <h3>Fill / colors</h3>
          {isSharedLayerClone ? (
            <small className="muted">
              Visual fill and linked assets inherit from the shared base layer unless this scene overrides them locally.
            </small>
          ) : isSharedLayerBase ? (
            <small className="muted">
              Fill and linked assets edited here propagate to every scene using this shared layer unless a scene has a local exception.
            </small>
          ) : !isMasterVariant ? (
            <small className="muted">
              Visual fill, linked assets, and fit behavior inherit from the master size unless this size overrides them locally.
            </small>
          ) : null}
        </div>
        {(isSharedLayerClone || !isMasterVariant) && hasFillSectionOverride ? (
          <Button variant="ghost" size="sm" className="subtle-action" onClick={resetToMaster}>
            {isSharedLayerClone ? 'Reset scene override' : 'Reset to master'}
          </Button>
        ) : null}
      </div>
      <div className="fields-grid">
        <ColorControl
          label="Background"
          labelAccessory={renderInheritanceBadge(badgeStateFromInheritance({
            sceneLocal: localSceneStyleOverrideKeys.has('backgroundColor'),
            variantLocal: localVariantStyleOverrideKeys.has('backgroundColor'),
            sharedClone: isSharedLayerClone,
            isMasterVariant,
          })) ?? undefined}
          value={String(widget.style.backgroundColor ?? '#1f2937')}
          fallback="#1f2937"
          onChange={(value) => widgetActions.updateWidgetStyle(widget.id, { backgroundColor: value })}
        />
      </div>
      {supportsAssetSwap ? (
        <div className="field-stack section-offset-top">
          <div>
            <label className="inspector-field-label">
              <span>{acceptsVideoAsset ? 'Video source' : 'Image source'}</span>
              {renderInheritanceBadge(badgeStateFromInheritance({
                sceneLocal: localScenePropsOverrideKeys.has('src'),
                variantLocal: localVariantPropsOverrideKeys.has('src'),
                sharedClone: isSharedLayerClone,
                isMasterVariant,
              }))}
            </label>
            <AssetPickerButton
              label={acceptsVideoAsset ? 'Video source' : 'Image source'}
              assetId={linkedAssetId || undefined}
              imageUrl={String(widget.props.src ?? '')}
              accept={acceptsVideoAsset ? 'video' : 'image'}
              assets={eligibleAssets}
              onChange={(asset) => {
                widgetActions.updateWidgetProps(widget.id, {
                  assetId: asset.id,
                  src: resolveAssetDeliveryUrl(asset, targetChannel, asset.qualityPreference ?? 'auto'),
                  assetQualityPreference: asset.qualityPreference ?? 'auto',
                  alt: asset.name,
                  ...(asset.kind === 'video'
                    ? { posterSrc: asset.derivatives?.poster?.src ?? asset.posterSrc ?? widget.props.posterSrc }
                    : {}),
                });
              }}
              onClear={() => widgetActions.updateWidgetProps(widget.id, { assetId: '', src: '' })}
            />
          </div>
          <div>
            <label className="inspector-field-label">
              <span>Asset library</span>
              {renderInheritanceBadge(badgeStateFromInheritance({
                sceneLocal: hasAny(localScenePropsOverrideKeys, ['assetId', 'alt']),
                variantLocal: hasAny(localVariantPropsOverrideKeys, ['assetId', 'alt']),
                sharedClone: isSharedLayerClone,
                isMasterVariant,
              }))}
            </label>
            <div className="asset-inline-actions">
              <select value={linkedAssetId} onChange={(event) => {
              const assetId = event.target.value;
              const asset = eligibleAssets.find((item) => item.id === assetId);
              widgetActions.updateWidgetProps(
                widget.id,
                asset
                  ? {
                      assetId: asset.id,
                      src: resolveAssetDeliveryUrl(asset, targetChannel, asset.qualityPreference ?? 'auto'),
                      assetQualityPreference: asset.qualityPreference ?? 'auto',
                      alt: asset.name,
                      posterSrc: asset.derivatives?.poster?.src ?? asset.posterSrc ?? widget.props.posterSrc,
                    }
                  : { assetId: '', src: '' },
              );
            }}>
              <option value="">No linked asset</option>
              {eligibleAssets.map((asset) => <option key={asset.id} value={asset.id}>{asset.name}</option>)}
            </select>
              <Button size="sm" className="left-button compact-action" onClick={requestOpenAssetLibrary}>Open library</Button>
            </div>
          </div>
          {acceptsVideoAsset ? <div>
            <label className="inspector-field-label">
              <span>Poster source</span>
              {renderInheritanceBadge(badgeStateFromInheritance({
                sceneLocal: hasAny(localScenePropsOverrideKeys, ['posterSrc', 'posterAssetId']),
                variantLocal: hasAny(localVariantPropsOverrideKeys, ['posterSrc', 'posterAssetId']),
                sharedClone: isSharedLayerClone,
                isMasterVariant,
              }))}
            </label>
            <AssetPickerButton
              label="Poster source"
              assetId={String(widget.props.posterAssetId ?? '') || undefined}
              imageUrl={String(widget.props.posterSrc ?? '')}
              accept="image"
              assets={assets.filter((asset) => asset.kind === 'image')}
              onChange={(asset) => widgetActions.updateWidgetProps(widget.id, { posterAssetId: asset.id, posterSrc: resolveAssetDeliveryUrl(asset, targetChannel, asset.qualityPreference ?? 'auto') })}
              onClear={() => widgetActions.updateWidgetProps(widget.id, { posterAssetId: '', posterSrc: '' })}
            />
          </div> : null}
          {acceptsImageAsset ? <div>
            <label className="inspector-field-label">
              <span>Fit</span>
              {renderInheritanceBadge(badgeStateFromInheritance({
                sceneLocal: localSceneStyleOverrideKeys.has('fit'),
                variantLocal: localVariantStyleOverrideKeys.has('fit'),
                sharedClone: isSharedLayerClone,
                isMasterVariant,
              }))}
            </label>
            <select value={String(widget.style.fit ?? 'cover')} onChange={(event) => widgetActions.updateWidgetStyle(widget.id, { fit: event.target.value })}>
              <option value="cover">cover</option>
              <option value="contain">contain</option>
            </select>
          </div> : null}
        </div>
      ) : null}
    </section>
  );
}
