import { useRef, useState } from 'react';
import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react';
import type { RenderContext } from '../../canvas/stage/render-context';
import type { WidgetNode } from '../../domain/document/types';
import { moduleShellEdit } from './shared-styles';

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

function openRuntimeUrl(url: string): void {
  const value = url.trim();
  if (!value || typeof window === 'undefined') return;
  window.open(value, '_blank', 'noopener,noreferrer');
}

function ArrowHint({ direction, color }: { direction: 'up' | 'down' | 'left' | 'right'; color: string }): JSX.Element {
  const glyphs = { up: '▲', down: '▼', left: '◀', right: '▶' };
  const posStyle: CSSProperties =
    direction === 'up'
      ? { top: 10, left: '50%', transform: 'translateX(-50%)' }
      : direction === 'down'
        ? { bottom: 10, left: '50%', transform: 'translateX(-50%)' }
        : direction === 'left'
          ? { left: 10, top: '50%', transform: 'translateY(-50%)' }
          : { right: 10, top: '50%', transform: 'translateY(-50%)' };

  return (
    <div
      style={{
        position: 'absolute',
        ...posStyle,
        color,
        fontSize: 20,
        opacity: 0.85,
        pointerEvents: 'none',
        zIndex: 50,
        animation: 'smxFacePulse 2s ease-in-out infinite',
      }}
    >
      {glyphs[direction]}
    </div>
  );
}

