import { useRef, useState } from 'react';
import type { WidgetNode } from '../../domain/document/types';
import type { RenderContext } from '../../canvas/stage/render-context';
import { renderCollapsedIfNeeded } from './shared-styles';

// ─── Types ────────────────────────────────────────────────────────────────────

interface CarouselSlide {
  src: string;
  kind: 'image' | 'video';
  title: string;
  description: string;
}

function getSlides(node: WidgetNode): CarouselSlide[] {
  const count = Math.min(5, Math.max(1, Number(node.props.slideCount ?? 3)));
  return Array.from({ length: count }, (_, i) => {
    const n = i + 1;
    return {
      src: String(node.props[`slide${n}Src`] ?? '').trim(),
      kind: String(node.props[`slide${n}Kind`] ?? 'image') === 'video' ? 'video' : 'image',
      title: String(node.props[`slide${n}Title`] ?? `Product ${n}`),
      description: String(node.props[`slide${n}Description`] ?? ''),
    };
  });
}

// ─── Facebook-style header ────────────────────────────────────────────────────

function MetaHeader({ node }: { node: WidgetNode }) {
  const avatarSrc = String(node.props.brandAvatarSrc ?? '').trim();
  const brandName = String(node.props.brandName ?? 'Brand Name');
  const sponsored = String(node.props.sponsoredLabel ?? 'Sponsored');
  const primaryText = String(node.props.primaryText ?? '');

  return (
    <div style={{ padding: '10px 12px 6px', borderBottom: '1px solid #e4e6eb' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        {/* Avatar */}
        <div style={{
          width: 36, height: 36, borderRadius: '50%', overflow: 'hidden', flexShrink: 0,
          background: 'linear-gradient(135deg,#1877f2,#42b883)',
        }}>
          {avatarSrc
            ? <img src={avatarSrc} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : null}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 13, fontWeight: 600, color: '#050505',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>{brandName}</div>
          <div style={{ fontSize: 11, color: '#65676b', fontFamily: 'sans-serif' }}>{sponsored} · 🌐</div>
        </div>
        {/* More icon */}
        <span style={{ color: '#65676b', fontSize: 18, cursor: 'pointer', padding: '0 4px' }}>···</span>
      </div>
      {primaryText && (
        <div style={{
          fontSize: 13, color: '#050505', lineHeight: 1.4,
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
          marginBottom: 4,
          overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical',
        }}>{primaryText}</div>
      )}
    </div>
  );
}

// ─── Single card ──────────────────────────────────────────────────────────────

function CarouselCard({ slide, ctaLabel, isActive }: {
  slide: CarouselSlide;
  ctaLabel: string;
  isActive: boolean;
}) {
  const CARD_W = 200;
  const CARD_H = 200;

  return (
    <div style={{
      flexShrink: 0,
      width: CARD_W,
      borderRadius: 8,
      overflow: 'hidden',
      border: '1px solid #e4e6eb',
      background: '#fff',
      opacity: isActive ? 1 : 0.7,
      transition: 'opacity 0.2s',
    }}>
      {/* Media */}
      <div style={{ width: CARD_W, height: CARD_H, background: '#e4e6eb', overflow: 'hidden', position: 'relative' }}>
        {slide.src
          ? slide.kind === 'video'
            ? <video src={slide.src} muted playsInline style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : <img src={slide.src} alt={slide.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} draggable={false} />
          : (
            <div style={{
              position: 'absolute', inset: 0, display: 'flex', alignItems: 'center',
              justifyContent: 'center', color: '#90959c', fontSize: 12, fontFamily: 'sans-serif',
            }}>
              {slide.kind === 'video' ? '▶ Video' : '◻ Image'}
            </div>
          )
        }
      </div>

      {/* Footer */}
      <div style={{ padding: '8px 10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 12, fontWeight: 600, color: '#050505',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>{slide.title}</div>
          {slide.description && (
            <div style={{
              fontSize: 11, color: '#65676b', fontFamily: 'sans-serif',
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>{slide.description}</div>
          )}
        </div>
        <div style={{
          flexShrink: 0, padding: '5px 10px',
          border: '1px solid #d0d5dd', borderRadius: 6,
          fontSize: 12, fontWeight: 600, color: '#050505',
          fontFamily: 'sans-serif', cursor: 'pointer', whiteSpace: 'nowrap',
          background: '#f0f2f5',
        }}>
          {ctaLabel || 'Shop Now'}
        </div>
      </div>
    </div>
  );
}

// ─── Main renderer ────────────────────────────────────────────────────────────

function MetaCarouselRenderer({ node, ctx }: { node: WidgetNode; ctx: RenderContext }) {
  const slides = getSlides(node);
  const ctaLabel = String(node.props.ctaLabel ?? 'Shop Now');
  const [activeIndex, setActiveIndex] = useState(0);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const swipeStartX = useRef<number | null>(null);

  const CARD_W = 200;
  const GAP = 10;
  const SIDE_PAD = 12;
  const maxIndex = slides.length - 1;

  function goTo(idx: number) {
    setActiveIndex(Math.max(0, Math.min(maxIndex, idx)));
  }

  function onPointerDown(e: React.PointerEvent) {
    swipeStartX.current = e.clientX;
  }
  function onPointerUp(e: React.PointerEvent) {
    if (swipeStartX.current === null) return;
    const delta = e.clientX - swipeStartX.current;
    swipeStartX.current = null;
    if (Math.abs(delta) < 30) return;
    if (delta < 0) goTo(activeIndex + 1);
    else goTo(activeIndex - 1);
  }

  const translateX = activeIndex * (CARD_W + GAP);

  return (
    <div style={{ background: '#fff', borderRadius: 8, overflow: 'hidden', width: '100%', height: '100%', display: 'flex', flexDirection: 'column', boxShadow: '0 1px 2px rgba(0,0,0,0.1)' }}>
      <MetaHeader node={node} />

      {/* Carousel track */}
      <div
        style={{ flex: 1, overflow: 'hidden', position: 'relative', cursor: 'grab' }}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
      >
        <div
          ref={trackRef}
          style={{
            display: 'flex',
            gap: GAP,
            paddingLeft: SIDE_PAD,
            paddingRight: SIDE_PAD,
            paddingTop: 10,
            transform: `translateX(-${translateX}px)`,
            transition: 'transform 0.3s cubic-bezier(.25,.46,.45,.94)',
          }}
        >
          {slides.map((slide, i) => (
            <CarouselCard key={i} slide={slide} ctaLabel={ctaLabel} isActive={i === activeIndex} />
          ))}
        </div>

        {/* Arrow prev */}
        {activeIndex > 0 && (
          <button
            type="button"
            onClick={() => goTo(activeIndex - 1)}
            style={{
              position: 'absolute', left: 4, top: '50%', transform: 'translateY(-50%)',
              width: 28, height: 28, borderRadius: '50%', border: '1px solid #e4e6eb',
              background: '#fff', boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 14, color: '#050505', zIndex: 2,
            }}
          >‹</button>
        )}

        {/* Arrow next */}
        {activeIndex < maxIndex && (
          <button
            type="button"
            onClick={() => goTo(activeIndex + 1)}
            style={{
              position: 'absolute', right: 4, top: '50%', transform: 'translateY(-50%)',
              width: 28, height: 28, borderRadius: '50%', border: '1px solid #e4e6eb',
              background: '#fff', boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 14, color: '#050505', zIndex: 2,
            }}
          >›</button>
        )}
      </div>

      {/* Dot indicators */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: 4, padding: '6px 0 8px' }}>
        {slides.map((_, i) => (
          <div
            key={i}
            onClick={() => goTo(i)}
            style={{
              width: i === activeIndex ? 16 : 6, height: 6, borderRadius: 3,
              background: i === activeIndex ? '#1877f2' : '#c8ccd0',
              cursor: 'pointer', transition: 'all 0.2s',
            }}
          />
        ))}
      </div>

      {/* Like/Comment/Share footer */}
      <div style={{
        borderTop: '1px solid #e4e6eb', padding: '6px 12px',
        display: 'flex', gap: 0,
      }}>
        {['👍 Like', '💬 Comment', '↗ Share'].map((action) => (
          <div key={action} style={{
            flex: 1, textAlign: 'center', fontSize: 12, fontWeight: 600,
            color: '#65676b', padding: '4px 0', cursor: 'pointer',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
          }}>{action}</div>
        ))}
      </div>
    </div>
  );
}

export function renderMetaCarouselStage(node: WidgetNode, ctx: RenderContext): JSX.Element {
  const collapsed = renderCollapsedIfNeeded(node, ctx);
  if (collapsed) return collapsed;
  return <MetaCarouselRenderer node={node} ctx={ctx} />;
}
