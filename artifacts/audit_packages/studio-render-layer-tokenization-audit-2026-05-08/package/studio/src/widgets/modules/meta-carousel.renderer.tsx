// render-tokenized: brand/theme split enforced by lint-color-literals.mjs
import { useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import type { WidgetNode } from '../../domain/document/types';
import type { RenderContext } from '../../canvas/stage/render-context';
import { StudioIcon, StudioIcons } from '../../shared/ui/icons';
import { renderCollapsedIfNeeded } from './shared-styles';
import { ModuleMediaPlaceholder } from './render-icons';
import {
  META_CAROUSEL_DEFAULT_CTA_LABEL,
  META_CAROUSEL_DEFAULT_PRIMARY_TEXT,
  META_CAROUSEL_DEFAULT_SPONSORED_LABEL,
} from './meta-carousel.shared';

const metaCarouselBrandPalette = {
  border: '#e4e6eb',
  avatarGradient: 'linear-gradient(135deg,#1877f2,#42b883)',
  primaryText: '#050505',
  secondaryText: '#65676b',
  surface: '#fff',
  fallbackSurface: '#e4e6eb',
  ctaBorder: '#d0d5dd',
  ctaSurface: '#f0f2f5',
  dotActive: '#1877f2',
  dotInactive: '#c8ccd0',
  shadowSoft: '0 1px 3px rgba(0,0,0,0.12)',
  shadowMed: '0 2px 6px rgba(0,0,0,0.15)',
  placeholderTint: '#b0b8c1',
} as const;

const metaHeaderShellStyle = {
  padding: '10px 12px 6px',
  borderBottom: `1px solid ${metaCarouselBrandPalette.border}`,
  flexShrink: 0,
} as const;

const metaHeaderRowBaseStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
} as const;

const metaAvatarShellStyle = {
  width: 36,
  height: 36,
  borderRadius: '50%',
  overflow: 'hidden',
  flexShrink: 0,
  background: metaCarouselBrandPalette.avatarGradient,
} as const;

const metaAvatarImageStyle = {
  width: '100%',
  height: '100%',
  objectFit: 'cover',
} as const;

const metaHeaderTextWrapStyle = {
  flex: 1,
  minWidth: 0,
} as const;

const metaBrandNameStyle = {
  fontSize: 13,
  fontWeight: 600,
  color: metaCarouselBrandPalette.primaryText,
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
} as const;

const metaSponsoredStyle = {
  fontSize: 11,
  color: metaCarouselBrandPalette.secondaryText,
  fontFamily: 'sans-serif',
} as const;

const metaKebabStyle = {
  color: metaCarouselBrandPalette.secondaryText,
  fontSize: 18,
  cursor: 'pointer',
  padding: '0 4px',
} as const;

const metaPrimaryTextStyle = {
  fontSize: 13,
  color: metaCarouselBrandPalette.primaryText,
  lineHeight: 1.4,
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  marginBottom: 4,
  overflow: 'hidden',
  display: '-webkit-box',
  WebkitLineClamp: 3,
  WebkitBoxOrient: 'vertical',
} as const;

const metaCardShellBaseStyle = {
  flexShrink: 0,
  overflow: 'hidden',
  border: `1px solid ${metaCarouselBrandPalette.border}`,
  background: metaCarouselBrandPalette.surface,
  transition: 'opacity 0.2s',
  display: 'flex',
  flexDirection: 'column',
} as const;

const metaCardMediaBaseStyle = {
  width: '100%',
  background: metaCarouselBrandPalette.fallbackSurface,
  overflow: 'hidden',
  position: 'relative',
  flexShrink: 0,
} as const;

const metaCardMediaFillStyle = {
  width: '100%',
  height: '100%',
  objectFit: 'cover',
} as const;

const metaCardFooterStyle = {
  padding: '8px 10px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 6,
  flex: 1,
} as const;

const metaCardCopyWrapStyle = {
  flex: 1,
  minWidth: 0,
} as const;

const metaCardTitleStyle = {
  fontSize: 12,
  fontWeight: 600,
  color: metaCarouselBrandPalette.primaryText,
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
} as const;

const metaCardDescriptionStyle = {
  fontSize: 11,
  color: metaCarouselBrandPalette.secondaryText,
  fontFamily: 'sans-serif',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
} as const;

const metaCardCtaStyle = {
  flexShrink: 0,
  padding: '5px 10px',
  border: `1px solid ${metaCarouselBrandPalette.ctaBorder}`,
  borderRadius: 6,
  fontSize: 12,
  fontWeight: 600,
  color: metaCarouselBrandPalette.primaryText,
  fontFamily: 'sans-serif',
  cursor: 'pointer',
  whiteSpace: 'nowrap',
  background: metaCarouselBrandPalette.ctaSurface,
} as const;

