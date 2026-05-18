import { useEffect, useMemo, useState } from 'react';
import { studioStore } from '../../core/store/studio-store';
import { resolveAssetDeliveryUrl } from '../../assets/policy';
import type { AssetRecord } from '../../assets/types';
import { useWidgetActions } from '../../hooks/use-studio-actions';
import { usePlatformSnapshot } from '../../platform/runtime';
import { useStudioStore } from '../../core/store/use-studio-store';
import type { SceneNode, WidgetNode } from '../../domain/document/types';
import { listAssets } from '../../repositories/asset';
import { subscribeToAssetLibraryChanges } from '../../repositories/asset/events';
import { AssetPickerButton } from '../../shared/ui/AssetPickerButton';
import { Button } from '../../shared/ui/Button';
import {
  clampTokenImageFocal,
  clampTokenImageMaxSizePercent,
  clampTokenImageScalePercent,
  DEFAULT_TOKEN_IMAGE_FOCAL_X,
  DEFAULT_TOKEN_IMAGE_FOCAL_Y,
  DEFAULT_TOKEN_IMAGE_MAX_SIZE_PERCENT,
  DEFAULT_TOKEN_IMAGE_FIT,
  DEFAULT_TOKEN_IMAGE_SCALE_PERCENT,
  DEFAULT_TOKEN_SHAPE,
  generateTokenId,
  MAX_TOKENS,
  MIN_TOKENS,
  normalizeTokenImageFit,
  TOKEN_IMAGE_FIT_OPTIONS,
  TOKEN_IMAGE_FOCAL_MAX,
  TOKEN_IMAGE_FOCAL_MIN,
  TOKEN_IMAGE_MAX_SIZE_PERCENT_MAX,
  TOKEN_IMAGE_MAX_SIZE_PERCENT_MIN,
  TOKEN_IMAGE_SCALE_PERCENT_MAX,
  TOKEN_IMAGE_SCALE_PERCENT_MIN,
  TOKEN_SIZE_MAX,
  TOKEN_SIZE_MIN,
  type DragTokenItem,
  type TokenShape,
} from './drag-token-pool.types';

