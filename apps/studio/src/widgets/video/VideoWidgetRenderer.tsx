import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import type { ActionTrigger, VideoWidgetData } from '@smx/contracts';
import { createVideoJsAdapter } from './VideoJsAdapter';
import type { IVideoPlayer } from './IVideoPlayer';
import { useVideoSync } from './useVideoSync';
import { VideoOverlayLayer } from './VideoOverlayLayer';
import { useOverlayVisibility } from './useOverlayVisibility';

import 'video.js/dist/video-js.css';

export interface VideoWidgetRendererProps {
  widget: VideoWidgetData;
  playheadMs: number;
  onTrigger: (trigger: ActionTrigger, metadata?: Record<string, unknown>) => void;
  onAnalyticsEvent?: (eventName: string, metadata?: Record<string, unknown>) => void;
  onTimeUpdate?: (currentTimeMs: number) => void;
  className?: string;
  style?: CSSProperties;
  onPlayerReady?: (player: IVideoPlayer | null) => void;
  hiddenOverlayIds?: ReadonlySet<string>;
  forcedOverlayIds?: ReadonlySet<string>;
}

export function VideoWidgetRenderer({
  widget,
  playheadMs,
  onTrigger,
  onAnalyticsEvent,
  onTimeUpdate,
  className,
  style,
  onPlayerReady,
  hiddenOverlayIds,
  forcedOverlayIds,
}: VideoWidgetRendererProps): JSX.Element {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [player, setPlayer] = useState<IVideoPlayer | null>(null);
  const [videoCurrentTimeMs, setVideoCurrentTimeMs] = useState(0);

  useEffect(() => {
    const element = videoRef.current;
    if (!element) return;

    const adapter = createVideoJsAdapter(element, {
      muted: widget.controls.startMuted,
      loop: widget.controls.loop,
      controls: widget.controls.showControls,
    });

    setPlayer(adapter);
    onPlayerReady?.(adapter);

    return () => {
      adapter.dispose();
      setPlayer(null);
      onPlayerReady?.(null);
    };
  }, [widget.controls.loop, widget.controls.showControls, widget.controls.startMuted, onPlayerReady]);

  useEffect(() => {
    if (!player) return;
    const src = widget.src ?? (widget.assetId ? `/assets/${widget.assetId}` : null);
    if (!src) return;
    player.loadSource({ src, type: widget.mimeType });
  }, [player, widget.src, widget.assetId, widget.mimeType]);

  const handleTimeUpdate = useCallback((currentTimeMs: number) => {
    setVideoCurrentTimeMs(currentTimeMs);
    onTimeUpdate?.(currentTimeMs);
  }, [onTimeUpdate]);

  useVideoSync({
    player,
    widget,
    playheadMs,
    onTimeUpdate: handleTimeUpdate,
    onPlay: () => {
      onTrigger('video-play');
      onAnalyticsEvent?.('video_play', { widgetKind: widget.kind });
    },
    onPause: () => {
      onTrigger('video-pause');
      onAnalyticsEvent?.('video_pause', { widgetKind: widget.kind });
    },
    onEnded: () => {
      onTrigger('video-ended');
      onAnalyticsEvent?.('video_ended', { widgetKind: widget.kind });
    },
    onMute: () => {
      onAnalyticsEvent?.('video_mute', { widgetKind: widget.kind });
    },
    onUnmute: () => {
      onAnalyticsEvent?.('video_unmute', { widgetKind: widget.kind });
    },
    onSeeked: () => {
      onAnalyticsEvent?.('video_seeked', { widgetKind: widget.kind });
    },
    onError: (error) => {
      onAnalyticsEvent?.('video_error', { widgetKind: widget.kind, code: error.code, message: error.message });
    },
  });

  const handleMouseEnter = useCallback(() => {
    onTrigger('hover-enter');
    onAnalyticsEvent?.('video_hover_enter', { widgetKind: widget.kind });
  }, [onAnalyticsEvent, onTrigger, widget.kind]);

  const handleMouseLeave = useCallback(() => {
    onTrigger('hover-exit');
    onAnalyticsEvent?.('video_hover_exit', { widgetKind: widget.kind });
  }, [onAnalyticsEvent, onTrigger, widget.kind]);

  const handleClick = useCallback(() => {
    if (widget.controls.clickToToggle && player) {
      if (player.isPlaying()) {
        player.pause();
      } else {
        void player.play().catch(() => undefined);
      }
    }
    onTrigger('click');
    onAnalyticsEvent?.('video_click', { widgetKind: widget.kind, clickToToggle: widget.controls.clickToToggle });
  }, [onAnalyticsEvent, widget.controls.clickToToggle, widget.kind, player, onTrigger]);

  const handleCTAClick = useCallback((url: string, overlayId: string) => {
    onTrigger('click', { overlayId, url });
    onAnalyticsEvent?.('video_cta_click', { overlayId, url, widgetKind: widget.kind });
  }, [onAnalyticsEvent, onTrigger, widget.kind]);

  const wrapperStyle: CSSProperties = {
    position: 'relative',
    display: 'block',
    width: '100%',
    aspectRatio: widget.aspectRatio ?? '16/9',
    backgroundColor: '#000',
    overflow: 'hidden',
    ...style,
  };

  return (
    <div
      className={className}
      style={wrapperStyle}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
    >
      <video
        ref={videoRef}
        className="video-js vjs-fill"
        aria-label={widget.ariaLabel ?? 'Video player'}
        playsInline
      />
      <VideoOverlayLayer
        overlays={widget.overlays}
        videoCurrentTimeMs={videoCurrentTimeMs}
        hiddenOverlayIds={hiddenOverlayIds}
        forcedOverlayIds={forcedOverlayIds}
        onCTAClick={handleCTAClick}
      />
    </div>
  );
}