const metaRendererShellStyle = {
  background: metaCarouselBrandPalette.surface,
  borderRadius: 8,
  overflow: 'hidden',
  width: '100%',
  height: '100%',
  display: 'flex',
  flexDirection: 'column',
  boxShadow: metaCarouselBrandPalette.shadowSoft,
} as const;

const metaTrackViewportStyle = {
  flex: 1,
  overflow: 'hidden',
  position: 'relative',
  cursor: 'grab',
  userSelect: 'none',
} as const;

const metaTrackBaseStyle = {
  display: 'flex',
  height: '100%',
  boxSizing: 'border-box',
  transition: 'transform 0.3s cubic-bezier(.25,.46,.45,.94)',
} as const;

const metaArrowBaseStyle = {
  position: 'absolute',
  top: '50%',
  transform: 'translateY(-50%)',
  width: 28,
  height: 28,
  borderRadius: '50%',
  border: `1px solid ${metaCarouselBrandPalette.border}`,
  background: metaCarouselBrandPalette.surface,
  boxShadow: metaCarouselBrandPalette.shadowMed,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: 16,
  color: metaCarouselBrandPalette.primaryText,
  zIndex: 2,
  lineHeight: 1,
} as const;

const metaDotsRowStyle = {
  display: 'flex',
  justifyContent: 'center',
  gap: 4,
  padding: '4px 0 6px',
  flexShrink: 0,
} as const;

const metaActionsRowStyle = {
  borderTop: `1px solid ${metaCarouselBrandPalette.border}`,
  padding: '6px 12px',
  display: 'flex',
  flexShrink: 0,
} as const;

const metaActionLabelStyle = {
  flex: 1,
  textAlign: 'center',
  fontSize: 12,
  fontWeight: 600,
  color: metaCarouselBrandPalette.secondaryText,
  padding: '4px 0',
  cursor: 'pointer',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
} as const;

function buildMetaHeaderRowStyle(hasPrimaryText: boolean): CSSProperties {
  return {
    ...metaHeaderRowBaseStyle,
    marginBottom: hasPrimaryText ? 6 : 0,
  };
}

function buildMetaCardShellStyle(cardW: number, cardRadius: number, isActive: boolean): CSSProperties {
  return {
    ...metaCardShellBaseStyle,
    width: cardW,
    borderRadius: cardRadius,
    opacity: isActive ? 1 : 0.72,
  };
}

function buildMetaCardMediaStyle(imageH: number): CSSProperties {
  return {
    ...metaCardMediaBaseStyle,
    height: imageH,
  };
}

function buildMetaTrackStyle(gap: number, sidePad: number, translateX: number): CSSProperties {
  return {
    ...metaTrackBaseStyle,
    gap,
    paddingLeft: sidePad,
    paddingRight: sidePad,
    paddingTop: 8,
    paddingBottom: 8,
    transform: `translateX(-${translateX}px)`,
  };
}

function buildMetaArrowStyle(side: 'left' | 'right'): CSSProperties {
  return {
    ...metaArrowBaseStyle,
    [side]: 4,
  } as CSSProperties;
}

function buildMetaDotStyle(active: boolean): CSSProperties {
  return {
    width: active ? 16 : 6,
    height: 6,
    borderRadius: 3,
    background: active ? metaCarouselBrandPalette.dotActive : metaCarouselBrandPalette.dotInactive,
    cursor: 'pointer',
    transition: 'all 0.2s',
  };
}

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
  const sponsored = String(node.props.sponsoredLabel ?? META_CAROUSEL_DEFAULT_SPONSORED_LABEL);
  const primaryText = String(node.props.primaryText ?? META_CAROUSEL_DEFAULT_PRIMARY_TEXT);

  return (
    <div style={metaHeaderShellStyle}>
      <div style={buildMetaHeaderRowStyle(Boolean(primaryText))}>
        <div style={metaAvatarShellStyle}>
          {avatarSrc
            ? <img src={avatarSrc} alt="" style={metaAvatarImageStyle} />
            : null}
        </div>
        <div style={metaHeaderTextWrapStyle}>
          <div style={metaBrandNameStyle}>{brandName}</div>
          <div style={metaSponsoredStyle}>{sponsored} · 🌐</div>
        </div>
        <span style={metaKebabStyle}>···</span>
      </div>
      {primaryText && (
        <div style={metaPrimaryTextStyle}>{primaryText}</div>
      )}
    </div>
  );
}

// ─── Single card ──────────────────────────────────────────────────────────────

