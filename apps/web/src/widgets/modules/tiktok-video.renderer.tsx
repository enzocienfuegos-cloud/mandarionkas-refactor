import { useEffect, useRef, useState } from 'react';
import type { MouseEvent as ReactMouseEvent } from 'react';
import type { RenderContext } from '../../canvas/stage/render-context';
import type { WidgetNode } from '../../domain/document/types';
import { moduleShellEdit } from './shared-styles';

type Heart = {
  id: number;
  offsetX: number;
  size: number;
  color: string;
  duration: number;
  delay: number;
  rotation: number;
  rotation2: number;
};

function IconHeart(): JSX.Element {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 17.09 14.79" style={{ width: '100%', height: '100%' }}>
      <path d="M17.09,4.27c0-2.36-1.91-4.27-4.27-4.27s-4.27,1.91-4.27,4.27C8.55,1.91,6.63,0,4.27,0S0,1.91,0,4.27c0,.54.11,1.05.29,1.53h0s.03.07.04.1c0,.01.01.03.02.04,2.24,6.22,8.2,8.84,8.2,8.84,0,0,5.96-2.61,8.2-8.84,0-.01.01-.03.02-.04.01-.04.03-.07.04-.1h0c.18-.48.3-1,.3-1.53Z" fill="#fff" />
    </svg>
  );
}

function IconComment(): JSX.Element {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 17 17.26" style={{ width: '100%', height: '100%' }}>
      <path d="M8.5,0C3.81,0,0,3.22,0,7.2s3.81,7.2,8.5,7.2v2.86s4.84-2.22,7.47-6.63c.65-1.02,1.03-2.19,1.03-3.43,0-3.98-3.81-7.2-8.5-7.2Z" fill="#fff" />
      <circle cx="4.41" cy="7.03" r="1.17" />
      <circle cx="8.5" cy="7.03" r="1.17" />
      <circle cx="12.58" cy="7.03" r="1.17" />
    </svg>
  );
}

function IconShare(): JSX.Element {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 14.84 14.99" style={{ width: '100%', height: '100%' }}>
      <path d="M12.36,10.04c-.52,0-1,.16-1.39.43l-4.03-2.29c.04-.22.07-.45.07-.69s-.02-.46-.07-.68l4.03-2.29c.4.27.88.43,1.39.43,1.37,0,2.48-1.11,2.48-2.48s-1.11-2.48-2.48-2.48-2.48,1.11-2.48,2.48c0,.05.01.09.01.14l-4.05,2.3c-.62-.56-1.44-.92-2.34-.92-1.93,0-3.5,1.57-3.5,3.5s1.57,3.5,3.5,3.5c.9,0,1.72-.35,2.34-.92l4.05,2.3s-.01.09-.01.13c0,1.37,1.11,2.48,2.48,2.48s2.48-1.11,2.48-2.48-1.11-2.48-2.48-2.48Z" fill="#fff" />
    </svg>
  );
}