export function DragTokenPoolInspector({ node }: { node: WidgetNode }): JSX.Element {
  const { createWidget, updateWidgetFrame, updateWidgetProps, selectWidget } = useWidgetActions();
  const platform = usePlatformSnapshot();
  const [assets, setAssets] = useState<AssetRecord[]>([]);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const targetChannel = useStudioStore((state) => state.document.metadata.release.targetChannel);
  const scenes = useStudioStore((state) => state.document.scenes);
  const sceneWidgets = useStudioStore((state) => Object.values(state.document.widgets).filter((widget) => widget.sceneId === node.sceneId));
  const tokens: DragTokenItem[] = Array.isArray(node.props.tokens) ? node.props.tokens as DragTokenItem[] : [];
  const disabledIds = Array.isArray(node.props.disabledIds) ? node.props.disabledIds.map((value) => String(value)) : [];
  const tokenSize = Math.max(TOKEN_SIZE_MIN, Math.min(TOKEN_SIZE_MAX, Number(node.props.tokenSize ?? 72)));
  const gap = Math.max(4, Math.min(60, Number(node.props.gap ?? 16)));
  const tokenShape: TokenShape = node.props.tokenShape === 'circle' || node.props.tokenShape === 'square' || node.props.tokenShape === 'rounded'
    ? node.props.tokenShape
    : DEFAULT_TOKEN_SHAPE;
  const hideAccentForImageTokens = node.props.hideAccentForImageTokens === true;
  const hideShapeForImageTokens = node.props.hideShapeForImageTokens === true;
  const tokenImageMaxSizePercent = clampTokenImageMaxSizePercent(node.props.tokenImageMaxSizePercent ?? DEFAULT_TOKEN_IMAGE_MAX_SIZE_PERCENT);

  useEffect(() => {
    if (!platform.session.isAuthenticated || !platform.session.sessionId) {
      setAssets([]);
      return;
    }
    let cancelled = false;
    const syncAssets = () => {
      void listAssets()
        .then((records) => {
          if (!cancelled) setAssets(records.filter((asset) => asset.kind === 'image'));
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

  const updateTokens = (nextTokens: DragTokenItem[]) => {
    updateWidgetProps(node.id, { tokens: nextTokens });
  };

  const updateDisabledIds = (nextDisabledIds: string[]) => {
    updateWidgetProps(node.id, { disabledIds: nextDisabledIds });
  };

  const addToken = () => {
    if (tokens.length >= MAX_TOKENS) return;
    updateTokens([...tokens, { id: generateTokenId(), label: `Token ${tokens.length + 1}` }]);
  };

  const removeToken = (tokenId: string) => {
    if (tokens.length <= MIN_TOKENS) return;
    updateTokens(tokens.filter((token) => token.id !== tokenId));
    updateDisabledIds(disabledIds.filter((id) => id !== tokenId));
  };

  const updateToken = (tokenId: string, patch: Partial<DragTokenItem>) => {
    updateTokens(tokens.map((token) => token.id === tokenId ? { ...token, ...patch } : token));
  };

  const reorderTokens = (fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex) return;
    const nextTokens = [...tokens];
    const [moved] = nextTokens.splice(fromIndex, 1);
    if (!moved) return;
    nextTokens.splice(toIndex, 0, moved);
    updateTokens(nextTokens);
  };

  const setTokenDisabled = (tokenId: string, disabled: boolean) => {
    if (disabled) {
      if (disabledIds.includes(tokenId)) return;
      updateDisabledIds([...disabledIds, tokenId]);
      return;
    }
    updateDisabledIds(disabledIds.filter((id) => id !== tokenId));
  };

  const availableScenes: SceneNode[] = scenes.filter((scene) => scene.id !== node.sceneId);
  const availableDropZones = sceneWidgets.filter((widget): widget is WidgetNode => widget.type === 'drop-zone' && widget.id !== node.id);
  const anchorCandidates = sceneWidgets.filter((widget) => widget.id !== node.id && widget.type !== 'drop-zone');
  const selectedDropZoneId = String(node.props.dropTargetId ?? '').trim();
  const activeDropZone = availableDropZones.find((widget) => widget.id === selectedDropZoneId) ?? availableDropZones[0];
  const effectiveDropTargetId = activeDropZone?.id ?? '';
  const [anchorWidgetId, setAnchorWidgetId] = useState('');
  const activeAnchorWidget = useMemo(
    () => anchorCandidates.find((widget) => widget.id === anchorWidgetId) ?? anchorCandidates[0],
    [anchorCandidates, anchorWidgetId],
  );

  useEffect(() => {
    if (activeAnchorWidget?.id && activeAnchorWidget.id !== anchorWidgetId) {
      setAnchorWidgetId(activeAnchorWidget.id);
      return;
    }
    if (!activeAnchorWidget && anchorWidgetId) {
      setAnchorWidgetId('');
    }
  }, [activeAnchorWidget, anchorWidgetId]);

  const alignDropZoneToWidget = (dropZoneId: string, targetWidget: WidgetNode) => {
    updateWidgetFrame(dropZoneId, {
      x: targetWidget.frame.x,
      y: targetWidget.frame.y,
      width: targetWidget.frame.width,
      height: targetWidget.frame.height,
    });
  };

  const createLinkedDropZone = () => {
    const targetWidget = activeAnchorWidget;
    const nextFrame = targetWidget
      ? {
          x: targetWidget.frame.x,
          y: targetWidget.frame.y,
          width: targetWidget.frame.width,
          height: targetWidget.frame.height,
        }
      : {
          x: Math.round(node.frame.x + Math.max(0, (node.frame.width - 180) / 2)),
          y: Math.round(node.frame.y + node.frame.height + 48),
          width: 180,
          height: 180,
        };

    if (activeDropZone) {
      alignDropZoneToWidget(activeDropZone.id, targetWidget ?? { ...node, frame: nextFrame });
      updateWidgetProps(node.id, { dropTargetId: activeDropZone.id });
      selectWidget(node.id);
      return;
    }

    createWidget(
      'drop-zone',
      {
        x: nextFrame.x,
        y: nextFrame.y,
        anchor: 'top-left',
      },
      {
        props: {
          width: nextFrame.width,
          height: nextFrame.height,
          hitPadding: 16,
          debugOutline: true,
        },
      },
    );
    const createdDropZoneId = studioStore.getState().document.selection.primaryWidgetId;
    if (!createdDropZoneId) return;
    updateWidgetFrame(createdDropZoneId, nextFrame);
    updateWidgetProps(node.id, { dropTargetId: createdDropZoneId });
    selectWidget(node.id);
  };

  return (
    <section className="section section-premium">
      <h3>Drag token pool</h3>
      <div className="field-stack">
        <div className="fields-grid">
          <div><label>Token size</label><input type="number" min={TOKEN_SIZE_MIN} max={TOKEN_SIZE_MAX} value={tokenSize} onChange={(event) => updateWidgetProps(node.id, { tokenSize: Number(event.target.value) })} /></div>
          <div><label>Gap</label><input type="number" min={4} max={60} value={gap} onChange={(event) => updateWidgetProps(node.id, { gap: Number(event.target.value) })} /></div>
          <div>
            <label>Shape</label>
            <select value={tokenShape} onChange={(event) => updateWidgetProps(node.id, { tokenShape: event.target.value })}>
              <option value="circle">Circle</option>
              <option value="rounded">Rounded</option>
              <option value="square">Square</option>
            </select>
          </div>
          <div>
            <label>Drop zone</label>
            <select
              value={effectiveDropTargetId}
              onChange={(event) => updateWidgetProps(node.id, { dropTargetId: event.target.value || undefined })}
            >
              <option value="">No linked drop zone</option>
              {availableDropZones.map((widget) => (
                <option key={widget.id} value={widget.id}>
                  {widget.name || `Drop zone ${widget.id.slice(0, 6)}`}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label>Image max size (%)</label>
            <input
              aria-label="Image max size (%)"
              type="number"
              min={TOKEN_IMAGE_MAX_SIZE_PERCENT_MIN}
              max={TOKEN_IMAGE_MAX_SIZE_PERCENT_MAX}
              value={tokenImageMaxSizePercent}
              onChange={(event) => updateWidgetProps(node.id, {
                tokenImageMaxSizePercent: clampTokenImageMaxSizePercent(event.target.value),
              })}
            />
          </div>
        </div>
        {activeDropZone ? (
          <>
            <div className="meta-line inspector-spread-row">
              <strong>Drag area</strong>
              <Button variant="ghost" size="sm" onClick={() => selectWidget(activeDropZone.id)}>
                Select area
              </Button>
            </div>
            <div className="fields-grid">
              <div>
                <label>Attach to widget</label>
                <select
                  value={activeAnchorWidget?.id ?? ''}
                  onChange={(event) => setAnchorWidgetId(event.target.value)}
                >
                  <option value="">Manual area</option>
                  {anchorCandidates.map((widget) => (
                    <option key={widget.id} value={widget.id}>
                      {widget.name || `${widget.type} ${widget.id.slice(0, 6)}`}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label>X</label>
                <input
                  type="number"
                  step={1}
                  value={Number(activeDropZone.frame.x ?? 0)}
                  onChange={(event) => updateWidgetFrame(activeDropZone.id, { x: Number(event.target.value) })}
                />
              </div>
              <div>
                <label>Y</label>
                <input
                  type="number"
                  step={1}
                  value={Number(activeDropZone.frame.y ?? 0)}
                  onChange={(event) => updateWidgetFrame(activeDropZone.id, { y: Number(event.target.value) })}
                />
              </div>
              <div>
                <label>Width</label>
                <input
                  type="number"
                  min={20}
                  max={400}
                  step={4}
                  value={Number(activeDropZone.frame.width ?? activeDropZone.props.width ?? 120)}
                  onChange={(event) => updateWidgetFrame(activeDropZone.id, { width: Number(event.target.value) })}
                />
              </div>
              <div>
                <label>Height</label>
                <input
                  type="number"
                  min={20}
                  max={400}
                  step={4}
                  value={Number(activeDropZone.frame.height ?? activeDropZone.props.height ?? 120)}
                  onChange={(event) => updateWidgetFrame(activeDropZone.id, { height: Number(event.target.value) })}
                />
              </div>
              <div>
                <label>Hit padding</label>
                <input
                  type="number"
                  min={0}
                  max={60}
                  step={2}
                  value={Number(activeDropZone.props.hitPadding ?? 16)}
                  onChange={(event) => updateWidgetProps(activeDropZone.id, { hitPadding: Number(event.target.value) })}
                />
              </div>
            </div>
            {activeAnchorWidget ? (
              <Button variant="secondary" size="sm" onClick={createLinkedDropZone}>
                Fit area to widget
              </Button>
            ) : null}
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={Boolean(activeDropZone.props.debugOutline ?? true)}
                onChange={(event) => updateWidgetProps(activeDropZone.id, { debugOutline: event.target.checked })}
              />
              Show drag area outline
            </label>
          </>
        ) : (
          <div className="field-stack inspector-item-card">
            <div className="meta-line inspector-spread-row">
              <strong>Drag area</strong>
              <Button variant="primary" size="sm" onClick={createLinkedDropZone}>
                {activeAnchorWidget ? 'Create area over widget' : 'Create area'}
              </Button>
            </div>
            {anchorCandidates.length ? (
              <div>
                <label>Target widget</label>
                <select
                  value={activeAnchorWidget?.id ?? ''}
                  onChange={(event) => setAnchorWidgetId(event.target.value)}
                >
                  <option value="">Free area</option>
                  {anchorCandidates.map((widget) => (
                    <option key={widget.id} value={widget.id}>
                      {widget.name || `${widget.type} ${widget.id.slice(0, 6)}`}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
            <div className="meta-line">
              No linked drag area yet. Pick a widget to place an invisible drop layer over it, or create a free manual area.
            </div>
          </div>
        )}
        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={hideAccentForImageTokens}
            onChange={(event) => updateWidgetProps(node.id, { hideAccentForImageTokens: event.target.checked })}
          />
          Hide accent color when token image exists
        </label>
        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={hideShapeForImageTokens}
            onChange={(event) => updateWidgetProps(node.id, { hideShapeForImageTokens: event.target.checked })}
          />
          Hide shape when token image exists
        </label>
        <strong>{`Tokens (${tokens.length}/${MAX_TOKENS})`}</strong>
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 10 }}>
          {tokens.map((token, index) => (
            <li
              key={token.id}
              draggable
              onDragStart={() => setDraggedIndex(index)}
              onDragEnd={() => setDraggedIndex(null)}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                if (draggedIndex === null) return;
                reorderTokens(draggedIndex, index);
                setDraggedIndex(null);
              }}
              className="inspector-item-card"
            >
              <div className="meta-line inspector-spread-row">
                <strong>{`Token ${index + 1}`}</strong>
                <Button variant="danger" size="sm" disabled={tokens.length <= MIN_TOKENS} onClick={() => removeToken(token.id)}>×</Button>
              </div>
              <div className="fields-grid">
                <div>
                  <label>Label</label>
                  <input value={token.label} onChange={(event) => updateToken(token.id, { label: event.target.value })} placeholder="Label" />
                </div>
                <div>
                  <label>Accent color</label>
                  <input type="color" value={token.accentColor ?? '#ffffff'} onChange={(event) => updateToken(token.id, { accentColor: event.target.value })} />
                </div>
              </div>
              <div>
                <label>Target scene</label>
                <select
                  value={token.targetSceneId ?? ''}
                  onChange={(event) => updateToken(token.id, { targetSceneId: event.target.value || undefined })}
                >
                  <option value="">No target scene</option>
                  {availableScenes.map((scene) => (
                    <option key={scene.id} value={scene.id}>{scene.name}</option>
                  ))}
                </select>
              </div>
              <label className="checkbox-row">
                <input type="checkbox" checked={disabledIds.includes(token.id)} onChange={(event) => setTokenDisabled(token.id, event.target.checked)} />
                Disabled
              </label>
              <AssetPickerButton
                label="Base image"
                assetId={token.baseAssetId}
                imageUrl={token.baseImageUrl}
                assets={assets}
                accept="image"
                emptyLabel="No base image selected."
                onChange={(asset) => updateToken(token.id, {
                  baseAssetId: asset.id,
                  baseImageUrl: resolveAssetDeliveryUrl(asset, targetChannel, asset.qualityPreference ?? 'auto'),
                })}
                onClear={() => updateToken(token.id, { baseAssetId: undefined, baseImageUrl: undefined })}
              />
              <div>
                <label>Base image fit</label>
                <select
                  value={normalizeTokenImageFit(token.baseImageFit ?? DEFAULT_TOKEN_IMAGE_FIT)}
                  onChange={(event) => updateToken(token.id, { baseImageFit: normalizeTokenImageFit(event.target.value) })}
                >
                  {TOKEN_IMAGE_FIT_OPTIONS.map((fit) => (
                    <option key={fit} value={fit}>{fit}</option>
                  ))}
                </select>
              </div>
              <div className="fields-grid">
                <div>
                  <label>Base image scale (%)</label>
                  <input
                    type="number"
                    min={TOKEN_IMAGE_SCALE_PERCENT_MIN}
                    max={TOKEN_IMAGE_SCALE_PERCENT_MAX}
                    value={clampTokenImageScalePercent(token.baseImageScalePercent ?? DEFAULT_TOKEN_IMAGE_SCALE_PERCENT)}
                    onChange={(event) => updateToken(token.id, {
                      baseImageScalePercent: clampTokenImageScalePercent(event.target.value),
                    })}
                  />
                </div>
                <div>
                  <label>Base image focal X</label>
                  <input
                    type="number"
                    min={TOKEN_IMAGE_FOCAL_MIN}
                    max={TOKEN_IMAGE_FOCAL_MAX}
                    value={clampTokenImageFocal(token.baseImageFocalX, DEFAULT_TOKEN_IMAGE_FOCAL_X)}
                    onChange={(event) => updateToken(token.id, {
                      baseImageFocalX: clampTokenImageFocal(event.target.value, DEFAULT_TOKEN_IMAGE_FOCAL_X),
                    })}
                  />
                </div>
                <div>
                  <label>Base image focal Y</label>
                  <input
                    type="number"
                    min={TOKEN_IMAGE_FOCAL_MIN}
                    max={TOKEN_IMAGE_FOCAL_MAX}
                    value={clampTokenImageFocal(token.baseImageFocalY, DEFAULT_TOKEN_IMAGE_FOCAL_Y)}
                    onChange={(event) => updateToken(token.id, {
                      baseImageFocalY: clampTokenImageFocal(event.target.value, DEFAULT_TOKEN_IMAGE_FOCAL_Y),
                    })}
                  />
                </div>
              </div>
            </li>
          ))}
        </ul>
        <Button onClick={addToken} disabled={tokens.length >= MAX_TOKENS}>Add token</Button>
      </div>
    </section>
  );
}
