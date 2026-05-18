import { usePlaybackMsLive } from '../../hooks/use-playback-engine';

export function useWidgetPlayheadMs(playheadMs: number, isReproducing: boolean | undefined): number {
  const livePlaybackMs = usePlaybackMsLive(playheadMs);
  return isReproducing ? livePlaybackMs : playheadMs;
}
