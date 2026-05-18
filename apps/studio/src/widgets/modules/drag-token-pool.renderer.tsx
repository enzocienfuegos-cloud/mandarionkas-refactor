// render-tokenized: brand/theme split enforced by lint-color-literals.mjs
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import type { WidgetNode } from '../../domain/document/types';
import type { RenderContext } from '../../canvas/stage/render-context';
import { renderCollapsedIfNeeded } from './shared-styles';
import { emitTokenDrag } from './token-drag-runtime';
import {
  clampTokenImageFocal,
  clampTokenImageMaxSizePercent,
  clampTokenImageScalePercent,
  DEFAULT_TOKEN_IMAGE_FOCAL_X,
  DEFAULT_TOKEN_IMAGE_FOCAL_Y,
  normalizeTokenImageFit,
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
  padding: 6,
  userSelect: 'none',
  WebkitUserSelect: 'none',
  touchAction: 'none',
  pointerEvents: 'auto',
  position: 'relative',
};

const dragTokenGhostBaseStyle: CSSProperties = {
  position: 'fixed',
  overflow: 'hidden',
  background: 'transparent',
  color: 'var(--surface-card-light)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  textAlign: 'center',
  padding: 6,
  fontSize: 11,
  fontWeight: 700,
  transform: 'translate(-50%, -50%) scale(1.06)',
  pointerEvents: 'none',
  zIndex: 9999,
};

function buildDragTokenTrackStyle(gap: number): CSSProperties {
  return {
    ...dragTokenPoolTrackBaseStyle,
    gap,
  };
}

function buildDragTokenStyle(
  tokenSize: number,
  accentColor: string | undefined,
  isDisabled: boolean,
  radius: string,
  hideFrame: boolean,
): CSSProperties {
  return {
    ...dragTokenBaseStyle,
    borderRadius: radius,
    width: tokenSize,
    height: tokenSize,
    border: hideFrame ? 'none' : `2px solid ${accentColor ?? 'var(--white-a-35)'}`,
    boxShadow: hideFrame || isDisabled ? 'none' : `0 0 14px ${accentColor ?? 'var(--white-a-24)'}`,
    opacity: isDisabled ? 0.35 : 1,
    cursor: isDisabled ? 'not-allowed' : 'grab',
  };
}

