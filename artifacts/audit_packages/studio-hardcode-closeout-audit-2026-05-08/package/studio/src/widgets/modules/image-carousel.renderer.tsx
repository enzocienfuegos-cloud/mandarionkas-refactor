import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import type { WidgetNode } from '../../domain/document/types';
import type { RenderContext } from '../../canvas/stage/render-context';
import { clamp, getAccent, isFilenameLikeCaption, moduleBody, moduleHeader, moduleShell, parseCarouselSlides, renderCollapsedIfNeeded } from './shared-styles';
import { resolveCornerRadius } from '../shared/corner-style';

const imageCarouselViewportBaseStyle: CSSProperties = {
  position: 'relative',
  flex: 1,
  overflow: 'hidden',
  background: '#111827',
  touchAction: 'pan-y pinch-zoom',
};

const imageCarouselMediaStyle: CSSProperties = {
  width: '100%',
  height: '100%',
  objectFit: 'cover',
  display: 'block',
  pointerEvents: 'none',
  userSelect: 'none',
};

const imageCarouselEmptyStyle: CSSProperties = {
  width: '100%',
  height: '100%',
  display: 'grid',
  placeItems: 'center',
  opacity: 0.7,
};

const imageCarouselOverlayRowStyle: CSSProperties = {
  position: 'absolute',
  insetInline: 12,
  bottom: 10,
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'end',
  gap: 8,
};

const imageCarouselCaptionStyle: CSSProperties = {
  borderRadius: 10,
  padding: '8px 10px',
  background: 'rgba(15,23,42,.68)',
  fontSize: 12,
};

const imageCarouselPaginationWrapStyle: CSSProperties = {
  display: 'flex',
  gap: 4,
  alignItems: 'center',
  flexShrink: 0,
};

const imageCarouselDotBaseStyle: CSSProperties = {
  borderRadius: '50%',
  border: 'none',
  padding: 0,
  margin: 0,
  cursor: 'pointer',
  appearance: 'none',
  WebkitAppearance: 'none',
  display: 'block',
  flex: '0 0 auto',
  lineHeight: 1,
  boxSizing: 'border-box',
};

const imageCarouselButtonRowStyle: CSSProperties = {
  display: 'flex',
  gap: 8,
};

const imageCarouselNavButtonBaseStyle: CSSProperties = {
  flex: 1,
  borderRadius: 10,
  padding: '8px 10px',
};

const imageCarouselNextButtonBaseStyle: CSSProperties = {
  ...imageCarouselNavButtonBaseStyle,
  border: 'none',
  color: '#111827',
  fontWeight: 800,
};

function buildImageCarouselViewportStyle(borderRadius: number): CSSProperties {
  return {
    ...imageCarouselViewportBaseStyle,
    borderRadius,
  };
}

function buildImageCarouselDotStyle(size: number, active: boolean, accent: string): CSSProperties {
  return {
    ...imageCarouselDotBaseStyle,
    width: size,
    minWidth: size,
    height: size,
    minHeight: size,
    background: active ? accent : 'rgba(255,255,255,.45)',
  };
}

function buildImageCarouselPrevButtonStyle(accent: string): CSSProperties {
  return {
    ...imageCarouselNavButtonBaseStyle,
    border: `1px solid ${accent}`,
    background: 'transparent',
    color: 'inherit',
  };
}

function buildImageCarouselNextButtonStyle(accent: string): CSSProperties {
  return {
    ...imageCarouselNextButtonBaseStyle,
    background: accent,
  };
}

