// render-tokenized: brand/theme split enforced by lint-color-literals.mjs
import React, { useMemo, type CSSProperties } from 'react';
import type { WidgetNode } from '../../domain/document/types';
import type { RenderContext } from '../../canvas/stage/render-context';
import { renderCollapsedIfNeeded } from './shared-styles';
import { useDragSource } from '../../core/drag-runtime';
import {
  clampTokenImageFocal,
  clampTokenImageMaxSizePercent,
  clampTokenImageScalePercent,
  DEFAULT_TOKEN_IMAGE_FOCAL_X,
  DEFAULT_TOKEN_IMAGE_FOCAL_Y,
  normalizeTokenImageFit,
  parseDragTokenItems,
  tokenShapeToBorderRadius,
  type DragTokenItem,
  type TokenImageFit,
  type TokenShape,
} from './drag-token-pool.types';

const dragTokenPoolShellStyle: CSSProperties = {
  width: '100%',
  height: '100%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

const dragTokenPoolTrackBaseStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  flexWrap: 'wrap',
  justifyContent: 'center',
};

const dragTokenBaseStyle: CSSProperties = {
  overflow: 'hidden',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'transparent',
  color: 'var(--surface-card-light)',
  fontSize: 11,
  fontWeight: 700,
  textAlign: 'center',
  userSelect: 'none',
  WebkitUserSelect: 'none',
  touchAction: 'none',
  pointerEvents: 'auto',
  position: 'relative',
};

function buildDragTokenStyle(
  tokenSize: number,
  accentColor: string | undefined,
  isDisabled: boolean,
  radius: string,
  hideFrame: boolean,
  isDragging: boolean,
  hasImage: boolean,
): CSSProperties {
  return {
    ...dragTokenBaseStyle,
    borderRadius: radius,
    width: tokenSize,
    height: tokenSize,
    // No padding when showing an image — imageMaxSizePercent should be relative to the full token size
    padding: hasImage ? 0 : 6,
    border: hideFrame ? 'none' : `2px solid ${accentColor ?? 'var(--white-a-35)'}`,
    boxShadow: hideFrame || isDisabled ? 'none' : `0 0 14px ${accentColor ?? 'var(--white-a-24)'}`,
    opacity: isDisabled ? 0.35 : isDragging ? 0.4 : 1,
    cursor: isDisabled ? 'not-allowed' : 'grab',
  };
}

function buildDragTokenArtworkStyle(
  imageMaxSizePercent: number,
  hideShape: boolean,
  imageFit: TokenImageFit,
  imageScalePercent: number,
  focalX: number,
  focalY: number,
): CSSProperties {
  const imageSize = `${imageMaxSizePercent}%`;
  const usesFullFrame = imageFit === 'cover' || imageFit === 'fill';
  return {
    maxWidth: usesFullFrame ? '100%' : imageSize,
    maxHeight: usesFullFrame ? '100%' : imageSize,
    width: usesFullFrame ? '100%' : imageSize,
    height: usesFullFrame ? '100%' : imageSize,
    objectFit: imageFit,
    objectPosition: `${focalX}% ${focalY}%`,
    borderRadius: hideShape ? '0' : 'inherit',
    transform: `scale(${imageScalePercent / 100})`,
    transformOrigin: `${focalX}% ${focalY}%`,
  };
}

type TokenItemProps = {
  token: DragTokenItem;
  node: WidgetNode;
  isDisabled: boolean;
  tokenSize: number;
  radius: string;
  hideAccentForImageTokens: boolean;
  hideShapeForImageTokens: boolean;
  tokenImageMaxSizePercent: number;
};

