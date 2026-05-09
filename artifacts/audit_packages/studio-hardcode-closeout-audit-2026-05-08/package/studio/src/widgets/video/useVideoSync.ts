import { useEffect, useRef } from 'react';
import type { VideoWidgetData } from '@smx/contracts';
import type { IVideoPlayer } from './IVideoPlayer';

export interface UseVideoSyncOptions {
  player: IVideoPlayer | null;
  widget: VideoWidgetData;
  playheadMs: number;
  onTimeUpdate?: (currentTimeMs: number) => void;
  onEnded?: () => void;
  onPlay?: () => void;
  onPause?: () => void;
  onMute?: () => void;
  onUnmute?: () => void;
  onError?: (error: { code: number; message: string }) => void;
  onSeeked?: () => void;
}

const SYNC_TOLERANCE_MS = 50;

export function useVideoSync({
  player,
  widget,
  playheadMs,
  onTimeUpdate,
  onEnded,
  onPlay,
  onPause,
  onMute,
  onUnmute,
  onError,
  onSeeked,
}: UseVideoSyncOptions): void {
  const isInternalSeek = useRef(false);
  const lastMuted = useRef<boolean | null>(null);

  useEffect(() => {
    if (!player) return;

    const handleTimeUpdate = (currentTimeSeconds: number): void => {
      if (!isInternalSeek.current) {
        onTimeUpdate?.(currentTimeSeconds * 1000);
      }
    };

    const handleEnded = (): void => { onEnded?.(); };
    const handlePlay = (): void => { onPlay?.(); };
    const handlePause = (): void => { onPause?.(); };
    const handleSeeked = (): void => { onSeeked?.(); };
    const handleError = (error: { code: number; message: string }): void => { onError?.(error); };
    const handleVolumeChange = (): void => {
      const muted = player.isMuted();
      if (lastMuted.current === null) {
        lastMuted.current = muted;
        return;
      }
      if (muted !== lastMuted.current) {
        lastMuted.current = muted;
        if (muted) onMute?.();
        else onUnmute?.();
      }
    };

    lastMuted.current = player.isMuted();

    player.on('timeupdate', handleTimeUpdate);
    player.on('ended', handleEnded);
    player.on('play', handlePlay);
    player.on('pause', handlePause);
    player.on('seeked', handleSeeked);
    player.on('error', handleError);
    player.on('volumechange', handleVolumeChange);

    return () => {
      player.off('timeupdate', handleTimeUpdate);
      player.off('ended', handleEnded);
      player.off('play', handlePlay);
      player.off('pause', handlePause);
      player.off('seeked', handleSeeked);
      player.off('error', handleError);
      player.off('volumechange', handleVolumeChange);
    };
  }, [player, onTimeUpdate, onEnded, onPlay, onPause, onMute, onUnmute, onError, onSeeked]);

  useEffect(() => {
    if (!player) return;

    const { startMs, endMs } = widget.timeline;
    if (playheadMs < startMs) {
      if (player.isPlaying()) player.pause();
      return;
    }

    if (endMs !== undefined && playheadMs >= endMs) {
      if (player.isPlaying()) player.pause();
      return;
    }

    const targetVideoMs = playheadMs - startMs;
    const currentVideoMs = player.getCurrentTime() * 1000;
    const drift = Math.abs(targetVideoMs - currentVideoMs);

    if (drift > SYNC_TOLERANCE_MS) {
      isInternalSeek.current = true;
      player.seek(targetVideoMs / 1000);
      const timeout = window.setTimeout(() => {
        isInternalSeek.current = false;
      }, 200);
      return () => window.clearTimeout(timeout);
    }

    if (widget.controls.autoPlay && !player.isPlaying()) {
      player.play().catch(() => undefined);
    }
  }, [playheadMs, player, widget]);
}
