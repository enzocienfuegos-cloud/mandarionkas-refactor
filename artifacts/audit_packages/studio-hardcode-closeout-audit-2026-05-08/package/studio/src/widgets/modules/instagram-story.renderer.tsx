import { useEffect, useRef, useState, type CSSProperties } from 'react';
import type { WidgetNode } from '../../domain/document/types';
import type { RenderContext } from '../../canvas/stage/render-context';
import { moduleShell, renderCollapsedIfNeeded } from './shared-styles';
import { InstagramStoryInspector } from './instagram-story.inspector';
import { ModuleMediaPlaceholder } from './render-icons';
import { INSTAGRAM_STORY_DEFAULT_USERNAME } from './instagram-story.shared';

// ─── Types ────────────────────────────────────────────────────────────────────

type SlideIndex = 0 | 1 | 2;

interface SlideConfig {
  src: string;
  kind: 'image' | 'video';
  durationMs: number;
}

const storyTopBarStyle: CSSProperties = {
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  zIndex: 10,
  padding: '10px 10px 6px',
  background: 'linear-gradient(to bottom, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0) 100%)',
};

const storyProgressRowStyle: CSSProperties = {
  display: 'flex',
  gap: 3,
  marginBottom: 8,
};

const storyProgressTrackStyle: CSSProperties = {
  flex: 1,
  height: 2.5,
  borderRadius: 2,
  background: 'rgba(255,255,255,0.35)',
  overflow: 'hidden',
};

const storyProgressFillBaseStyle: CSSProperties = {
  height: '100%',
  background: '#ffffff',
  borderRadius: 2,
};

const storyAccountRowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
};

const storyAvatarShellStyle: CSSProperties = {
  width: 32,
  height: 32,
  borderRadius: '50%',
  background: '#888',
  overflow: 'hidden',
  flexShrink: 0,
  border: '2px solid rgba(255,255,255,0.8)',
};

const storyMediaFillStyle: CSSProperties = {
  position: 'absolute',
  inset: 0,
  width: '100%',
  height: '100%',
  objectFit: 'cover',
};

const storyAvatarFallbackStyle: CSSProperties = {
  width: '100%',
  height: '100%',
  background: 'linear-gradient(135deg,#f9a825,#e91e63)',
};

const storyUsernameStyle: CSSProperties = {
  color: '#fff',
  fontSize: 13,
  fontWeight: 600,
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  textShadow: '0 1px 3px rgba(0,0,0,0.4)',
  flex: 1,
};

const storyMuteButtonStyle: CSSProperties = {
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  color: '#fff',
  padding: '2px 4px',
  fontSize: 16,
  lineHeight: 1,
  opacity: 0.9,
};

const instagramStoryShellBaseStyle: CSSProperties = {
  position: 'relative',
  overflow: 'hidden',
  background: '#000',
};

const instagramStorySlideLayerBaseStyle: CSSProperties = {
  position: 'absolute',
  inset: 0,
  transition: 'opacity 0.25s ease',
};

function buildStoryProgressFillStyle(fill: number, isActive: boolean): CSSProperties {
  return {
    ...storyProgressFillBaseStyle,
    width: `${fill * 100}%`,
    transition: isActive ? 'none' : undefined,
  };
}

function buildInstagramStoryShellStyle(node: WidgetNode, ctx: RenderContext, borderRadius: number): CSSProperties {
  return {
    ...moduleShell(node, ctx),
    ...instagramStoryShellBaseStyle,
    borderRadius,
  };
}

function buildInstagramStorySlideLayerStyle(isActive: boolean): CSSProperties {
  return {
    ...instagramStorySlideLayerBaseStyle,
    opacity: isActive ? 1 : 0,
  };
}

function getSlides(node: WidgetNode): SlideConfig[] {
  return [1, 2, 3].map((n) => ({
    src: String(node.props[`slide${n}Src`] ?? '').trim(),
    kind: (String(node.props[`slide${n}Kind`] ?? 'image') === 'video' ? 'video' : 'image') as 'image' | 'video',
    durationMs: Math.max(1000, Number(node.props[`slide${n}DurationMs`] ?? 5000)),
  }));
}

// ─── Instagram-style top bar ──────────────────────────────────────────────────

function StoryTopBar({
  username,
  avatarSrc,
  slides,
  activeSlide,
  progressMs,
  muted,
  onToggleMute,
}: {
  username: string;
  avatarSrc: string;
  slides: SlideConfig[];
  activeSlide: SlideIndex;
  progressMs: number;
  muted: boolean;
  onToggleMute: () => void;
}) {
  return (
    <div style={storyTopBarStyle}>
      {/* Progress bars */}
      <div style={storyProgressRowStyle}>
        {slides.map((slide, i) => {
          const isActive = i === activeSlide;
          const isDone = i < activeSlide;
          const fill = isDone ? 1 : isActive ? Math.min(1, progressMs / slide.durationMs) : 0;
          return (
            <div key={i} style={storyProgressTrackStyle}>
              <div style={buildStoryProgressFillStyle(fill, isActive)} />
            </div>
          );
        })}
      </div>

      {/* Account row */}
      <div style={storyAccountRowStyle}>
        {/* Avatar */}
        <div style={storyAvatarShellStyle}>
          {avatarSrc
            ? <img src={avatarSrc} alt={username} style={storyMediaFillStyle} />
            : <div style={storyAvatarFallbackStyle} />
          }
        </div>

        {/* Username */}
        <span style={storyUsernameStyle}>{username || INSTAGRAM_STORY_DEFAULT_USERNAME}</span>

        {/* Mute toggle */}
        <button
          type="button"
          onClick={onToggleMute}
          aria-label={muted ? 'Unmute story' : 'Mute story'}
          style={storyMuteButtonStyle}
        >
          {muted ? '🔇' : '🔊'}
        </button>
      </div>
    </div>
  );
}

