import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import type { WidgetNode } from '../../domain/document/types';
import type { RenderContext } from '../../canvas/stage/render-context';
import { StudioIcon, StudioIcons } from '../../shared/ui/icons';
import { clamp, getAccent, moduleBody, moduleHeader, moduleShell, renderCollapsedIfNeeded } from './shared-styles';
import { parseShoppableProducts } from './shoppable-sidebar.shared';

const shoppableViewportStyle: CSSProperties = {
  position: 'relative',
  flex: 1,
  overflow: 'hidden',
};

const shoppableTrackVerticalBaseStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  height: '100%',
  transition: 'transform .28s ease',
};

const shoppableTrackHorizontalBaseStyle: CSSProperties = {
  display: 'flex',
  width: '100%',
  height: '100%',
  transition: 'transform .28s ease',
};

const shoppableCardBaseStyle: CSSProperties = {
  height: '100%',
  minHeight: 0,
  borderRadius: 10,
  overflow: 'hidden',
  background: '#ffffff',
  color: '#1f2937',
  border: '1px solid rgba(15,23,42,.10)',
  boxShadow: '0 4px 14px rgba(15,23,42,.08)',
  display: 'flex',
  flexDirection: 'column',
};

const shoppableMediaWrapBaseStyle: CSSProperties = {
  position: 'relative',
  flexShrink: 0,
};

const shoppableMediaStyle: CSSProperties = {
  width: '100%',
  height: '100%',
  objectFit: 'cover',
  display: 'block',
};

const shoppableCardBodyStyle: CSSProperties = {
  padding: '8px 8px 10px',
  display: 'grid',
  gap: 3,
  minHeight: 0,
  flex: 1,
  alignContent: 'start',
};

const shoppableTitleStyle: CSSProperties = {
  fontSize: 11,
  fontWeight: 800,
  letterSpacing: '.06em',
  textTransform: 'uppercase',
  color: '#0f172a',
  lineHeight: 1.15,
  display: '-webkit-box',
  WebkitBoxOrient: 'vertical',
  WebkitLineClamp: 2 as any,
  overflow: 'hidden',
};

const shoppablePriceStyle: CSSProperties = {
  fontSize: 12,
  color: '#475569',
  lineHeight: 1.15,
};

const shoppableCtaBaseStyle: CSSProperties = {
  marginTop: 'auto',
  border: 'none',
  borderRadius: 10,
  fontWeight: 800,
  padding: '7px 9px',
  cursor: 'pointer',
  fontSize: 11,
};

const shoppableNavButtonBaseStyle: CSSProperties = {
  position: 'absolute',
  top: '50%',
  transform: 'translateY(-50%)',
  width: 24,
  height: 24,
  borderRadius: 999,
  border: 'none',
  background: 'rgba(255,255,255,.94)',
  color: '#111827',
  fontWeight: 900,
  cursor: 'pointer',
  boxShadow: '0 2px 10px rgba(15,23,42,.12)',
};

function buildShoppableTrackStyle(
  orientation: string,
  gap: number,
  activeIndex: number,
  cardSize: { width: number; height: number },
): CSSProperties {
  if (orientation === 'vertical') {
    return {
      ...shoppableTrackVerticalBaseStyle,
      gap,
      transform: `translateY(-${activeIndex * (cardSize.height + gap)}px)`,
    };
  }

  return {
    ...shoppableTrackHorizontalBaseStyle,
    gap,
    transform: `translateX(-${activeIndex * (cardSize.width + 12)}px)`,
  };
}

function buildShoppableCardStyle(orientation: string, cardBasis: string): CSSProperties {
  return {
    ...shoppableCardBaseStyle,
    width: orientation === 'horizontal' ? cardBasis : '100%',
    minWidth: orientation === 'horizontal' ? cardBasis : '100%',
    maxWidth: orientation === 'horizontal' ? cardBasis : '100%',
    flex: orientation === 'horizontal' ? `0 0 ${cardBasis}` : '0 0 auto',
  };
}

function buildShoppableMediaWrapStyle(src: string, mediaHeight: number): CSSProperties {
  return {
    ...shoppableMediaWrapBaseStyle,
    height: mediaHeight,
    minHeight: mediaHeight,
    background: src ? '#111827' : '#f8fafc',
  };
}

function buildShoppableCtaStyle(
  ctaBackgroundColor: string,
  ctaTextColor: string,
  hasLabel: boolean,
): CSSProperties {
  return {
    ...shoppableCtaBaseStyle,
    background: ctaBackgroundColor,
    color: ctaTextColor,
    opacity: hasLabel ? 1 : 0,
  };
}

function buildShoppableNavButtonStyle(side: 'left' | 'right'): CSSProperties {
  return {
    ...shoppableNavButtonBaseStyle,
    [side]: 4,
  };
}

function resolveCardSize(cardShape: string): { width: number; height: number } {
  if (cardShape === 'landscape') return { width: 168, height: 110 };
  if (cardShape === 'square') return { width: 132, height: 132 };
  return { width: 124, height: 164 };
}

