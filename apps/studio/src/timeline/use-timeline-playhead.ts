import { useEffect, useRef, type RefObject } from 'react';
import { playbackEngine } from '../hooks/use-playback-engine';

function writePlayhead(
  gridShell: HTMLElement | null,
  overview: HTMLElement | null,
  playheadMs: number,
  rowMsToPx: number,
  sceneDurationMs: number,
  overviewTrackWidthPx: number,
): void {
  const gridX = playheadMs * rowMsToPx;
  gridShell?.style.setProperty('--timeline-playhead-x', `${gridX}px`);

  const overviewProgress = playheadMs / Math.max(1, sceneDurationMs);
  const overviewX = overviewProgress * overviewTrackWidthPx;
  overview?.style.setProperty('--timeline-overview-playhead-x', `${overviewX}px`);
}

export function useTimelinePlayhead(
  gridShellRef: RefObject<HTMLElement>,
  overviewRef: RefObject<HTMLElement>,
  playheadMs: number,
  rowMsToPx: number,
  sceneDurationMs: number,
  isPlaying: boolean,
): void {
  const overviewWidthRef = useRef(0);

  useEffect(() => {
    if (typeof ResizeObserver === 'undefined') {
      overviewWidthRef.current = overviewRef.current?.clientWidth ?? 0;
      return undefined;
    }

    const updateWidth = () => {
      overviewWidthRef.current = overviewRef.current?.clientWidth ?? 0;
    };

    updateWidth();
    const observer = new ResizeObserver(updateWidth);
    if (overviewRef.current) observer.observe(overviewRef.current);
    return () => observer.disconnect();
  }, [overviewRef]);

  useEffect(() => {
    writePlayhead(
      gridShellRef.current,
      overviewRef.current,
      playheadMs,
      rowMsToPx,
      sceneDurationMs,
      overviewWidthRef.current,
    );
  }, [gridShellRef, overviewRef, playheadMs, rowMsToPx, sceneDurationMs]);

  useEffect(() => {
    if (!isPlaying) return undefined;
    return playbackEngine.subscribeDom((nextMs) => {
      writePlayhead(
        gridShellRef.current,
        overviewRef.current,
        nextMs,
        rowMsToPx,
        sceneDurationMs,
        overviewWidthRef.current,
      );
    });
  }, [gridShellRef, isPlaying, overviewRef, rowMsToPx, sceneDurationMs]);
}
