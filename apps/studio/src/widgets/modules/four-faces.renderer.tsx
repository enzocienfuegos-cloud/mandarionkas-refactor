// render-tokenized: brand/theme split enforced by lint-color-literals.mjs
import { useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import type { RenderContext } from '../../canvas/stage/render-context';
import type { WidgetNode } from '../../domain/document/types';
import { ModuleArrowIcon } from './render-icons';
import {
  buildArrowHintStyle,
  buildBackButtonStyle,
  buildCloseButtonStyle,
  buildDismissedStyle,
  buildDotStyle,
  buildFaceBodyStyle,
  buildFaceCopyStyle,
  buildFaceCtaStyle,
  buildFaceMediaFallbackTextStyle,
  buildFacePanelStyle,
  buildFaceTitleStyle,
  buildFourFacesShellStyle,
  buildHomeBrandStyle,
  buildHomeCtaStyle,
  buildHomeHeroFallbackTextStyle,
  buildHomeHeroStyle,
  buildHomeHintStyle,
  buildHomePanelStyle,
  buildHomeSubtitleStyle,
  buildHomeTitleStyle,
  fourFacesUi,
} from './four-faces.style-recipe';
import { buildFourFacesViewModel, type FaceConfig, type FaceId } from './four-faces.view-model';
import { createModuleViewModel } from './view-model';

function openRuntimeUrl(url: string): void {
  const value = url.trim();
  if (!value || typeof window === 'undefined') return;
  window.open(value, '_blank', 'noopener,noreferrer');
}

function ArrowHint({ direction, color }: { direction: Exclude<FaceId, 'home'>; color: string }): JSX.Element {
  return (
    <div style={buildArrowHintStyle(direction, color)}>
      <ModuleArrowIcon direction={direction} size={20} color={color} />
    </div>
  );
}

function DotBar({ active }: { active: FaceId }): JSX.Element {
  const faces: FaceId[] = ['home', 'up', 'down', 'left', 'right'];

  return (
    <div style={fourFacesUi.dotBarStyle}>
      {faces.map((face) => (
        <div key={face} style={buildDotStyle(face === active)} />
      ))}
    </div>
  );
}

function BackButton({ onBack, color }: { onBack: () => void; color: string }): JSX.Element {
  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        onBack();
      }}
      style={buildBackButtonStyle(color)}
    >
      <span style={fourFacesUi.backButtonLabelStyle}>
        <ModuleArrowIcon direction="left" size={14} color={color} />
        <span>Back</span>
      </span>
    </button>
  );
}

function FacePanel({
  face,
  active,
  onBack,
  onCta,
}: {
  face: FaceConfig;
  active: boolean;
  onBack: () => void;
  onCta: () => void;
}): JSX.Element {
  return (
    <div style={buildFacePanelStyle(face, active)}>
      <BackButton onBack={onBack} color={face.titleColor} />

      <div style={fourFacesUi.faceMediaWrapStyle}>
        {face.imageSrc ? (
          <img src={face.imageSrc} alt={face.title} style={fourFacesUi.faceMediaStyle} />
        ) : (
          <span style={buildFaceMediaFallbackTextStyle(face.titleColor)}>No image</span>
        )}
      </div>

      <div style={buildFaceCopyStyle(face)}>
        <h2 style={buildFaceTitleStyle(face)}>
          {face.title}
        </h2>
        <p style={buildFaceBodyStyle(face)}>
          {face.body}
        </p>
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onCta();
          }}
          style={buildFaceCtaStyle(face)}
        >
          {face.ctaLabel}
        </button>
      </div>
    </div>
  );
}