function ImageCarouselModuleRenderer({ node, ctx }: { node: WidgetNode; ctx: RenderContext }): JSX.Element {
  const accent = getAccent(node);
  const borderRadius = resolveCornerRadius(node, 20);
  const slides = useMemo(() => parseCarouselSlides(String(node.props.slides ?? '')), [node.props.slides]);
  const intervalMs = clamp(Number(node.props.intervalMs ?? 2600), 1000, 10000);
  const autoplay = Boolean(node.props.autoplay ?? true);
  const showPrevButton = Boolean(node.props.showPrevButton ?? true);
  const showNextButton = Boolean(node.props.showNextButton ?? true);
  const showPaginationDots = Boolean(node.props.showPaginationDots ?? true);
  const paginationDotSize = clamp(Number(node.props.paginationDotSize ?? 4), 2, 6);
  const [activeIndex, setActiveIndex] = useState(clamp(Number(node.props.activeIndex ?? 1), 1, Math.max(1, slides.length || 1)) - 1);
  const swipeStartRef = useRef<number | null>(null);
  const swipeLastRef = useRef<number | null>(null);
  useEffect(() => {
    if (!autoplay || slides.length <= 1 || !ctx.previewMode) return;
    const timer = window.setInterval(() => setActiveIndex((value) => (value + 1) % slides.length), intervalMs);
    return () => window.clearInterval(timer);
  }, [autoplay, slides.length, intervalMs, ctx.previewMode]);
  const activeSlide = slides[activeIndex] ?? slides[0];
  const visibleCaption = activeSlide?.caption && !isFilenameLikeCaption(activeSlide.caption) ? activeSlide.caption : '';
  const handleSwipeCommit = () => {
    if (swipeStartRef.current == null || swipeLastRef.current == null || slides.length <= 1) return;
    const delta = swipeLastRef.current - swipeStartRef.current;
    swipeStartRef.current = null;
    swipeLastRef.current = null;
    if (Math.abs(delta) < 22) return;
    if (delta < 0) {
      setActiveIndex((value)=> slides.length ? (value + 1) % slides.length : 0);
      ctx.triggerWidgetAction('click');
    } else {
      setActiveIndex((value)=> slides.length ? (value - 1 + slides.length) % slides.length : 0);
    }
  };

  const resetSwipe = () => {
    swipeStartRef.current = null;
    swipeLastRef.current = null;
  };

  return (
    <div style={moduleShell(node, ctx)}>
      <div style={moduleHeader(node)}>{String(node.props.title ?? node.name)}</div>
      <div style={moduleBody}>
        <div
          style={buildImageCarouselViewportStyle(borderRadius)}
          onPointerDown={(event) => {
            if (!event.isPrimary) return;
            swipeStartRef.current = event.clientX;
            swipeLastRef.current = event.clientX;
            event.currentTarget.setPointerCapture?.(event.pointerId);
          }}
          onPointerMove={(event) => {
            if (swipeStartRef.current != null) swipeLastRef.current = event.clientX;
          }}
          onPointerUp={(event) => {
            handleSwipeCommit();
            event.currentTarget.releasePointerCapture?.(event.pointerId);
          }}
          onPointerCancel={(event) => {
            resetSwipe();
            event.currentTarget.releasePointerCapture?.(event.pointerId);
          }}
          onLostPointerCapture={resetSwipe}
        >
          {activeSlide ? (
            <img src={activeSlide.src} alt={visibleCaption} style={imageCarouselMediaStyle} draggable={false} />
          ) : (
            <div style={imageCarouselEmptyStyle}>Add slides</div>
          )}

          <div style={imageCarouselOverlayRowStyle}>
            {visibleCaption ? <div style={imageCarouselCaptionStyle}>{visibleCaption}</div> : <div />}
            {showPaginationDots ? (
              <div style={imageCarouselPaginationWrapStyle}>
                {slides.map((_, index) => (
                  <button
                    key={index}
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      setActiveIndex(index);
                    }}
                    style={buildImageCarouselDotStyle(paginationDotSize, index === activeIndex, accent)}
                  />
                ))}
              </div>
            ) : null}
          </div>
        </div>

        {showPrevButton || showNextButton ? (
          <div style={imageCarouselButtonRowStyle}>
            {showPrevButton ? (
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  setActiveIndex((value) => (slides.length ? (value - 1 + slides.length) % slides.length : 0));
                }}
                style={buildImageCarouselPrevButtonStyle(accent)}
              >
                Prev
              </button>
            ) : null}
            {showNextButton ? (
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  setActiveIndex((value) => (slides.length ? (value + 1) % slides.length : 0));
                  ctx.triggerWidgetAction('click');
                }}
                style={buildImageCarouselNextButtonStyle(accent)}
              >
                Next
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function renderImageCarouselStage(node: WidgetNode, ctx: RenderContext): JSX.Element {
  const collapsed = renderCollapsedIfNeeded(node, ctx);
  if (collapsed) return collapsed;
  return <ImageCarouselModuleRenderer node={node} ctx={ctx} />;
}
