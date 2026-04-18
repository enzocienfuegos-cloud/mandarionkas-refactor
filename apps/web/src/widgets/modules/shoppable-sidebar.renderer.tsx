import { useEffect, useMemo, useState } from 'react';
import type { WidgetNode } from '../../domain/document/types';
import type { RenderContext } from '../../canvas/stage/render-context';
import { clamp, getAccent, moduleBody, moduleHeader, moduleShell, renderCollapsedIfNeeded } from './shared-styles';
import { parseShoppableProducts, renderRatingStars } from './shoppable-sidebar.shared';

function resolveCardSize(cardShape: string): { width: number; height: number } {
  if (cardShape === 'landscape') return { width: 168, height: 110 };
  if (cardShape === 'square') return { width: 132, height: 132 };
  return { width: 124, height: 164 };
}

function ShoppableSidebarModuleRenderer({ node, ctx }: { node: WidgetNode; ctx: RenderContext }): JSX.Element {
  const accent = getAccent(node);
  const products = useMemo(() => parseShoppableProducts(node.props.products), [node.props.products]);
  const itemCount = Math.max(1, products.length || Number(node.props.itemCount ?? 1));
  const orientation = String(node.props.orientation ?? 'horizontal');
  const cardShape = String(node.props.cardShape ?? 'portrait');
  const autoscroll = Boolean(node.props.autoscroll ?? true);
  const intervalMs = clamp(Number(node.props.intervalMs ?? 2600), 1000, 10000);
  const [activeIndex, setActiveIndex] = useState(clamp(Number(node.props.activeIndex ?? 1), 1, itemCount) - 1);
  const cardSize = resolveCardSize(cardShape);

  useEffect(() => {
    if (!autoscroll || itemCount <= 1 || !ctx.previewMode) return;
    const timer = window.setInterval(() => setActiveIndex((value) => (value + 1) % itemCount), intervalMs);
    return () => window.clearInterval(timer);
  }, [autoscroll, itemCount, intervalMs, ctx.previewMode]);

  const trackStyle = orientation === 'vertical'
    ? {
        display: 'flex',
        flexDirection: 'column' as const,
        gap: 12,
        transform: `translateY(-${activeIndex * (cardSize.height + 12)}px)`,
        transition: 'transform .28s ease',
      }
    : {
        display: 'flex',
        gap: 12,
        transform: `translateX(-${activeIndex * (cardSize.width + 12)}px)`,
        transition: 'transform .28s ease',
      };

  return (
    <div style={moduleShell(node, ctx)}>
      <div style={moduleHeader(node)}>{String(node.props.title ?? node.name)}</div>
      <div style={moduleBody}>
        <div style={{ position: 'relative', flex: 1, overflow: 'hidden' }}>
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
                style={{
                  width: cardSize.width,
                  minWidth: cardSize.width,
                  height: cardSize.height,
                  borderRadius: 18,
                  overflow: 'hidden',
                  background: '#ffffff',
                  color: '#1f2937',
                  border: `1px solid ${accent}22`,
                  boxShadow: '0 10px 26px rgba(15,23,42,.12)',
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                <div style={{ position: 'relative', height: cardShape === 'landscape' ? 62 : 82, background: product.src ? '#111827' : '#f8fafc' }}>
                  {product.src ? <img src={product.src} alt={product.title} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} /> : null}
                </div>
                <div style={{ padding: '10px 10px 12px', display: 'grid', gap: 6 }}>
                  <div style={{ fontSize: 11, letterSpacing: '.08em', textTransform: 'uppercase', color: '#64748b' }}>{product.subtitle || 'Featured item'}</div>
                  <div style={{ fontSize: 13, fontWeight: 800, lineHeight: 1.2 }}>{product.title}</div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <div style={{ fontSize: 12, color: accent }}>{renderRatingStars(product.rating)}</div>
                    <div style={{ fontSize: 15, fontWeight: 900 }}>{product.price || '$0'}</div>
                  </div>
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      ctx.triggerWidgetAction('click');
                    }}
                    style={{ border: 'none', borderRadius: 10, background: accent, color: '#111827', fontWeight: 800, padding: '8px 10px', cursor: 'pointer' }}
                  >
                    {product.ctaLabel || 'Shop now'}
                  </button>
                </div>
              </article>
            ))}
          </div>
          {itemCount > 1 ? (
            <>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  setActiveIndex((value) => (value - 1 + itemCount) % itemCount);
                }}
                style={{ position: 'absolute', left: 6, top: '50%', transform: 'translateY(-50%)', width: 28, height: 28, borderRadius: 999, border: 'none', background: 'rgba(255,255,255,.86)', color: '#111827', fontWeight: 900, cursor: 'pointer' }}
              >
                ‹
              </button>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  setActiveIndex((value) => (value + 1) % itemCount);
                  ctx.triggerWidgetAction('click');
                }}
                style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', width: 28, height: 28, borderRadius: 999, border: 'none', background: 'rgba(255,255,255,.86)', color: '#111827', fontWeight: 900, cursor: 'pointer' }}
              >
                ›
              </button>
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