function FourFacesRenderer({ node, ctx }: { node: WidgetNode; ctx: RenderContext }): JSX.Element {
  const [active, setActive] = useState<FaceId>('home');
  const [transitioning, setTransitioning] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const pointerStartRef = useRef<{ x: number; y: number } | null>(null);
  const viewModel = buildFourFacesViewModel(node);
  const skinVm = createModuleViewModel({
    type: node.type,
    props: {},
    style: node.style as Record<string, unknown>,
    surface: 'stage',
  }, () => ({}));

  function navigate(target: FaceId): void {
    if (transitioning || target === active) return;
    setTransitioning(true);
    setActive(target);
    window.setTimeout(() => setTransitioning(false), 500);
  }

  function goHome(): void {
    navigate('home');
  }

  function handlePointerDown(event: ReactPointerEvent): void {
    if (!event.isPrimary || dismissed) return;
    pointerStartRef.current = { x: event.clientX, y: event.clientY };
    (event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId);
  }

  function handlePointerUp(event: ReactPointerEvent): void {
    if (!pointerStartRef.current || !event.isPrimary || dismissed) return;
    const dx = event.clientX - pointerStartRef.current.x;
    const dy = event.clientY - pointerStartRef.current.y;
    pointerStartRef.current = null;
    (event.currentTarget as HTMLElement).releasePointerCapture?.(event.pointerId);

    const absX = Math.abs(dx);
    const absY = Math.abs(dy);
    if (Math.max(absX, absY) < viewModel.swipeThreshold) return;

    if (active === 'home') {
      if (absX > absY) {
        navigate(dx < 0 ? 'right' : 'left');
      } else {
        navigate(dy < 0 ? 'up' : 'down');
      }
    } else {
      goHome();
    }
  }

  function handlePointerCancel(): void {
    pointerStartRef.current = null;
  }

  function handleCta(url: string): void {
    ctx.triggerWidgetAction('click');
    if (ctx.previewMode) openRuntimeUrl(url);
  }

  function handleClose(): void {
    if (!ctx.previewMode) {
      goHome();
      return;
    }
    setDismissed(true);
  }

  return (
    <div
      style={buildFourFacesShellStyle(node, ctx, dismissed, skinVm.cssVars)}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      onLostPointerCapture={handlePointerCancel}
    >
      <style>{`
        @keyframes smxFacePulse {
          0%, 100% { opacity: 0.5; }
          50% { opacity: 1; }
        }
      `}</style>

      {dismissed ? (
        <div style={buildDismissedStyle(viewModel.homeBg, viewModel.homeTitleColor)}>
          Ad closed
        </div>
      ) : (
        <>
          <div style={buildHomePanelStyle(viewModel.homeBg)}>
            {viewModel.logoSrc ? (
              <img src={viewModel.logoSrc} alt={viewModel.brandName} style={fourFacesUi.homeLogoStyle} />
            ) : viewModel.brandName ? (
              <div style={buildHomeBrandStyle(viewModel.brandColor)}>
                {viewModel.brandName}
              </div>
            ) : null}

            <h1 style={buildHomeTitleStyle(viewModel.homeTitleColor)}>
              {viewModel.homeTitle}
            </h1>

            {viewModel.homeSubtitle ? (
              <p style={buildHomeSubtitleStyle(viewModel.homeSubtitleColor)}>
                {viewModel.homeSubtitle}
              </p>
            ) : null}

            {viewModel.heroSrc ? (
              <img src={viewModel.heroSrc} alt="" style={buildHomeHeroStyle(viewModel.accentColor)} />
            ) : (
              <div style={fourFacesUi.homeHeroFallbackStyle}>
                <span style={buildHomeHeroFallbackTextStyle(viewModel.homeTitleColor)}>Hero image</span>
              </div>
            )}

            <p style={buildHomeHintStyle(viewModel.homeHintColor)}>
              {viewModel.homeHintText}
            </p>

            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                handleCta(viewModel.homeCtaUrl);
              }}
              style={buildHomeCtaStyle(viewModel.homeCtaBg, viewModel.homeCtaTextColor)}
            >
              {viewModel.homeCtaLabel}
            </button>
          </div>

          {viewModel.showArrows && active === 'home' ? (
            <>
              <ArrowHint direction="up" color={viewModel.accentColor} />
              <ArrowHint direction="down" color={viewModel.accentColor} />
              <ArrowHint direction="left" color={viewModel.accentColor} />
              <ArrowHint direction="right" color={viewModel.accentColor} />
            </>
          ) : null}

          {(Object.values(viewModel.faces) as FaceConfig[]).map((face) => (
            <FacePanel
              key={face.id}
              face={face}
              active={active === face.id}
              onBack={goHome}
              onCta={() => handleCta(face.ctaUrl)}
            />
          ))}

          {viewModel.showCloseButton ? (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                handleClose();
              }}
              style={buildCloseButtonStyle(viewModel.closeButtonBg, viewModel.closeButtonColor)}
            >
              ×
            </button>
          ) : null}

          {viewModel.showDots ? <DotBar active={active} /> : null}
        </>
      )}
    </div>
  );
}

export function renderFourFacesStage(node: WidgetNode, ctx: RenderContext): JSX.Element {
  return <FourFacesRenderer node={node} ctx={ctx} />;
}