function DragTokenItem({
  token,
  node,
  isDisabled,
  tokenSize,
  radius,
  hideAccentForImageTokens,
  hideShapeForImageTokens,
  tokenImageMaxSizePercent,
}: TokenItemProps): JSX.Element {
  const displayImageUrl = token.baseImageUrl ?? token.imageUrl;
  const imageFit = normalizeTokenImageFit(token.baseImageFit);
  const imageScalePercent = clampTokenImageScalePercent(token.baseImageScalePercent);
  const focalX = clampTokenImageFocal(token.baseImageFocalX, DEFAULT_TOKEN_IMAGE_FOCAL_X);
  const focalY = clampTokenImageFocal(token.baseImageFocalY, DEFAULT_TOKEN_IMAGE_FOCAL_Y);
  const hasTokenImage = Boolean(displayImageUrl);
  const hideFrame = hasTokenImage && hideAccentForImageTokens;
  const hideShape = hasTokenImage && hideShapeForImageTokens;
  const effectiveRadius = hideShape ? '0' : radius;

  const dropTargetId = String(node.props.dropTargetId ?? '').trim() || undefined;

  const { isDragging, onPointerDown } = useDragSource({
    sourceWidgetId: node.id,
    tokenId: token.id,
    tokenLabel: token.label,
    tokenImageUrl: displayImageUrl,
    payload: {
      targetActionId: token.targetActionId,
      targetSceneId: token.targetSceneId,
    },
    dropTargetId,
  });

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (isDisabled) return;
    onPointerDown(event);
  };

  return (
    <div
      onPointerDown={handlePointerDown}
      style={buildDragTokenStyle(tokenSize, token.accentColor, isDisabled, effectiveRadius, hideFrame, isDragging, hasTokenImage)}
    >
      <span style={{ position: 'relative', zIndex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%' }}>
        {displayImageUrl ? (
          <img
            src={displayImageUrl}
            alt={token.label}
            decoding="async"
            draggable={false}
            style={buildDragTokenArtworkStyle(tokenImageMaxSizePercent, hideShape, imageFit, imageScalePercent, focalX, focalY)}
          />
        ) : token.label}
      </span>
    </div>
  );
}

function DragTokenPoolRenderer({ node }: { node: WidgetNode; ctx: RenderContext }) {
  const tokens = useMemo(() => parseDragTokenItems(node.props.tokens), [node.props.tokens]);
  const tokenSize = Math.max(32, Number(node.props.tokenSize ?? 72));
  const gap = Math.max(4, Number(node.props.gap ?? 16));
  const disabled = new Set(Array.isArray(node.props.disabledIds) ? node.props.disabledIds.map((value) => String(value)) : []);
  const tokenShape: TokenShape = node.props.tokenShape === 'square' || node.props.tokenShape === 'rounded' || node.props.tokenShape === 'circle'
    ? node.props.tokenShape
    : 'circle';
  const hideAccentForImageTokens = node.props.hideAccentForImageTokens === true;
  const hideShapeForImageTokens = node.props.hideShapeForImageTokens === true;
  const tokenImageMaxSizePercent = clampTokenImageMaxSizePercent(node.props.tokenImageMaxSizePercent);
  const radius = tokenShapeToBorderRadius(tokenShape);

  return (
    <div style={dragTokenPoolShellStyle}>
      <div style={{ ...dragTokenPoolTrackBaseStyle, gap }}>
        {tokens.map((token) => (
          <DragTokenItem
            key={token.id}
            token={token}
            node={node}
            isDisabled={disabled.has(token.id)}
            tokenSize={tokenSize}
            radius={radius}
            hideAccentForImageTokens={hideAccentForImageTokens}
            hideShapeForImageTokens={hideShapeForImageTokens}
            tokenImageMaxSizePercent={tokenImageMaxSizePercent}
          />
        ))}
      </div>
    </div>
  );
}

export function renderDragTokenPoolStage(node: WidgetNode, ctx: RenderContext): JSX.Element {
  const collapsed = renderCollapsedIfNeeded(node, ctx);
  if (collapsed) return collapsed;
  return <DragTokenPoolRenderer node={node} ctx={ctx} />;
}