function ShoppableSidebarModuleRenderer({ node, ctx }: { node: WidgetNode; ctx: RenderContext }): JSX.Element {
  const accent = getAccent(node);
  const ctaBackgroundColor = String((node.style as Record<string, unknown>).ctaBackgroundColor ?? accent);
  const ctaTextColor = String((node.style as Record<string, unknown>).ctaTextColor ?? '#111827');
  const products = useMemo(() => parseShoppableProducts(node.props.products), [node.props.products]);
  const itemCount = Math.max(1, products.length || Number(node.props.itemCount ?? 1));
  const orientation = String(node.props.orientation ?? 'horizontal');
  const cardShape = String(node.props.cardShape ?? 'portrait');
  const autoscroll = Boolean(node.props.autoscroll ?? true);
  const intervalMs = clamp(Number(node.props.intervalMs ?? 2600), 1000, 10000);
  const showPrevButton = Boolean(node.props.showPrevButton ?? true);
  const showNextButton = Boolean(node.props.showNextButton ?? true);
  const [activeIndex, setActiveIndex] = useState(clamp(Number(node.props.activeIndex ?? 1), 1, itemCount) - 1);
  const fallbackCardSize = resolveCardSize(cardShape);
  const visibleCount = orientation === 'vertical' ? 1 : Math.min(2, itemCount);
  const availableWidth = Math.max(120, node.frame.width - 24);
  const availableHeight = Math.max(88, node.frame.height - 58);
  const cardSize = orientation === 'horizontal'
    ? {
        width: Math.max(96, Math.floor((availableWidth - 12 * Math.max(0, visibleCount - 1)) / visibleCount)),
        height: Math.max(92, Math.min(Math.floor(availableHeight * 0.94), fallbackCardSize.height)),
      }
    : {
        width: Math.max(110, Math.min(availableWidth, fallbackCardSize.width)),
        height: Math.max(96, Math.min(Math.floor(availableHeight * 0.94), fallbackCardSize.height)),
      };
  const mediaHeight = Math.max(60, Math.min(cardShape === 'landscape' ? Math.floor(cardSize.height * 0.58) : Math.floor(cardSize.height * 0.68), cardSize.height - 44));
  const gap = 12;
  const cardBasis = orientation === 'horizontal'
    ? `calc((100% - ${gap * Math.max(0, visibleCount - 1)}px) / ${visibleCount})`
    : '100%';

  useEffect(() => {
    if (!autoscroll || itemCount <= 1 || !ctx.previewMode) return;
    const timer = window.setInterval(() => setActiveIndex((value) => (value + 1) % itemCount), intervalMs);
    return () => window.clearInterval(timer);
  }, [autoscroll, itemCount, intervalMs, ctx.previewMode]);

  const trackStyle = buildShoppableTrackStyle(orientation, gap, activeIndex, cardSize);

  return (
    <div style={moduleShell(node, ctx)}>
      <div style={moduleHeader(node)}>{String(node.props.title ?? node.name)}</div>
      <div style={moduleBody}>
        <div style={shoppableViewportStyle}>
          <div style={trackStyle}>
            {(products.length ? products : Array.from({ length: itemCount }, (_, index) => ({
              src: '',
              title: `Product ${index + 1}`,
              subtitle: 'Product subtitle',
              price: '$0',
              rating: 4,
              ctaLabel: 'Shop now',
              url: '',
            }))).map((product, index) => (
              <article
                key={`${node.id}-product-${index}`}
                style={buildShoppableCardStyle(orientation, cardBasis)}
              >
                <div style={buildShoppableMediaWrapStyle(product.src, mediaHeight)}>
                  {product.src ? <img src={product.src} alt={product.title} style={shoppableMediaStyle} /> : null}
                </div>
                <div style={shoppableCardBodyStyle}>
                  <div style={shoppableTitleStyle}>{product.title}</div>
                  <div style={shoppablePriceStyle}>{product.price || '$0'}</div>
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      ctx.triggerWidgetAction('click');
                    }}
                    style={buildShoppableCtaStyle(ctaBackgroundColor, ctaTextColor, Boolean(product.ctaLabel))}
                  >
                    {product.ctaLabel || 'Shop now'}
                  </button>
                </div>
              </article>
            ))}
          </div>
          {itemCount > 1 ? (
            <>
              {showPrevButton ? <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  setActiveIndex((value) => (value - 1 + itemCount) % itemCount);
                }}
                style={buildShoppableNavButtonStyle('left')}
                aria-label="Previous product"
              >
                <StudioIcon icon={StudioIcons.chevronLeft} size={15} strokeWidth={2.4} />
              </button> : null}
              {showNextButton ? <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  setActiveIndex((value) => (value + 1) % itemCount);
                  ctx.triggerWidgetAction('click');
                }}
                style={buildShoppableNavButtonStyle('right')}
                aria-label="Next product"
              >
                <StudioIcon icon={StudioIcons.chevronRight} size={15} strokeWidth={2.4} />
              </button> : null}
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function renderShoppableSidebarStage(node: WidgetNode, ctx: RenderContext): JSX.Element {
  const collapsed = renderCollapsedIfNeeded(node, ctx);
  if (collapsed) return collapsed;
  return <ShoppableSidebarModuleRenderer node={node} ctx={ctx} />;
}
