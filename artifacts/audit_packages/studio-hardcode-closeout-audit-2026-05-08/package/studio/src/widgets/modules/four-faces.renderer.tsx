import { useRef, useState } from 'react';
import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react';
import type { RenderContext } from '../../canvas/stage/render-context';
import type { WidgetNode } from '../../domain/document/types';
import { FOUR_FACES_DEFAULT_GLOBAL, FOUR_FACES_DEFAULT_HOME, FOUR_FACES_FACE_DEFAULTS } from './four-faces.shared';
import { moduleShellEdit } from './shared-styles';
import { ModuleArrowIcon } from './render-icons';

type FaceId = 'home' | 'up' | 'down' | 'left' | 'right';

type FaceConfig = {
  id: Exclude<FaceId, 'home'>;
  imageSrc: string;
  title: string;
  titleColor: string;
  body: string;
  bodyColor: string;
  ctaLabel: string;
  ctaUrl: string;
  headerBg: string;
  copyBg: string;
  ctaBg: string;
  ctaTextColor: string;
};

const HIDDEN_TRANSFORM: Record<FaceId, string> = {
  home: 'translate(0,0)',
  up: 'translateY(-100%)',
  down: 'translateY(100%)',
  left: 'translateX(-100%)',
  right: 'translateX(100%)',
};

const dotBarStyle: CSSProperties = {
  position: 'absolute',
  bottom: 14,
  left: 0,
  right: 0,
  display: 'flex',
  justifyContent: 'center',
  gap: 6,
  zIndex: 100,
  pointerEvents: 'none',
};

const backButtonStyle: CSSProperties = {
  alignSelf: 'flex-start',
  margin: '14px 16px 0',
  fontSize: 12,
  fontWeight: 700,
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  padding: 0,
  zIndex: 5,
  flexShrink: 0,
};

const backButtonLabelStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
};

const facePanelBaseStyle: CSSProperties = {
  position: 'absolute',
  inset: 0,
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
  zIndex: 2,
  willChange: 'transform',
};

