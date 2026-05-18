import { useEffect, useState } from 'react';
import { resolveAssetDeliveryUrl } from '../../assets/policy';
import type { AssetRecord } from '../../assets/types';
import type { WidgetNode } from '../../domain/document/types';
import { useWidgetActions } from '../../hooks/use-studio-actions';
import { usePlatformSnapshot } from '../../platform/runtime';
import { useStudioStore } from '../../core/store/use-studio-store';
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
  const { updateWidgetProps } = useWidgetActions();
  const platform = usePlatformSnapshot();
  const [assets, setAssets] = useState<AssetRecord[]>([]);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const targetChannel = useStudioStore((state) => state.document.metadata.release.targetChannel);
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
          <div><label>Drop target id</label><input value={String(node.props.dropTargetId ?? '')} onChange={(event) => updateWidgetProps(node.id, { dropTargetId: event.target.value })} /></div>
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