function DotBar({ active }: { active: FaceId }): JSX.Element {
  const faces: FaceId[] = ['home', 'up', 'down', 'left', 'right'];
  return (
    <div style={{ position: 'absolute', bottom: 14, left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: 6, zIndex: 100, pointerEvents: 'none' }}>
      {faces.map((face) => (
        <div
          key={face}
          style={{
            width: face === active ? 18 : 8,
            height: 8,
            borderRadius: 4,
            background: face === active ? '#fff' : 'rgba(255,255,255,0.4)',
            transition: 'all 0.3s ease',
          }}
        />
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
      style={{
        alignSelf: 'flex-start',
        margin: '14px 16px 0',
        fontSize: 12,
        fontWeight: 700,
        color,
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        padding: 0,
        zIndex: 5,
        flexShrink: 0,
      }}
    >
      ‹ Back
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
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        background: face.headerBg,
        transform: active ? 'translate(0,0)' : HIDDEN_TRANSFORM[face.id],
        transition: 'transform 0.45s cubic-bezier(0.77,0,0.175,1)',
        zIndex: 2,
        willChange: 'transform',
      }}
    >
      <BackButton onBack={onBack} color={face.titleColor} />

      <div style={{ width: '100%', height: '50%', flexShrink: 0, overflow: 'hidden', background: 'rgba(0,0,0,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {face.imageSrc ? (
          <img src={face.imageSrc} alt={face.title} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
        ) : (
          <span style={{ fontSize: 11, opacity: 0.4, textAlign: 'center', color: face.titleColor }}>No image</span>
        )}
      </div>

      <div
        style={{
          background: face.copyBg,
          flex: 1,
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '28px 28px 20px',
          clipPath: 'polygon(0 6%, 100% 0%, 100% 100%, 0% 100%)',
          textAlign: 'center',
        }}
      >
        <h2 style={{ fontFamily: 'system-ui, sans-serif', fontSize: 22, fontWeight: 800, color: face.titleColor, lineHeight: 1.15, marginBottom: 10 }}>
          {face.title}
        </h2>
        <p style={{ fontSize: 13, color: face.bodyColor, lineHeight: 1.6, marginBottom: 20 }}>
          {face.body}
        </p>
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onCta();
          }}
          style={{
            background: face.ctaBg,
            color: face.ctaTextColor,
            fontFamily: 'system-ui, sans-serif',
            fontSize: 15,
            fontWeight: 700,
            border: 'none',
            borderRadius: 50,
            padding: '12px 36px',
            cursor: 'pointer',
            boxShadow: `0 6px 20px ${face.ctaBg}55`,
            letterSpacing: '0.03em',
            flexShrink: 0,
          }}
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

  const accentColor = String(node.props.accentColor ?? '#C8102E');
  const swipeThreshold = Number(node.props.swipeThreshold ?? 40);
  const showDots = Boolean(node.props.showDots ?? true);
  const showArrows = Boolean(node.props.showArrows ?? true);
  const showCloseButton = Boolean(node.props.showCloseButton ?? true);
  const closeButtonBg = String(node.props.closeButtonBg ?? 'rgba(0,0,0,0.5)');
  const closeButtonColor = String(node.props.closeButtonColor ?? '#ffffff');
  const homeBg = String(node.props.homeBg ?? '#F2F2F2');
  const homeTitle = String(node.props.homeTitle ?? 'Headline principal');
  const homeTitleColor = String(node.props.homeTitleColor ?? '#1a1a1a');
  const homeSubtitle = String(node.props.homeSubtitle ?? '');
  const homeSubtitleColor = String(node.props.homeSubtitleColor ?? '#555555');
  const homeHintText = String(node.props.homeHintText ?? 'Swipe to explore');
  const homeHintColor = String(node.props.homeHintColor ?? '#999999');
  const homeCtaLabel = String(node.props.homeCtaLabel ?? 'Learn more');
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
      title: String(node.props[`${dir}Title`] ?? 'Title'),
      titleColor: String(node.props[`${dir}TitleColor`] ?? defaults.titleColor),
      body: String(node.props[`${dir}Body`] ?? 'Description goes here.'),
      bodyColor: String(node.props[`${dir}BodyColor`] ?? defaults.bodyColor),
      ctaLabel: String(node.props[`${dir}CtaLabel`] ?? 'Learn more'),
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
      copyBg: '#ffffff',
      titleColor: '#1a1a1a',
      bodyColor: '#555555',
      ctaBg: accentColor,
      ctaTextColor: '#ffffff',
    }),
    down: buildFace('down', {
      headerBg: '#F5C400',
      copyBg: '#1A1A1A',
      titleColor: '#ffffff',
      bodyColor: 'rgba(255,255,255,0.75)',
      ctaBg: '#F5C400',
      ctaTextColor: '#1a1a1a',
    }),
    left: buildFace('left', {
      headerBg: '#ffffff',
      copyBg: '#ffffff',
      titleColor: '#1a1a1a',
      bodyColor: '#555555',
      ctaBg: accentColor,
      ctaTextColor: '#ffffff',
    }),
    right: buildFace('right', {
      headerBg: '#1A1A1A',
      copyBg: '#ffffff',
      titleColor: '#1a1a1a',
      bodyColor: '#555555',
      ctaBg: accentColor,
      ctaTextColor: '#ffffff',
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
        <div style={{ position: 'absolute', inset: 0, background: homeBg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: homeTitleColor, fontSize: 13, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
          Ad closed
        </div>
      ) : (
        <>
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: homeBg,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
              zIndex: 1,
              padding: '20px 24px',
              gap: 0,
            }}
          >
            {logoSrc ? (
              <img src={logoSrc} alt={brandName} style={{ height: 48, maxWidth: 140, objectFit: 'contain', marginBottom: 14 }} />
            ) : brandName ? (
              <div style={{ fontSize: 20, fontWeight: 900, color: brandColor, letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 14 }}>
                {brandName}
              </div>
            ) : null}

            <h1 style={{ fontSize: 26, fontWeight: 800, color: homeTitleColor, textAlign: 'center', lineHeight: 1.1, marginBottom: 10, whiteSpace: 'pre-line' }}>
              {homeTitle}
            </h1>

            {homeSubtitle ? (
              <p style={{ fontSize: 14, color: homeSubtitleColor, textAlign: 'center', lineHeight: 1.5, marginBottom: 20 }}>
                {homeSubtitle}
              </p>
            ) : null}

            {heroSrc ? (
              <img src={heroSrc} alt="" style={{ width: '72%', maxWidth: 260, aspectRatio: '1 / 1', objectFit: 'cover', borderRadius: 16, boxShadow: `0 12px 40px ${accentColor}30`, marginBottom: 18, display: 'block' }} />
            ) : (
              <div style={{ width: '72%', maxWidth: 260, aspectRatio: '1 / 1', borderRadius: 16, background: 'rgba(0,0,0,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 18 }}>
                <span style={{ fontSize: 11, opacity: 0.4, color: homeTitleColor }}>Hero image</span>
              </div>
            )}

            <p style={{ fontSize: 12, color: homeHintColor, textAlign: 'center', marginBottom: 18, letterSpacing: '0.04em' }}>
              {homeHintText}
            </p>

            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                handleCta(homeCtaUrl);
              }}
              style={{ background: homeCtaBg, color: homeCtaTextColor, fontSize: 16, fontWeight: 700, border: 'none', borderRadius: 50, padding: '13px 40px', cursor: 'pointer', boxShadow: `0 6px 20px ${homeCtaBg}50`, letterSpacing: '0.04em', flexShrink: 0 }}
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
              style={{ position: 'absolute', top: 14, right: 14, zIndex: 999, width: 32, height: 32, borderRadius: '50%', background: closeButtonBg, border: '1.5px solid rgba(255,255,255,0.4)', color: closeButtonColor, fontSize: 14, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', pointerEvents: 'all' }}
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