const faceMediaWrapStyle: CSSProperties = {
  width: '100%',
  height: '50%',
  flexShrink: 0,
  overflow: 'hidden',
  background: 'rgba(0,0,0,0.08)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

const faceMediaStyle: CSSProperties = {
  width: '100%',
  height: '100%',
  objectFit: 'cover',
  display: 'block',
};

const faceMediaFallbackStyle: CSSProperties = {
  fontSize: 11,
  opacity: 0.4,
  textAlign: 'center',
};

const faceCopyBaseStyle: CSSProperties = {
  flex: 1,
  width: '100%',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '28px 28px 20px',
  clipPath: 'polygon(0 6%, 100% 0%, 100% 100%, 0% 100%)',
  textAlign: 'center',
};

const faceTitleStyle: CSSProperties = {
  fontFamily: 'system-ui, sans-serif',
  fontSize: 22,
  fontWeight: 800,
  lineHeight: 1.15,
  marginBottom: 10,
};

const faceBodyStyle: CSSProperties = {
  fontSize: 13,
  lineHeight: 1.6,
  marginBottom: 20,
};

const faceCtaBaseStyle: CSSProperties = {
  fontFamily: 'system-ui, sans-serif',
  fontSize: 15,
  fontWeight: 700,
  border: 'none',
  borderRadius: 50,
  padding: '12px 36px',
  cursor: 'pointer',
  letterSpacing: '0.03em',
  flexShrink: 0,
};

const dismissedShellBaseStyle: CSSProperties = {
  position: 'absolute',
  inset: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: 13,
  letterSpacing: '0.04em',
  textTransform: 'uppercase',
};

const homePanelBaseStyle: CSSProperties = {
  position: 'absolute',
  inset: 0,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  overflow: 'hidden',
  zIndex: 1,
  padding: '20px 24px',
  gap: 0,
};

const homeLogoStyle: CSSProperties = {
  height: 48,
  maxWidth: 140,
  objectFit: 'contain',
  marginBottom: 14,
};

const homeBrandStyle: CSSProperties = {
  fontSize: 20,
  fontWeight: 900,
  letterSpacing: '0.04em',
  textTransform: 'uppercase',
  marginBottom: 14,
};

const homeTitleStyle: CSSProperties = {
  fontSize: 26,
  fontWeight: 800,
  textAlign: 'center',
  lineHeight: 1.1,
  marginBottom: 10,
  whiteSpace: 'pre-line',
};

const homeSubtitleStyle: CSSProperties = {
  fontSize: 14,
  textAlign: 'center',
  lineHeight: 1.5,
  marginBottom: 20,
};

const homeHeroFallbackStyle: CSSProperties = {
  width: '72%',
  maxWidth: 260,
  aspectRatio: '1 / 1',
  borderRadius: 16,
  background: 'rgba(0,0,0,0.06)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  marginBottom: 18,
};

const homeHeroFallbackTextStyle: CSSProperties = {
  fontSize: 11,
  opacity: 0.4,
};

const homeHintStyle: CSSProperties = {
  fontSize: 12,
  textAlign: 'center',
  marginBottom: 18,
  letterSpacing: '0.04em',
};

const homeCtaBaseStyle: CSSProperties = {
  fontSize: 16,
  fontWeight: 700,
  border: 'none',
  borderRadius: 50,
  padding: '13px 40px',
  cursor: 'pointer',
  letterSpacing: '0.04em',
  flexShrink: 0,
};

const closeButtonBaseStyle: CSSProperties = {
  position: 'absolute',
  top: 14,
  right: 14,
  zIndex: 999,
  width: 32,
  height: 32,
  borderRadius: '50%',
  border: '1.5px solid rgba(255,255,255,0.4)',
  fontSize: 14,
  fontWeight: 700,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  pointerEvents: 'all',
};

function buildArrowHintStyle(direction: 'up' | 'down' | 'left' | 'right', color: string): CSSProperties {
  const posStyle: CSSProperties =
    direction === 'up'
      ? { top: 10, left: '50%', transform: 'translateX(-50%)' }
      : direction === 'down'
        ? { bottom: 10, left: '50%', transform: 'translateX(-50%)' }
        : direction === 'left'
          ? { left: 10, top: '50%', transform: 'translateY(-50%)' }
          : { right: 10, top: '50%', transform: 'translateY(-50%)' };
  return {
    position: 'absolute',
    ...posStyle,
    color,
    fontSize: 20,
    opacity: 0.85,
    pointerEvents: 'none',
    zIndex: 50,
    animation: 'smxFacePulse 2s ease-in-out infinite',
  };
}

function buildDotStyle(active: boolean): CSSProperties {
  return {
    width: active ? 18 : 8,
    height: 8,
    borderRadius: 4,
    background: active ? '#fff' : 'rgba(255,255,255,0.4)',
    transition: 'all 0.3s ease',
  };
}

function buildBackButtonStyle(color: string): CSSProperties {
  return {
    ...backButtonStyle,
    color,
  };
}

function buildFacePanelStyle(face: FaceConfig, active: boolean): CSSProperties {
  return {
    ...facePanelBaseStyle,
    background: face.headerBg,
    transform: active ? 'translate(0,0)' : HIDDEN_TRANSFORM[face.id],
    transition: 'transform 0.45s cubic-bezier(0.77,0,0.175,1)',
  };
}

function buildFaceCopyStyle(face: FaceConfig): CSSProperties {
  return {
    ...faceCopyBaseStyle,
    background: face.copyBg,
  };
}

function buildFaceTitleStyle(face: FaceConfig): CSSProperties {
  return {
    ...faceTitleStyle,
    color: face.titleColor,
  };
}

function buildFaceBodyStyle(face: FaceConfig): CSSProperties {
  return {
    ...faceBodyStyle,
    color: face.bodyColor,
  };
}

function buildFaceCtaStyle(face: FaceConfig): CSSProperties {
  return {
    ...faceCtaBaseStyle,
    background: face.ctaBg,
    color: face.ctaTextColor,
    boxShadow: `0 6px 20px ${face.ctaBg}55`,
  };
}

function buildFaceMediaFallbackTextStyle(color: string): CSSProperties {
  return {
    ...faceMediaFallbackStyle,
    color,
  };
}

function buildDismissedStyle(homeBg: string, homeTitleColor: string): CSSProperties {
  return {
    ...dismissedShellBaseStyle,
    background: homeBg,
    color: homeTitleColor,
  };
}

function buildHomePanelStyle(homeBg: string): CSSProperties {
  return {
    ...homePanelBaseStyle,
    background: homeBg,
  };
}

function buildHomeBrandStyle(brandColor: string): CSSProperties {
  return {
    ...homeBrandStyle,
    color: brandColor,
  };
}

function buildHomeTitleStyle(homeTitleColor: string): CSSProperties {
  return {
    ...homeTitleStyle,
    color: homeTitleColor,
  };
}

function buildHomeSubtitleStyle(homeSubtitleColor: string): CSSProperties {
  return {
    ...homeSubtitleStyle,
    color: homeSubtitleColor,
  };
}

function buildHomeHeroStyle(heroSrc: string, accentColor: string): CSSProperties {
  return {
    width: '72%',
    maxWidth: 260,
    aspectRatio: '1 / 1',
    objectFit: 'cover',
    borderRadius: 16,
    boxShadow: `0 12px 40px ${accentColor}30`,
    marginBottom: 18,
    display: 'block',
  };
}

function buildHomeHeroFallbackTextStyle(color: string): CSSProperties {
  return {
    ...homeHeroFallbackTextStyle,
    color,
  };
}

function buildHomeHintStyle(homeHintColor: string): CSSProperties {
  return {
    ...homeHintStyle,
    color: homeHintColor,
  };
}

function buildHomeCtaStyle(homeCtaBg: string, homeCtaTextColor: string): CSSProperties {
  return {
    ...homeCtaBaseStyle,
    background: homeCtaBg,
    color: homeCtaTextColor,
    boxShadow: `0 6px 20px ${homeCtaBg}50`,
  };
}

function buildCloseButtonStyle(closeButtonBg: string, closeButtonColor: string): CSSProperties {
  return {
    ...closeButtonBaseStyle,
    background: closeButtonBg,
    color: closeButtonColor,
  };
}

function openRuntimeUrl(url: string): void {
  const value = url.trim();
  if (!value || typeof window === 'undefined') return;
  window.open(value, '_blank', 'noopener,noreferrer');
}

function ArrowHint({ direction, color }: { direction: 'up' | 'down' | 'left' | 'right'; color: string }): JSX.Element {
  return (
    <div style={buildArrowHintStyle(direction, color)}>
      <ModuleArrowIcon direction={direction} size={20} color={color} />
    </div>
  );
}

function DotBar({ active }: { active: FaceId }): JSX.Element {
  const faces: FaceId[] = ['home', 'up', 'down', 'left', 'right'];
  return (
    <div style={dotBarStyle}>
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
      <span style={backButtonLabelStyle}>
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

      <div style={faceMediaWrapStyle}>
        {face.imageSrc ? (
          <img src={face.imageSrc} alt={face.title} style={faceMediaStyle} />
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

  const accentColor = String(node.props.accentColor ?? FOUR_FACES_DEFAULT_GLOBAL.accentColor);
  const swipeThreshold = Number(node.props.swipeThreshold ?? FOUR_FACES_DEFAULT_GLOBAL.swipeThreshold);
  const showDots = Boolean(node.props.showDots ?? true);
  const showArrows = Boolean(node.props.showArrows ?? true);
  const showCloseButton = Boolean(node.props.showCloseButton ?? true);
  const closeButtonBg = String(node.props.closeButtonBg ?? FOUR_FACES_DEFAULT_GLOBAL.closeButtonBg);
  const closeButtonColor = String(node.props.closeButtonColor ?? FOUR_FACES_DEFAULT_GLOBAL.closeButtonColor);
  const homeBg = String(node.props.homeBg ?? FOUR_FACES_DEFAULT_HOME.bg);
  const homeTitle = String(node.props.homeTitle ?? FOUR_FACES_DEFAULT_HOME.title);
  const homeTitleColor = String(node.props.homeTitleColor ?? '#1a1a1a');
  const homeSubtitle = String(node.props.homeSubtitle ?? FOUR_FACES_DEFAULT_HOME.subtitle);
  const homeSubtitleColor = String(node.props.homeSubtitleColor ?? '#555555');
  const homeHintText = String(node.props.homeHintText ?? FOUR_FACES_DEFAULT_HOME.hintText);
  const homeHintColor = String(node.props.homeHintColor ?? '#999999');
  const homeCtaLabel = String(node.props.homeCtaLabel ?? FOUR_FACES_DEFAULT_HOME.ctaLabel);
  const homeCtaUrl = String(node.props.homeCtaUrl ?? '');
  const homeCtaBg = String(node.props.homeCtaBg ?? accentColor);
  const homeCtaTextColor = String(node.props.homeCtaTextColor ?? '#ffffff');
  const heroSrc = String(node.props.heroSrc ?? '');
  const brandName = String(node.props.brandName ?? '');
  const brandColor = String(node.props.brandColor ?? accentColor);
  const logoSrc = String(node.props.logoSrc ?? '');

  function buildFace(dir: Exclude<FaceId, 'home'>, defaults: {
    headerBg: string;
    copyBg: string;
    titleColor: string;
    bodyColor: string;
    ctaBg: string;
    ctaTextColor: string;
  }): FaceConfig {
    return {
      id: dir,
      imageSrc: String(node.props[`${dir}ImageSrc`] ?? ''),
      title: String(node.props[`${dir}Title`] ?? FOUR_FACES_FACE_DEFAULTS[dir].title),
      titleColor: String(node.props[`${dir}TitleColor`] ?? defaults.titleColor),
      body: String(node.props[`${dir}Body`] ?? FOUR_FACES_FACE_DEFAULTS[dir].body),
      bodyColor: String(node.props[`${dir}BodyColor`] ?? defaults.bodyColor),
      ctaLabel: String(node.props[`${dir}CtaLabel`] ?? FOUR_FACES_FACE_DEFAULTS[dir].ctaLabel),
      ctaUrl: String(node.props[`${dir}CtaUrl`] ?? ''),
      headerBg: String(node.props[`${dir}HeaderBg`] ?? defaults.headerBg),
      copyBg: String(node.props[`${dir}CopyBg`] ?? defaults.copyBg),
      ctaBg: String(node.props[`${dir}CtaBg`] ?? defaults.ctaBg),
      ctaTextColor: String(node.props[`${dir}CtaTextColor`] ?? defaults.ctaTextColor),
    };
  }

  const faces: Record<Exclude<FaceId, 'home'>, FaceConfig> = {
    up: buildFace('up', {
      headerBg: accentColor,
      copyBg: FOUR_FACES_FACE_DEFAULTS.up.copyBg,
      titleColor: FOUR_FACES_FACE_DEFAULTS.up.titleColor,
      bodyColor: FOUR_FACES_FACE_DEFAULTS.up.bodyColor,
      ctaBg: accentColor,
      ctaTextColor: FOUR_FACES_FACE_DEFAULTS.up.ctaTextColor,
    }),
    down: buildFace('down', {
      headerBg: FOUR_FACES_FACE_DEFAULTS.down.headerBg,
      copyBg: FOUR_FACES_FACE_DEFAULTS.down.copyBg,
      titleColor: FOUR_FACES_FACE_DEFAULTS.down.titleColor,
      bodyColor: FOUR_FACES_FACE_DEFAULTS.down.bodyColor,
      ctaBg: FOUR_FACES_FACE_DEFAULTS.down.ctaBg,
      ctaTextColor: FOUR_FACES_FACE_DEFAULTS.down.ctaTextColor,
    }),
    left: buildFace('left', {
      headerBg: FOUR_FACES_FACE_DEFAULTS.left.headerBg,
      copyBg: FOUR_FACES_FACE_DEFAULTS.left.copyBg,
      titleColor: FOUR_FACES_FACE_DEFAULTS.left.titleColor,
      bodyColor: FOUR_FACES_FACE_DEFAULTS.left.bodyColor,
      ctaBg: accentColor,
      ctaTextColor: FOUR_FACES_FACE_DEFAULTS.left.ctaTextColor,
    }),
    right: buildFace('right', {
      headerBg: FOUR_FACES_FACE_DEFAULTS.right.headerBg,
      copyBg: FOUR_FACES_FACE_DEFAULTS.right.copyBg,
      titleColor: FOUR_FACES_FACE_DEFAULTS.right.titleColor,
      bodyColor: FOUR_FACES_FACE_DEFAULTS.right.bodyColor,
      ctaBg: accentColor,
      ctaTextColor: FOUR_FACES_FACE_DEFAULTS.right.ctaTextColor,
    }),
  };

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
    if (Math.max(absX, absY) < swipeThreshold) return;

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

  const shellStyle: CSSProperties = ctx.previewMode
    ? { width: '100%', height: '100%', position: 'relative', overflow: 'hidden', background: '#000', touchAction: 'none', userSelect: 'none', cursor: dismissed ? 'default' : 'grab' }
    : { ...moduleShellEdit(node), position: 'relative', overflow: 'hidden', touchAction: 'none' };

  return (
    <div
      style={shellStyle}
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
        <div style={buildDismissedStyle(homeBg, homeTitleColor)}>
          Ad closed
        </div>
      ) : (
        <>
          <div style={buildHomePanelStyle(homeBg)}>
            {logoSrc ? (
              <img src={logoSrc} alt={brandName} style={homeLogoStyle} />
            ) : brandName ? (
              <div style={buildHomeBrandStyle(brandColor)}>
                {brandName}
              </div>
            ) : null}

            <h1 style={buildHomeTitleStyle(homeTitleColor)}>
              {homeTitle}
            </h1>

            {homeSubtitle ? (
              <p style={buildHomeSubtitleStyle(homeSubtitleColor)}>
                {homeSubtitle}
              </p>
            ) : null}

            {heroSrc ? (
              <img src={heroSrc} alt="" style={buildHomeHeroStyle(heroSrc, accentColor)} />
            ) : (
              <div style={homeHeroFallbackStyle}>
                <span style={buildHomeHeroFallbackTextStyle(homeTitleColor)}>Hero image</span>
              </div>
            )}

            <p style={buildHomeHintStyle(homeHintColor)}>
              {homeHintText}
            </p>

            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                handleCta(homeCtaUrl);
              }}
              style={buildHomeCtaStyle(homeCtaBg, homeCtaTextColor)}
            >
              {homeCtaLabel}
            </button>
          </div>

          {showArrows && active === 'home' ? (
            <>
              <ArrowHint direction="up" color={accentColor} />
              <ArrowHint direction="down" color={accentColor} />
              <ArrowHint direction="left" color={accentColor} />
              <ArrowHint direction="right" color={accentColor} />
            </>
          ) : null}

          {(Object.values(faces) as FaceConfig[]).map((face) => (
            <FacePanel
              key={face.id}
              face={face}
              active={active === face.id}
              onBack={goHome}
              onCta={() => handleCta(face.ctaUrl)}
            />
          ))}

          {showCloseButton ? (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                handleClose();
              }}
              style={buildCloseButtonStyle(closeButtonBg, closeButtonColor)}
            >
              ×
            </button>
          ) : null}

          {showDots ? <DotBar active={active} /> : null}
        </>
      )}
    </div>
  );
}

export function renderFourFacesStage(node: WidgetNode, ctx: RenderContext): JSX.Element {
  return <FourFacesRenderer node={node} ctx={ctx} />;
}
