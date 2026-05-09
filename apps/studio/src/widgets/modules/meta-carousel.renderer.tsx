// render-tokenized: brand/theme split enforced by lint-color-literals.mjs
import { useRef, useState } from 'react';
import type { WidgetNode } from '../../domain/document/types';
import type { RenderContext } from '../../canvas/stage/render-context';
import { StudioIcon, StudioIcons } from '../../shared/ui/icons';
import { renderCollapsedIfNeeded } from './shared-styles';
import { ModuleMediaPlaceholder } from './render-icons';
import { META_CAROUSEL_DEFAULT_CTA_LABEL } from './meta-carousel.shared';
import {
  buildMetaArrowStyle,
  buildMetaCardMediaStyle,
  buildMetaCardShellStyle,
  buildMetaDotStyle,
  buildMetaHeaderRowStyle,
  buildMetaRendererShellStyle,
  buildMetaTrackStyle,
  metaCarouselBrandPalette,
  metaCarouselUi,
} from './meta-carousel.style-recipe';
import { buildMetaCarouselViewModel, type MetaCarouselSlide } from './meta-carousel.view-model';
import { createModuleViewModel } from './view-model';

function MetaHeader({ viewModel }: { viewModel: ReturnType<typeof buildMetaCarouselViewModel> }) {
  return (
    <div style={metaCarouselUi.metaHeaderShellStyle}>
      <div style={buildMetaHeaderRowStyle(Boolean(viewModel.primaryText))}>
        <div style={metaCarouselUi.metaAvatarShellStyle}>
          {viewModel.avatarSrc ? <img src={viewModel.avatarSrc} alt="" style={metaCarouselUi.metaAvatarImageStyle} /> : null}
        </div>
        <div style={metaCarouselUi.metaHeaderTextWrapStyle}>
          <div style={metaCarouselUi.metaBrandNameStyle}>{viewModel.brandName}</div>
          <div style={metaCarouselUi.metaSponsoredStyle}>{viewModel.sponsored} · 🌐</div>
        </div>
        <span style={metaCarouselUi.metaKebabStyle}>···</span>
      </div>
      {viewModel.primaryText ? <div style={metaCarouselUi.metaPrimaryTextStyle}>{viewModel.primaryText}</div> : null}
    </div>
  );
}

function CarouselCard({
  slide,
  ctaLabel,
  isActive,
  cardW,
  imageH,
  cardRadius,
}: {
  slide: MetaCarouselSlide;
  ctaLabel: string;
  isActive: boolean;
  cardW: number;
  imageH: number;
  cardRadius: number;
}) {
  return (
    <div style={buildMetaCardShellStyle(cardW, cardRadius, isActive)}>
      <div style={buildMetaCardMediaStyle(imageH)}>
        {slide.src
          ? slide.kind === 'video'
            ? <video src={slide.src} muted playsInline style={metaCarouselUi.metaCardMediaFillStyle} />
            : <img src={slide.src} alt={slide.title} draggable={false} style={metaCarouselUi.metaCardMediaFillStyle} />
          : <ModuleMediaPlaceholder kind={slide.kind} label={slide.kind === 'video' ? 'Video' : 'Image'} color={metaCarouselBrandPalette.placeholderTint} iconSize={20} />}
      </div>

      <div style={metaCarouselUi.metaCardFooterStyle}>
        <div style={metaCarouselUi.metaCardCopyWrapStyle}>
          <div style={metaCarouselUi.metaCardTitleStyle}>{slide.title}</div>
          {slide.description ? <div style={metaCarouselUi.metaCardDescriptionStyle}>{slide.description}</div> : null}
        </div>
        <div style={metaCarouselUi.metaCardCtaStyle}>
          {ctaLabel || META_CAROUSEL_DEFAULT_CTA_LABEL}
        </div>
      </div>
    </div>
  );
}

function MetaCarouselRenderer({ node }: { node: WidgetNode; ctx: RenderContext }) {
  const viewModel = buildMetaCarouselViewModel(node);
  const skinVm = createModuleViewModel({
    type: node.type,
    props: {},
    style: node.style as Record<string, unknown>,
    surface: 'stage',
  }, () => ({}));
  const [activeIndex, setActiveIndex] = useState(0);
  const swipeStartX = useRef<number | null>(null);
  const sidePad = 12;

  function goTo(index: number) {
    setActiveIndex(Math.max(0, Math.min(viewModel.maxIndex, index)));
  }

  function onPointerDown(event: React.PointerEvent) {
    swipeStartX.current = event.clientX;
  }

  function onPointerUp(event: React.PointerEvent) {
    if (swipeStartX.current === null) return;
    const delta = event.clientX - swipeStartX.current;
    swipeStartX.current = null;
    if (Math.abs(delta) < 20) return;
    if (delta < 0) goTo(activeIndex + 1);
    else goTo(activeIndex - 1);
  }

  const translateX = activeIndex * (viewModel.cardW + viewModel.gap);

  return (
    <div style={buildMetaRendererShellStyle(skinVm.cssVars)}>
      <MetaHeader viewModel={viewModel} />

      <div style={metaCarouselUi.metaTrackViewportStyle} onPointerDown={onPointerDown} onPointerUp={onPointerUp}>
        <div style={buildMetaTrackStyle(viewModel.gap, sidePad, translateX)}>
          {viewModel.slides.map((slide, index) => (
            <CarouselCard
              key={index}
              slide={slide}
              ctaLabel={viewModel.ctaLabel}
              isActive={index === activeIndex}
              cardW={viewModel.cardW}
              imageH={viewModel.imageH}
              cardRadius={viewModel.cardRadius}
            />
          ))}
        </div>

        {activeIndex > 0 ? (
          <button
            type="button"
            onClick={() => goTo(activeIndex - 1)}
            style={buildMetaArrowStyle('left')}
            aria-label="Previous slide"
          >
            <StudioIcon icon={StudioIcons.chevronLeft} size={16} strokeWidth={2.4} />
          </button>
        ) : null}

        {activeIndex < viewModel.maxIndex ? (
          <button
            type="button"
            onClick={() => goTo(activeIndex + 1)}
            style={buildMetaArrowStyle('right')}
            aria-label="Next slide"
          >
            <StudioIcon icon={StudioIcons.chevronRight} size={16} strokeWidth={2.4} />
          </button>
        ) : null}
      </div>

      <div style={metaCarouselUi.metaDotsRowStyle}>
        {viewModel.slides.map((_, index) => (
          <div key={index} onClick={() => goTo(index)} style={buildMetaDotStyle(index === activeIndex)} />
        ))}
      </div>

      <div style={metaCarouselUi.metaActionsRowStyle}>
        {['👍 Like', '💬 Comment', '↗ Share'].map((action) => (
          <div key={action} style={metaCarouselUi.metaActionLabelStyle}>{action}</div>
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