function CarouselCard({ slide, ctaLabel, isActive, cardW, imageH, cardRadius }: {
  slide: CarouselSlide;
  ctaLabel: string;
  isActive: boolean;
  cardW: number;
  imageH: number;
  cardRadius: number;
}) {
  return (
    <div style={buildMetaCardShellStyle(cardW, cardRadius, isActive)}>
      {/* Media — height controlled by imageH prop */}
      <div style={buildMetaCardMediaStyle(imageH)}>
        {slide.src
          ? slide.kind === 'video'
            ? <video src={slide.src} muted playsInline style={metaCardMediaFillStyle} />
            : <img src={slide.src} alt={slide.title} draggable={false} style={metaCardMediaFillStyle} />
          : <ModuleMediaPlaceholder kind={slide.kind} label={slide.kind === 'video' ? 'Video' : 'Image'} color={metaCarouselBrandPalette.placeholderTint} iconSize={20} />
        }
      </div>

      {/* Card footer — title + CTA */}
      <div style={metaCardFooterStyle}>
        <div style={metaCardCopyWrapStyle}>
          <div style={metaCardTitleStyle}>{slide.title}</div>
          {slide.description && (
            <div style={metaCardDescriptionStyle}>{slide.description}</div>
          )}
        </div>
        <div style={metaCardCtaStyle}>
          {ctaLabel || META_CAROUSEL_DEFAULT_CTA_LABEL}
        </div>
      </div>
    </div>
  );
}

// ─── Main renderer ────────────────────────────────────────────────────────────

function MetaCarouselRenderer({ node, ctx }: { node: WidgetNode; ctx: RenderContext }) {
  const slides = getSlides(node);
  const ctaLabel = String(node.props.ctaLabel ?? META_CAROUSEL_DEFAULT_CTA_LABEL);
  const [activeIndex, setActiveIndex] = useState(0);
  const swipeStartX = useRef<number | null>(null);

  // ── Sizing from props — all adjustable from inspector ──────────────────────
  // cardWidthPct: card width as % of the widget frame width (default 75%)
  const cardWidthPct = Math.min(100, Math.max(30, Number(node.props.cardWidthPct ?? 75)));
  // imageHeightPct: image area as % of the card area height (default 60%)
  const imageHeightPct = Math.min(90, Math.max(20, Number(node.props.imageHeightPct ?? 60)));
  // cardRadius: border-radius of cards
  const cardRadius = Math.max(0, Number(node.props.cardRadius ?? 8));

  // Derived pixel values from the frame
  const frameW = node.frame.width;
  const SIDE_PAD = 12;
  const GAP = Math.max(4, Number(node.props.cardGap ?? 10));
  const cardW = Math.round((frameW - SIDE_PAD * 2) * (cardWidthPct / 100));

  // Image height is a % of the available carousel track area.
  // We estimate header (~80px) + dots (~22px) + footer (~34px) = ~136px reserved.
  // The rest is the carousel zone. imageHeightPct applies to that zone minus card footer (~42px).
  const RESERVED_PX = 136;
  const carouselH = Math.max(80, node.frame.height - RESERVED_PX);
  const CARD_FOOTER_H = 42;
  const imageH = Math.round((carouselH - CARD_FOOTER_H) * (imageHeightPct / 100));

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
    if (Math.abs(delta) < 20) return;
    if (delta < 0) goTo(activeIndex + 1);
    else goTo(activeIndex - 1);
  }

  const translateX = activeIndex * (cardW + GAP);
  const trackStyle = buildMetaTrackStyle(GAP, SIDE_PAD, translateX);

  return (
    <div style={metaRendererShellStyle}>
      {/* Header */}
      <MetaHeader node={node} />

      {/* Carousel track — flex: 1 fills remaining space */}
      <div style={metaTrackViewportStyle} onPointerDown={onPointerDown} onPointerUp={onPointerUp}>
        <div style={trackStyle}>
          {slides.map((slide, i) => (
            <CarouselCard
              key={i}
              slide={slide}
              ctaLabel={ctaLabel}
              isActive={i === activeIndex}
              cardW={cardW}
              imageH={imageH}
              cardRadius={cardRadius}
            />
          ))}
        </div>

        {/* Arrow prev */}
        {activeIndex > 0 && (
          <button
            type="button"
            onClick={() => goTo(activeIndex - 1)}
            style={buildMetaArrowStyle('left')}
            aria-label="Previous slide"
          >
            <StudioIcon icon={StudioIcons.chevronLeft} size={16} strokeWidth={2.4} />
          </button>
        )}

        {/* Arrow next */}
        {activeIndex < maxIndex && (
          <button
            type="button"
            onClick={() => goTo(activeIndex + 1)}
            style={buildMetaArrowStyle('right')}
            aria-label="Next slide"
          >
            <StudioIcon icon={StudioIcons.chevronRight} size={16} strokeWidth={2.4} />
          </button>
        )}
      </div>

      {/* Dot indicators */}
      <div style={metaDotsRowStyle}>
        {slides.map((_, i) => (
          <div
            key={i}
            onClick={() => goTo(i)}
            style={buildMetaDotStyle(i === activeIndex)}
          />
        ))}
      </div>

      {/* Like / Comment / Share */}
      <div style={metaActionsRowStyle}>
        {['👍 Like', '💬 Comment', '↗ Share'].map((action) => (
          <div key={action} style={metaActionLabelStyle}>{action}</div>
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
