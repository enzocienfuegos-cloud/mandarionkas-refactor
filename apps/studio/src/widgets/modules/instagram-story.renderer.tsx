// render-tokenized: brand/theme split enforced by lint-color-literals.mjs
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import type { WidgetNode } from '../../domain/document/types';
import type { RenderContext } from '../../canvas/stage/render-context';
import { usePlaybackDerivedValue } from '../../hooks/use-playback-engine';
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

const instagramBrandPalette = {
  avatarFallbackGradient: 'linear-gradient(135deg,#f9a825,#e91e63)',
} as const;

const storyTopBarStyle: CSSProperties = {
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  zIndex: 10,
  padding: '10px 10px 6px',
  background: 'var(--scrim-top-strong)',
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
  background: 'var(--white-a-35)',
  overflow: 'hidden',
};

const storyProgressFillBaseStyle: CSSProperties = {
  width: '100%',
  height: '100%',
  background: 'var(--text-on-media-strong)',
  borderRadius: 2,
  transformOrigin: '0 50%',
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
  background: 'var(--neutral-gray-500)',
  overflow: 'hidden',
  flexShrink: 0,
  border: '2px solid var(--white-a-85)',
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
  background: instagramBrandPalette.avatarFallbackGradient,
};

const storyUsernameStyle: CSSProperties = {
  color: 'var(--text-on-media-strong)',
  fontSize: 13,
  fontWeight: 600,
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  textShadow: 'var(--shadow-text-on-media)',
  flex: 1,
};

const storyMuteButtonStyle: CSSProperties = {
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  color: 'var(--text-on-media-strong)',
  padding: '2px 4px',
  fontSize: 16,
  lineHeight: 1,
  opacity: 0.9,
};

const instagramStoryShellBaseStyle: CSSProperties = {
  position: 'relative',
  overflow: 'hidden',
  background: 'var(--neutral-black)',
};

const instagramStorySlideLayerBaseStyle: CSSProperties = {
  position: 'absolute',
  inset: 0,
  transition: 'opacity 0.25s ease',
};

function buildStoryProgressFillStyle(fill: number, isActive: boolean): CSSProperties {
  return {
    ...storyProgressFillBaseStyle,
    transform: `scaleX(${fill})`,
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
            ? <img src={avatarSrc} alt={username} decoding="async" style={storyMediaFillStyle} />
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
      <ModuleMediaPlaceholder
        kind={slide.kind}
        background="var(--neutral-black-soft)"
        color="var(--neutral-gray-500)"
      />
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
        preload="metadata"
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
      decoding="async"
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
  const sampledPlayheadMs = usePlaybackDerivedValue(ctx.playheadMs, (nextMs) => {
    if (!ctx.isReproducing) return ctx.playheadMs;
    return Math.floor(Math.max(0, nextMs) / 33) * 33;
  });
  const playheadMs = ctx.isReproducing ? sampledPlayheadMs : ctx.playheadMs;

  const [muted, setMuted] = useState(Boolean(node.props.muted ?? true));
  const [videoDurations, setVideoDurations] = useState<Record<number, number>>({});

  // Effective durations — video overrides durationMs when loaded
  const effectiveDurations = slides.map((s, i) =>
    s.kind === 'video' && videoDurations[i] ? videoDurations[i] : s.durationMs,
  );
  const totalDurationMs = effectiveDurations.reduce((sum, value) => sum + value, 0);
  const normalizedPlayheadMs = totalDurationMs > 0
    ? (ctx.previewMode ? playheadMs % totalDurationMs : Math.min(playheadMs, totalDurationMs))
    : 0;
  let remainingPlayheadMs = normalizedPlayheadMs;
  let activeSlide: SlideIndex = 0;
  let progressMs = 0;

  for (let index = 0; index < effectiveDurations.length; index += 1) {
    const durationMs = effectiveDurations[index] ?? 5000;
    if (remainingPlayheadMs < durationMs || index === effectiveDurations.length - 1) {
      activeSlide = index as SlideIndex;
      progressMs = Math.min(durationMs, remainingPlayheadMs);
      break;
    }
    remainingPlayheadMs -= durationMs;
  }

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
