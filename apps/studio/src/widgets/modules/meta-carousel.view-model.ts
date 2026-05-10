import type { WidgetNode } from '../../domain/document/types';
import {
  META_CAROUSEL_DEFAULT_CTA_LABEL,
  META_CAROUSEL_DEFAULT_PRIMARY_TEXT,
  META_CAROUSEL_DEFAULT_SPONSORED_LABEL,
} from './meta-carousel.shared';

export type MetaCarouselSlide = {
  src: string;
  kind: 'image' | 'video';
  title: string;
  description: string;
};

export type MetaCarouselViewModel = {
  avatarSrc: string;
  brandName: string;
  sponsored: string;
  primaryText: string;
  ctaLabel: string;
  slides: MetaCarouselSlide[];
  cardWidthPct: number;
  imageHeightPct: number;
  cardRadius: number;
  gap: number;
  cardW: number;
  imageH: number;
  maxIndex: number;
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function resolveSlides(node: Pick<WidgetNode, 'props'>): MetaCarouselSlide[] {
  const count = clamp(Number(node.props.slideCount ?? 3), 1, 5);

  return Array.from({ length: count }, (_, index) => {
    const slideNumber = index + 1;
    return {
      src: String(node.props[`slide${slideNumber}Src`] ?? '').trim(),
      kind: String(node.props[`slide${slideNumber}Kind`] ?? 'image') === 'video' ? 'video' : 'image',
      title: String(node.props[`slide${slideNumber}Title`] ?? `Product ${slideNumber}`),
      description: String(node.props[`slide${slideNumber}Description`] ?? ''),
    };
  });
}

export function buildMetaCarouselViewModel(
  node: Pick<WidgetNode, 'props' | 'frame'>,
): MetaCarouselViewModel {
  const cardWidthPct = clamp(Number(node.props.cardWidthPct ?? 75), 30, 100);
  const imageHeightPct = clamp(Number(node.props.imageHeightPct ?? 60), 20, 90);
  const gap = Math.max(4, Number(node.props.cardGap ?? 10));
  const cardRadius = Math.max(0, Number(node.props.cardRadius ?? 8));
  const frameWidth = node.frame.width;
  const sidePad = 12;
  const cardW = Math.round((frameWidth - sidePad * 2) * (cardWidthPct / 100));
  const reservedPx = 136;
  const carouselHeight = Math.max(80, node.frame.height - reservedPx);
  const cardFooterHeight = 42;
  const imageH = Math.round((carouselHeight - cardFooterHeight) * (imageHeightPct / 100));
  const slides = resolveSlides(node);

  return {
    avatarSrc: String(node.props.brandAvatarSrc ?? '').trim(),
    brandName: String(node.props.brandName ?? 'Brand Name'),
    sponsored: String(node.props.sponsoredLabel ?? META_CAROUSEL_DEFAULT_SPONSORED_LABEL),
    primaryText: String(node.props.primaryText ?? META_CAROUSEL_DEFAULT_PRIMARY_TEXT),
    ctaLabel: String(node.props.ctaLabel ?? META_CAROUSEL_DEFAULT_CTA_LABEL),
    slides,
    cardWidthPct,
    imageHeightPct,
    cardRadius,
    gap,
    cardW,
    imageH,
    maxIndex: slides.length - 1,
  };
}