function buildDragTokenGhostStyle(
  pointerPosition: { x: number; y: number },
  tokenSize: number,
  accentColor: string | undefined,
  radius: string,
  hideFrame: boolean,
): CSSProperties {
  return {
    ...dragTokenGhostBaseStyle,
    borderRadius: radius,
    left: pointerPosition.x,
    top: pointerPosition.y,
    width: tokenSize,
    height: tokenSize,
    border: hideFrame ? 'none' : `2px solid ${accentColor ?? 'var(--white-a-35)'}`,
    boxShadow: hideFrame
      ? '0 14px 30px hsl(0 0% 0% / 0.22)'
      : `0 14px 30px hsl(0 0% 0% / 0.28), 0 0 18px ${accentColor ?? 'var(--white-a-24)'}`,
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

function DragTokenPoolRenderer({ node }: { node: WidgetNode; ctx: RenderContext }) {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [pointerPosition, setPointerPosition] = useState<{ x: number; y: number } | null>(null);
  const pointerStateRef = useRef<{ pointerId: number; tokenId: string } | null>(null);
  const tokens: DragTokenItem[] = Array.isArray(node.props.tokens) ? node.props.tokens as DragTokenItem[] : [];
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

  useEffect(() => {
    if (!draggingId) return undefined;
    const handlePointerMove = (event: PointerEvent) => {
      const current = pointerStateRef.current;
      if (!current || event.pointerId !== current.pointerId) return;
      setPointerPosition({ x: event.clientX, y: event.clientY });
      emitTokenDrag({
        phase: 'move',
        tokenId: current.tokenId,
        sourceWidgetId: node.id,
        clientX: event.clientX,
        clientY: event.clientY,
      });
    };
    const finishDrag = (event: PointerEvent, phase: 'end' | 'cancel') => {
      const current = pointerStateRef.current;
      if (!current || event.pointerId !== current.pointerId) return;
      emitTokenDrag({
        phase,
        tokenId: current.tokenId,
        sourceWidgetId: node.id,
        clientX: event.clientX,
        clientY: event.clientY,
      });
      pointerStateRef.current = null;
      setDraggingId(null);
      setPointerPosition(null);
    };
    const handlePointerUp = (event: PointerEvent) => finishDrag(event, 'end');
    const handlePointerCancel = (event: PointerEvent) => finishDrag(event, 'cancel');

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerCancel);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerCancel);
    };
  }, [draggingId, node.id]);

  return (
    <div style={dragTokenPoolShellStyle}>
      <div style={buildDragTokenTrackStyle(gap)}>
        {tokens.map((token) => {
          const isDisabled = disabled.has(token.id);
          const displayImageUrl = token.baseImageUrl ?? token.imageUrl;
          const imageFit = normalizeTokenImageFit(token.baseImageFit);
          const imageScalePercent = clampTokenImageScalePercent(token.baseImageScalePercent);
          const focalX = clampTokenImageFocal(token.baseImageFocalX, DEFAULT_TOKEN_IMAGE_FOCAL_X);
          const focalY = clampTokenImageFocal(token.baseImageFocalY, DEFAULT_TOKEN_IMAGE_FOCAL_Y);
          const hasTokenImage = Boolean(displayImageUrl);
          const hideFrame = hasTokenImage && hideAccentForImageTokens;
          const hideShape = hasTokenImage && hideShapeForImageTokens;
          const effectiveRadius = hideShape ? '0' : radius;
          return (
            <div
              key={token.id}
              onPointerDown={(event) => {
                event.stopPropagation();
                if (isDisabled) return;
                pointerStateRef.current = { pointerId: event.pointerId, tokenId: token.id };
                setDraggingId(token.id);
                setPointerPosition({ x: event.clientX, y: event.clientY });
                emitTokenDrag({
                  phase: 'start',
                  tokenId: token.id,
                  sourceWidgetId: node.id,
                  clientX: event.clientX,
                  clientY: event.clientY,
                });
              }}
              style={buildDragTokenStyle(tokenSize, token.accentColor, isDisabled, effectiveRadius, hideFrame)}
            >
              <span style={{ position: 'relative', zIndex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%' }}>
                {displayImageUrl ? (
                  <img
                    src={displayImageUrl}
                    alt={token.label}
                    draggable={false}
                    style={buildDragTokenArtworkStyle(tokenImageMaxSizePercent, hideShape, imageFit, imageScalePercent, focalX, focalY)}
                  />
                ) : token.label}
              </span>
            </div>
          );
        })}
      </div>
      {draggingId && pointerPosition ? (() => {
        const draggingToken = tokens.find((token) => token.id === draggingId);
        if (!draggingToken) return null;
        const displayImageUrl = draggingToken.baseImageUrl ?? draggingToken.imageUrl;
        const imageFit = normalizeTokenImageFit(draggingToken.baseImageFit);
        const imageScalePercent = clampTokenImageScalePercent(draggingToken.baseImageScalePercent);
        const focalX = clampTokenImageFocal(draggingToken.baseImageFocalX, DEFAULT_TOKEN_IMAGE_FOCAL_X);
        const focalY = clampTokenImageFocal(draggingToken.baseImageFocalY, DEFAULT_TOKEN_IMAGE_FOCAL_Y);
        const hasTokenImage = Boolean(displayImageUrl);
        const hideFrame = hasTokenImage && hideAccentForImageTokens;
        const hideShape = hasTokenImage && hideShapeForImageTokens;
        const effectiveRadius = hideShape ? '0' : radius;
        return createPortal(
        <div
          style={buildDragTokenGhostStyle(
            pointerPosition,
            tokenSize,
            draggingToken.accentColor,
            effectiveRadius,
            hideFrame,
          )}
        >
          <>
            <span style={{ position: 'relative', zIndex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%' }}>
              {displayImageUrl ? (
                <img
                  src={displayImageUrl}
                  alt={draggingToken.label}
                  draggable={false}
                  style={{
                    ...buildDragTokenArtworkStyle(tokenImageMaxSizePercent, hideShape, imageFit, imageScalePercent, focalX, focalY),
                    pointerEvents: 'none',
                  }}
                />
              ) : draggingToken.label}
            </span>
          </>
        </div>,
        document.body,
        );
      })() : null}
    </div>
  );
}

export function renderDragTokenPoolStage(node: WidgetNode, ctx: RenderContext): JSX.Element {
  const collapsed = renderCollapsedIfNeeded(node, ctx);
  if (collapsed) return collapsed;
  return <DragTokenPoolRenderer node={node} ctx={ctx} />;
}