function IconMutedOff(): JSX.Element {
  return (
    <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" style={{ width: 15, height: 15, fill: '#fff' }}>
      <path d="M11 5L6 9H2v6h4l5 4V5z" />
      <line x1="23" y1="9" x2="17" y2="15" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
      <line x1="17" y1="9" x2="23" y2="15" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function IconMutedOn(): JSX.Element {
  return (
    <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" style={{ width: 15, height: 15, fill: '#fff' }}>
      <path d="M11 5L6 9H2v6h4l5 4V5z" />
      <path d="M19.07 4.93a10 10 0 0 1 0 14.14" stroke="#fff" strokeWidth="2" strokeLinecap="round" fill="none" />
      <path d="M15.54 8.46a5 5 0 0 1 0 7.07" stroke="#fff" strokeWidth="2" strokeLinecap="round" fill="none" />
    </svg>
  );
}

const HEARTS_KEYFRAMES = `
@keyframes smxHeartFloat {
  0%   { transform: translateY(0) rotate(var(--rot)); opacity: 0; }
  10%  { opacity: 1; }
  70%  { opacity: 0.8; }
  100% { transform: translateY(-200px) scale(var(--scale)) rotate(var(--rot2)); opacity: 0; }
}
`;

let heartStyleInjected = false;
function ensureHeartStyle(): void {
  if (heartStyleInjected || typeof document === 'undefined') return;
  const style = document.createElement('style');
  style.textContent = HEARTS_KEYFRAMES;
  document.head.appendChild(style);
  heartStyleInjected = true;
}

let heartIdCounter = 0;

function spawnBurst(count: number): Heart[] {
  return Array.from({ length: count }, (_, index) => ({
    id: heartIdCounter++,
    offsetX: (Math.random() - 0.5) * 28,
    size: 13 + Math.random() * 17,
    color: `hsl(350,${80 + Math.random() * 20}%,${35 + Math.random() * 25}%)`,
    duration: 1.2 + Math.random() * 0.9,
    delay: index * 0.12,
    rotation: (Math.random() - 0.5) * 30,
    rotation2: (Math.random() - 0.5) * 70,
  }));
}

function TikTokVideoRenderer({ node, ctx }: { node: WidgetNode; ctx: RenderContext }): JSX.Element {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isMuted, setIsMuted] = useState(true);
  const [isPaused, setIsPaused] = useState(false);
  const [progress, setProgress] = useState(0);
  const [hearts, setHearts] = useState<Heart[]>([]);

  const videoSrc = String(node.props.videoSrc ?? '');
  const avatarSrc = String(node.props.avatarSrc ?? '');
  const username = String(node.props.username ?? 'yourbrand');
  const caption = String(node.props.caption ?? 'Your ad copy goes here.');
  const hashtags = String(node.props.hashtags ?? '');
  const likesCount = String(node.props.likesCount ?? '12.4K');
  const commentsCount = String(node.props.commentsCount ?? '842');
  const sharesCount = String(node.props.sharesCount ?? '1.2K');
  const ctaLabel = String(node.props.ctaLabel ?? 'Shop Now');
  const ctaColor = String(node.props.ctaColor ?? '#fe2c55');
  const ctaTextColor = String(node.props.ctaTextColor ?? '#ffffff');
  const showHearts = Boolean(node.props.showHearts ?? true);
  const showProgressBar = Boolean(node.props.showProgressBar ?? true);
  const showMuteButton = Boolean(node.props.showMuteButton ?? true);
  const showVerified = Boolean(node.props.showVerified ?? true);

  useEffect(() => {
    if (videoRef.current) videoRef.current.muted = isMuted;
  }, [isMuted]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const onTime = () => {
      if (video.duration) setProgress((video.currentTime / video.duration) * 100);
    };
    video.addEventListener('timeupdate', onTime);
    return () => video.removeEventListener('timeupdate', onTime);
  }, []);

  useEffect(() => {
    if (!showHearts || !ctx.previewMode) return;
    ensureHeartStyle();

    function burst(): void {
      const batch = spawnBurst(6);
      setHearts((previous) => [...previous, ...batch]);
      const ids = batch.map((heart) => heart.id);
      window.setTimeout(() => setHearts((previous) => previous.filter((heart) => !ids.includes(heart.id))), 3500);
    }

    burst();
    const interval = window.setInterval(burst, 3000);
    return () => window.clearInterval(interval);
  }, [showHearts, ctx.previewMode]);

  function handlePointerDown(): void {
    if (!ctx.previewMode || !videoRef.current) return;
    videoRef.current.pause();
    setIsPaused(true);
  }

  function handlePointerUp(): void {
    if (!ctx.previewMode || !videoRef.current) return;
    void videoRef.current.play().catch(() => undefined);
    setIsPaused(false);
  }

  function handleMuteToggle(event: ReactMouseEvent): void {
    event.stopPropagation();
    setIsMuted((value) => !value);
  }

  function triggerCta(): void {
    ctx.triggerWidgetAction('click');
  }

  function handleCta(event: ReactMouseEvent): void {
    event.stopPropagation();
    triggerCta();
  }

  const hasVideo = videoSrc && !videoSrc.startsWith('__');
  const shellStyle = ctx.previewMode
    ? {
        width: '100%',
        height: '100%',
        position: 'relative' as const,
        background: '#000',
        overflow: 'hidden',
        userSelect: 'none' as const,
        cursor: 'pointer',
      }
    : {
        ...moduleShellEdit(node),
        background: '#111',
        position: 'relative' as const,
        overflow: 'hidden',
      };

  const heartOriginX = (node.frame?.width ?? 300) - 22;
  const heartOriginY = (node.frame?.height ?? 600) - 90;

  return (
    <div style={shellStyle} onPointerDown={handlePointerDown} onPointerUp={handlePointerUp} onPointerLeave={handlePointerUp}>
      {hasVideo ? (
        <video
          ref={videoRef}
          src={videoSrc}
          autoPlay={ctx.previewMode}
          muted
          loop
          playsInline
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', zIndex: 0, pointerEvents: 'none' }}
        />
      ) : (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(180deg,#1a1a2e 0%,#16213e 50%,#0f3460 100%)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            zIndex: 0,
          }}
        >
          <span style={{ fontSize: 32, opacity: 0.35 }}>🎬</span>
          <span
            style={{
              fontSize: 10,
              color: 'rgba(255,255,255,0.35)',
              letterSpacing: '1.5px',
              textTransform: 'uppercase',
              textAlign: 'center',
              lineHeight: 1.7,
            }}
          >
            Add a video
            <br />
            in the inspector
            <br />
            <br />
            MP4 · 9:16
          </span>
        </div>
      )}

      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 140, background: 'linear-gradient(to bottom,rgba(0,0,0,0.5) 0%,transparent 100%)', zIndex: 1, pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 260, background: 'linear-gradient(to top,rgba(0,0,0,0.75) 0%,transparent 100%)', zIndex: 1, pointerEvents: 'none' }} />

      {showHearts ? (
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 12, overflow: 'hidden' }}>
          {hearts.map((heart) => (
            <div
              key={heart.id}
              style={{
                position: 'absolute',
                left: heartOriginX + heart.offsetX - heart.size / 2,
                top: heartOriginY - heart.size / 2,
                width: heart.size,
                height: heart.size * 0.865,
                opacity: 0,
                '--rot': `${heart.rotation}deg`,
                '--rot2': `${heart.rotation2}deg`,
                '--scale': 0.6 + Math.random() * 0.8,
                animation: `smxHeartFloat ${heart.duration}s ${heart.delay}s linear forwards`,
              } as React.CSSProperties}
            >
              <svg viewBox="0 0 17.09 14.79" width={heart.size} height={heart.size * 0.865} xmlns="http://www.w3.org/2000/svg">
                <path d="M17.09,4.27c0-2.36-1.91-4.27-4.27-4.27s-4.27,1.91-4.27,4.27C8.55,1.91,6.63,0,4.27,0S0,1.91,0,4.27c0,.54.11,1.05.29,1.53h0s.03.07.04.1c0,.01.01.03.02.04,2.24,6.22,8.2,8.84,8.2,8.84,0,0,5.96-2.61,8.2-8.84,0-.01.01-.03.02-.04.01-.04.03-.07.04-.1h0c.18-.48.3-1,.3-1.53Z" fill={heart.color} />
              </svg>
            </div>
          ))}
        </div>
      ) : null}

      {showMuteButton ? (
        <div
          onClick={handleMuteToggle}
          style={{
            position: 'absolute',
            top: 40,
            right: 14,
            width: 30,
            height: 30,
            borderRadius: '50%',
            background: 'rgba(0,0,0,0.5)',
            border: '1.5px solid rgba(255,255,255,0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            zIndex: 20,
          }}
        >
          {isMuted ? <IconMutedOff /> : <IconMutedOn />}
        </div>
      ) : null}

      <div style={{ position: 'absolute', right: 10, bottom: 90, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18, zIndex: 10 }}>
        <div style={{ marginBottom: 14 }}>
          <div style={{ width: 46, height: 46, borderRadius: '50%', padding: 2.5, background: 'linear-gradient(135deg,#fe2c55 0%,#25f4ee 100%)', position: 'relative', flexShrink: 0 }}>
            <div style={{ width: '100%', height: '100%', borderRadius: '50%', overflow: 'hidden', background: '#000' }}>
              {avatarSrc ? (
                <img src={avatarSrc} alt={username} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', borderRadius: '50%' }} />
              ) : (
                <div style={{ width: '100%', height: '100%', background: '#333', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, color: '#888' }}>?</div>
              )}
            </div>
            <div style={{ position: 'absolute', bottom: -8, left: '50%', transform: 'translateX(-50%)', width: 20, height: 20, borderRadius: '50%', background: '#fe2c55', color: '#fff', fontSize: 16, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1, border: '2px solid #000', zIndex: 1 }}>+</div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
          <div style={{ width: 25, height: 25, filter: 'drop-shadow(0 1px 4px rgba(0,0,0,0.5))' }}><IconComment /></div>
          <span style={{ fontSize: 10, color: '#fff', fontWeight: 600, textShadow: '0 1px 3px rgba(0,0,0,0.5)', letterSpacing: '0.2px' }}>{commentsCount}</span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
          <div style={{ width: 25, height: 25, filter: 'drop-shadow(0 1px 4px rgba(0,0,0,0.5))' }}><IconShare /></div>
          <span style={{ fontSize: 10, color: '#fff', fontWeight: 600, textShadow: '0 1px 3px rgba(0,0,0,0.5)', letterSpacing: '0.2px' }}>{sharesCount}</span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
          <div style={{ width: 25, height: 25, filter: 'drop-shadow(0 1px 4px rgba(0,0,0,0.5))' }}><IconHeart /></div>
          <span style={{ fontSize: 10, color: '#fff', fontWeight: 600, textShadow: '0 1px 3px rgba(0,0,0,0.5)', letterSpacing: '0.2px' }}>{likesCount}</span>
        </div>

        <div style={{ width: 36, height: 36, borderRadius: '50%', border: '3px solid rgba(255,255,255,0.8)', background: '#222', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, animation: ctx.previewMode ? 'smxDiscSpin 4s linear infinite' : 'none' }}>
          🎵
        </div>
      </div>

      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 60, padding: '0 14px 16px', zIndex: 10 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', marginBottom: 5, textShadow: '0 1px 4px rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', gap: 5 }}>
          @{username}
          {showVerified ? (
            <span style={{ width: 14, height: 14, background: '#20d5ec', borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, color: '#000', fontWeight: 900, flexShrink: 0 }}>✓</span>
          ) : null}
        </div>

        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.9)', lineHeight: 1.45, marginBottom: 8, textShadow: '0 1px 4px rgba(0,0,0,0.4)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
          {caption}
        </div>

        {hashtags ? (
          <div style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.75)', marginBottom: 10, textShadow: '0 1px 3px rgba(0,0,0,0.4)' }}>
            {hashtags}
          </div>
        ) : null}

        <div
          role="button"
          tabIndex={0}
          onClick={handleCta}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              triggerCta();
            }
          }}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 38, borderRadius: 4, background: ctaColor, color: ctaTextColor, fontSize: 13, fontWeight: 800, letterSpacing: '0.03em', cursor: 'pointer', boxShadow: `0 2px 12px ${ctaColor}80`, userSelect: 'none' }}
        >
          {ctaLabel}
        </div>
      </div>

      {showProgressBar ? (
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 2, background: 'rgba(255,255,255,0.2)', zIndex: 15 }}>
          <div style={{ height: '100%', background: '#fff', width: `${progress}%`, transition: 'width 0.1s linear' }} />
        </div>
      ) : null}

      {isPaused ? (
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 15, fontSize: 48, color: '#fff', pointerEvents: 'none' }}>
          ▶
        </div>
      ) : null}

      <style>{'@keyframes smxDiscSpin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }'}</style>
    </div>
  );
}

export function renderTikTokVideoStage(node: WidgetNode, ctx: RenderContext): JSX.Element {
  return <TikTokVideoRenderer node={node} ctx={ctx} />;
}
