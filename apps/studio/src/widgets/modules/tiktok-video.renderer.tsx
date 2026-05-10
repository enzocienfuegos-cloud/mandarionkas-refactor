// render-tokenized: brand/theme split enforced by lint-color-literals.mjs
import { useEffect, useRef, useState } from 'react';
import type { MouseEvent as ReactMouseEvent } from 'react';
import type { RenderContext } from '../../canvas/stage/render-context';
import type { WidgetNode } from '../../domain/document/types';
import { PlayOverlayIcon, VerifiedBadgeIcon } from './render-icons';
import {
  buildTikTokCtaStyle,
  buildTikTokDiscStyle,
  buildTikTokProgressFillStyle,
  buildTikTokShellStyle,
  tiktokVideoUi,
} from './tiktok-video.style-recipe';
import { buildTikTokVideoViewModel } from './tiktok-video.view-model';
import { createModuleViewModel } from './view-model';

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
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 17.09 14.79" style={tiktokVideoUi.tiktokIconShellStyle}>
      <path d="M17.09,4.27c0-2.36-1.91-4.27-4.27-4.27s-4.27,1.91-4.27,4.27C8.55,1.91,6.63,0,4.27,0S0,1.91,0,4.27c0,.54.11,1.05.29,1.53h0s.03.07.04.1c0,.01.01.03.02.04,2.24,6.22,8.2,8.84,8.2,8.84,0,0,5.96-2.61,8.2-8.84,0-.01.01-.03.02-.04.01-.04.03-.07.04-.1h0c.18-.48.3-1,.3-1.53Z" fill="var(--text-on-media-strong)" />
      <path d="M17.09,4.27c0-2.36-1.91-4.27-4.27-4.27s-4.27,1.91-4.27,4.27C8.55,1.91,6.63,0,4.27,0S0,1.91,0,4.27c0,.54.11,1.05.29,1.53h0s.03.07.04.1c0,.01.01.03.02.04,2.24,6.22,8.2,8.84,8.2,8.84,0,0,5.96-2.61,8.2-8.84,0-.01.01-.03.02-.04.01-.04.03-.07.04-.1h0c.18-.48.3-1,.3-1.53Z" fill="var(--text-on-media-strong)" />
    </svg>
  );
}

function IconComment(): JSX.Element {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 17 17.26" style={tiktokVideoUi.tiktokIconShellStyle}>
      <path d="M8.5,0C3.81,0,0,3.22,0,7.2s3.81,7.2,8.5,7.2v2.86s4.84-2.22,7.47-6.63c.65-1.02,1.03-2.19,1.03-3.43,0-3.98-3.81-7.2-8.5-7.2Z" fill="var(--text-on-media-strong)" />
      <circle cx="4.41" cy="7.03" r="1.17" />
      <circle cx="8.5" cy="7.03" r="1.17" />
      <circle cx="12.58" cy="7.03" r="1.17" />
    </svg>
  );
}

function IconShare(): JSX.Element {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 14.84 14.99" style={tiktokVideoUi.tiktokIconShellStyle}>
      <path d="M12.36,10.04c-.52,0-1,.16-1.39.43l-4.03-2.29c.04-.22.07-.45.07-.69s-.02-.46-.07-.68l4.03-2.29c.4.27.88.43,1.39.43,1.37,0,2.48-1.11,2.48-2.48s-1.11-2.48-2.48-2.48-2.48,1.11-2.48,2.48c0,.05.01.09.01.14l-4.05,2.3c-.62-.56-1.44-.92-2.34-.92-1.93,0-3.5,1.57-3.5,3.5s1.57,3.5,3.5,3.5c.9,0,1.72-.35,2.34-.92l4.05,2.3s-.01.09-.01.13c0,1.37,1.11,2.48,2.48,2.48s2.48-1.11,2.48-2.48-1.11-2.48-2.48-2.48Z" fill="var(--text-on-media-strong)" />
    </svg>
  );
}

