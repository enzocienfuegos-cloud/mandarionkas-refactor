import { useEffect, type RefObject } from 'react';
import { playbackEngine } from '../hooks/use-playback-engine';

function writePlayhead(
  gridShell: HTMLElement | null,
  overview: HTMLElement | null,
  playheadMs: number,
  rowMsToPx: number,
  sceneDurationMs: number,
): void {
  gridShell?.style.setProperty('--timeline-playhead-left', `${playheadMs * rowMsToPx}px`);
  overview?.style.setProperty('--timeline-overview-playhead-left', `${(playheadMs / Math.max(1, sceneDurationMs)) * 100}%`);
}

export function useTimelinePlayhead(
  gridShellRef: RefObject<HTMLElement>,
  overviewRef: RefObject<HTMLElement>,
  playheadMs: number,
  rowMsToPx: number,
  sceneDurationMs: number,
  isPlaying: boolean,
): void {
  useEffect(() => {
    writePlayhead(gridShellRef.current, overviewRef.current, playheadMs, rowMsToPx, sceneDurationMs);
  }, [gridShellRef, overviewRef, playheadMs, rowMsToPx, sceneDurationMs]);

  useEffect(() => {
    if (!isPlaying) return undefined;
    return playbackEngine.subscribeDom((nextMs) => {
      writePlayhead(gridShellRef.current, overviewRef.current, nextMs, rowMsToPx, sceneDurationMs);
    });
  }, [gridShellRef, isPlaying, overviewRef, rowMsToPx, sceneDurationMs]);
}
