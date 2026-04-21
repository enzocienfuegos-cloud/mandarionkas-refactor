import { useEffect, useRef, useState } from 'react';
import type { WidgetNode } from '../../domain/document/types';
import type { RenderContext } from '../../canvas/stage/render-context';
import { moduleShell, renderCollapsedIfNeeded } from './shared-styles';
import { InstagramStoryInspector } from './instagram-story.inspector';

// ─── Types ────────────────────────────────────────────────────────────────────

type SlideIndex = 0 | 1 | 2;

interface SlideConfig {
  src: string;
  kind: 'image' | 'video';
  durationMs: number;
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
    <div style={{
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      zIndex: 10,
      padding: '10px 10px 6px',
      background: 'linear-gradient(to bottom, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0) 100%)',
    }}>
      {/* Progress bars */}
      <div style={{ display: 'flex', gap: 3, marginBottom: 8 }}>
        {slides.map((slide, i) => {
          const isActive = i === activeSlide;
          const isDone = i < activeSlide;
          const fill = isDone ? 1 : isActive ? Math.min(1, progressMs / slide.durationMs) : 0;
          return (
            <div key={i} style={{
              flex: 1,
              height: 2.5,
              borderRadius: 2,
              background: 'rgba(255,255,255,0.35)',
              overflow: 'hidden',
            }}>
              <div style={{
                height: '100%',
                width: `${fill * 100}%`,
                background: '#ffffff',
                borderRadius: 2,
                transition: isActive ? 'none' : undefined,
              }} />
            </div>
          );
        })}
      </div>

      {/* Account row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {/* Avatar */}
        <div style={{
          width: 32,
          height: 32,
          borderRadius: '50%',
          background: '#888',
          overflow: 'hidden',
          flexShrink: 0,
          border: '2px solid rgba(255,255,255,0.8)',
        }}>
          {avatarSrc
            ? <img src={avatarSrc} alt={username} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : <div style={{ width: '100%', height: '100%', background: 'linear-gradient(135deg,#f9a825,#e91e63)' }} />
          }
        </div>

        {/* Username */}
        <span style={{
          color: '#fff',
          fontSize: 13,
          fontWeight: 600,
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
          textShadow: '0 1px 3px rgba(0,0,0,0.4)',
          flex: 1,
        }}>
          {username || 'yourbrand'}
        </span>

        {/* Mute toggle */}
        <button
          type="button"
          onClick={onToggleMute}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: '#fff',
            padding: '2px 4px',
            fontSize: 16,
            lineHeight: 1,
            opacity: 0.9,
          }}
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
      <div style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#1a1a1a',
        color: '#555',
        fontSize: 13,
        fontFamily: 'sans-serif',
      }}>
        {slide.kind === 'video' ? '▶ Video not set' : '◻ Image not set'}
      </div>
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
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
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
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
    />
  );
}

// ─── Main renderer ────────────────────────────────────────────────────────────

function InstagramStoryRenderer({ node, ctx }: { node: WidgetNode; ctx: RenderContext }) {
  const slides = getSlides(node);
  const username = String(node.props.username ?? 'yourbrand');
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
    <div style={{
      ...moduleShell(node, ctx),
      position: 'relative',
      overflow: 'hidden',
      borderRadius,
      background: '#000',
    }}>
      {/* Slides — stacked, only active one visible */}
      {slides.map((slide, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            inset: 0,
            opacity: i === activeSlide ? 1 : 0,
            transition: 'opacity 0.25s ease',
          }}
        >
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