function IconMutedOff(): JSX.Element {
  return (
    <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" style={tiktokVideoUi.tiktokMuteIconStyle}>
      <path d="M11 5L6 9H2v6h4l5 4V5z" />
      <line x1="23" y1="9" x2="17" y2="15" stroke="var(--text-on-media-strong)" strokeWidth="2" strokeLinecap="round" />
      <line x1="17" y1="9" x2="23" y2="15" stroke="var(--text-on-media-strong)" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function IconMutedOn(): JSX.Element {
  return (
    <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" style={tiktokVideoUi.tiktokMuteIconStyle}>
      <path d="M11 5L6 9H2v6h4l5 4V5z" />
      <path d="M19.07 4.93a10 10 0 0 1 0 14.14" stroke="var(--text-on-media-strong)" strokeWidth="2" strokeLinecap="round" fill="none" />
      <path d="M15.54 8.46a5 5 0 0 1 0 7.07" stroke="var(--text-on-media-strong)" strokeWidth="2" strokeLinecap="round" fill="none" />
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

function buildTikTokHeartStyle(heart: Heart, heartOriginX: number, heartOriginY: number): React.CSSProperties {
  return {
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
  } as React.CSSProperties;
}

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
  const viewModel = buildTikTokVideoViewModel(node);
  const skinVm = createModuleViewModel({
    type: node.type,
    props: {},
    style: node.style as Record<string, unknown>,
    surface: 'stage',
  }, () => ({}));

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
    if (!viewModel.showHearts || !ctx.previewMode) return;
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
  }, [ctx.previewMode, viewModel.showHearts]);

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

  const heartOriginX = (node.frame?.width ?? 300) - 22;
  const heartOriginY = (node.frame?.height ?? 600) - 90;

  return (
    <div style={buildTikTokShellStyle(node, ctx, skinVm.cssVars)} onPointerDown={handlePointerDown} onPointerUp={handlePointerUp} onPointerLeave={handlePointerUp}>
      {viewModel.hasVideo ? (
        <video
          ref={videoRef}
          src={viewModel.videoSrc}
          autoPlay={ctx.previewMode}
          muted
          loop
          playsInline
          style={tiktokVideoUi.tiktokVideoFillStyle}
        />
      ) : (
        <div style={tiktokVideoUi.tiktokEmptyStateStyle}>
          <span style={tiktokVideoUi.tiktokEmptyEmojiStyle}>🎬</span>
          <span style={tiktokVideoUi.tiktokEmptyCopyStyle}>
            Add a video
            <br />
            in the inspector
            <br />
            <br />
            MP4 · 9:16
          </span>
        </div>
      )}

      <div style={tiktokVideoUi.tiktokTopGradientStyle} />
      <div style={tiktokVideoUi.tiktokBottomGradientStyle} />

      {viewModel.showHearts ? (
        <div style={tiktokVideoUi.tiktokHeartLayerStyle}>
          {hearts.map((heart) => (
            <div key={heart.id} style={buildTikTokHeartStyle(heart, heartOriginX, heartOriginY)}>
              <svg viewBox="0 0 17.09 14.79" width={heart.size} height={heart.size * 0.865} xmlns="http://www.w3.org/2000/svg">
                <path d="M17.09,4.27c0-2.36-1.91-4.27-4.27-4.27s-4.27,1.91-4.27,4.27C8.55,1.91,6.63,0,4.27,0S0,1.91,0,4.27c0,.54.11,1.05.29,1.53h0s.03.07.04.1c0,.01.01.03.02.04,2.24,6.22,8.2,8.84,8.2,8.84,0,0,5.96-2.61,8.2-8.84,0-.01.01-.03.02-.04.01-.04.03-.07.04-.1h0c.18-.48.3-1,.3-1.53Z" fill={heart.color} />
              </svg>
            </div>
          ))}
        </div>
      ) : null}

      {viewModel.showMuteButton ? (
        <div onClick={handleMuteToggle} style={tiktokVideoUi.tiktokMuteButtonStyle}>
          {isMuted ? <IconMutedOff /> : <IconMutedOn />}
        </div>
      ) : null}

      <div style={tiktokVideoUi.tiktokSidebarStyle}>
        <div style={tiktokVideoUi.tiktokAvatarWrapStyle}>
          <div style={tiktokVideoUi.tiktokAvatarRingStyle}>
            <div style={tiktokVideoUi.tiktokAvatarInnerStyle}>
              {viewModel.avatarSrc ? (
                <img src={viewModel.avatarSrc} alt={viewModel.username} style={tiktokVideoUi.tiktokAvatarImageStyle} />
              ) : (
                <div style={tiktokVideoUi.tiktokAvatarFallbackStyle}>?</div>
              )}
            </div>
            <div style={tiktokVideoUi.tiktokAvatarPlusStyle}>+</div>
          </div>
        </div>

        <div style={tiktokVideoUi.tiktokSidebarActionStyle}>
          <div style={tiktokVideoUi.tiktokSidebarIconStyle}><IconComment /></div>
          <span style={tiktokVideoUi.tiktokSidebarCountStyle}>{viewModel.commentsCount}</span>
        </div>

        <div style={tiktokVideoUi.tiktokSidebarActionStyle}>
          <div style={tiktokVideoUi.tiktokSidebarIconStyle}><IconShare /></div>
          <span style={tiktokVideoUi.tiktokSidebarCountStyle}>{viewModel.sharesCount}</span>
        </div>

        <div style={tiktokVideoUi.tiktokSidebarActionStyle}>
          <div style={tiktokVideoUi.tiktokSidebarIconStyle}><IconHeart /></div>
          <span style={tiktokVideoUi.tiktokSidebarCountStyle}>{viewModel.likesCount}</span>
        </div>

        <div style={buildTikTokDiscStyle(ctx.previewMode)}>
          🎵
        </div>
      </div>

      <div style={tiktokVideoUi.tiktokBottomContentStyle}>
        <div style={tiktokVideoUi.tiktokUsernameStyle}>
          @{viewModel.username}
          {viewModel.showVerified ? <VerifiedBadgeIcon /> : null}
        </div>

        <div style={tiktokVideoUi.tiktokCaptionStyle}>
          {viewModel.caption}
        </div>

        {viewModel.hashtags ? (
          <div style={tiktokVideoUi.tiktokHashtagsStyle}>
            {viewModel.hashtags}
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
          style={buildTikTokCtaStyle(viewModel.ctaColor, viewModel.ctaTextColor)}
        >
          {viewModel.ctaLabel}
        </div>
      </div>

      {viewModel.showProgressBar ? (
        <div style={tiktokVideoUi.tiktokProgressTrackStyle}>
          <div style={buildTikTokProgressFillStyle(progress)} />
        </div>
      ) : null}

      {isPaused ? (
        <div style={tiktokVideoUi.tiktokPausedOverlayStyle}>
          <PlayOverlayIcon />
        </div>
      ) : null}

      <style>{'@keyframes smxDiscSpin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }'}</style>
    </div>
  );
}

export function renderTikTokVideoStage(node: WidgetNode, ctx: RenderContext): JSX.Element {
  return <TikTokVideoRenderer node={node} ctx={ctx} />;
}