// ─── Single slide ─────────────────────────────────────────────────────────────

function StorySlide({
  slide,
  isActive,
  muted,
  onVideoDuration,
}: {
  slide: SlideConfig;
  isActive: boolean;
  muted: boolean;
  onVideoDuration: (ms: number) => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (isActive) {
      video.currentTime = 0;
      void video.play().catch(() => null);
    } else {
      video.pause();
      video.currentTime = 0;
    }
  }, [isActive]);

  if (!slide.src) {
    return (
      <ModuleMediaPlaceholder kind={slide.kind} background="#1a1a1a" color="#555555" />
    );
  }

  if (slide.kind === 'video') {
    return (
      <video
        ref={videoRef}
        src={slide.src}
        muted={muted}
        playsInline
        loop={false}
        style={storyMediaFillStyle}
        onLoadedMetadata={(e) => {
          const duration = (e.currentTarget.duration ?? 0) * 1000;
          if (duration > 0) onVideoDuration(duration);
        }}
      />
    );
  }

  return (
    <img
      src={slide.src}
      alt=""
      draggable={false}
      style={storyMediaFillStyle}
    />
  );
}

// ─── Main renderer ────────────────────────────────────────────────────────────

function InstagramStoryRenderer({ node, ctx }: { node: WidgetNode; ctx: RenderContext }) {
  const slides = getSlides(node);
  const username = String(node.props.username ?? INSTAGRAM_STORY_DEFAULT_USERNAME);
  const avatarSrc = String(node.props.avatarSrc ?? '').trim();

  const [activeSlide, setActiveSlide] = useState<SlideIndex>(0);
  const [progressMs, setProgressMs] = useState(0);
  const [muted, setMuted] = useState(Boolean(node.props.muted ?? true));
  const [videoDurations, setVideoDurations] = useState<Record<number, number>>({});

  // Effective durations — video overrides durationMs when loaded
  const effectiveDurations = slides.map((s, i) =>
    s.kind === 'video' && videoDurations[i] ? videoDurations[i] : s.durationMs,
  );

  const rafRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);

  useEffect(() => {
    if (ctx.previewMode) {
      // Animate continuously in preview mode
      lastTimeRef.current = performance.now();

      function tick(now: number) {
        const delta = now - lastTimeRef.current;
        lastTimeRef.current = now;
        setProgressMs((prev) => {
          const next = prev + delta;
          const slideDuration = effectiveDurations[activeSlide] ?? 5000;
          if (next >= slideDuration) {
            const nextSlide = ((activeSlide + 1) % 3) as SlideIndex;
            setActiveSlide(nextSlide);
            return 0;
          }
          return next;
        });
        rafRef.current = requestAnimationFrame(tick);
      }

      rafRef.current = requestAnimationFrame(tick);
      return () => cancelAnimationFrame(rafRef.current);
    } else {
      // Edit mode: derive active slide + progress from studio playhead
      const playheadMs = ctx.playheadMs;
      let elapsed = playheadMs;
      let idx = 0;
      for (let i = 0; i < 3; i++) {
        const dur = effectiveDurations[i] ?? 5000;
        if (elapsed < dur) { idx = i; break; }
        elapsed -= dur;
        if (i === 2) { idx = 2; elapsed = dur; } // clamp at last
      }
      setActiveSlide(idx as SlideIndex);
      setProgressMs(elapsed);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctx.previewMode, ctx.playheadMs, activeSlide]);

  const borderRadius = 12;

  return (
    <div style={buildInstagramStoryShellStyle(node, ctx, borderRadius)}>
      {/* Slides — stacked, only active one visible */}
      {slides.map((slide, i) => (
        <div key={i} style={buildInstagramStorySlideLayerStyle(i === activeSlide)}>
          <StorySlide
            slide={slide}
            isActive={i === activeSlide}
            muted={muted}
            onVideoDuration={(ms) => setVideoDurations((prev) => ({ ...prev, [i]: ms }))}
          />
        </div>
      ))}

      {/* Top bar overlay */}
      <StoryTopBar
        username={username}
        avatarSrc={avatarSrc}
        slides={slides}
        activeSlide={activeSlide}
        progressMs={progressMs}
        muted={muted}
        onToggleMute={() => setMuted((m) => !m)}
      />
    </div>
  );
}

export function renderInstagramStoryStage(node: WidgetNode, ctx: RenderContext): JSX.Element {
  const collapsed = renderCollapsedIfNeeded(node, ctx);
  if (collapsed) return collapsed;
  return <InstagramStoryRenderer node={node} ctx={ctx} />;
}

export function renderInstagramStoryInspector(node: WidgetNode): JSX.Element {
  return <InstagramStoryInspector node={node} />;
}
