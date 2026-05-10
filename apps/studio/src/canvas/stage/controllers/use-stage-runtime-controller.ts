import { useEffect, useRef, useState } from 'react';
import { getTimelineEnterActions } from '../../../actions/runtime';
import { resolveNextSceneId } from '../../../domain/document/resolvers';
import { playbackEngine } from '../../../hooks/use-playback-engine';

export function useStageRuntimeController(args: {
  fullStateRef: React.MutableRefObject<import('../../../domain/document/types').StudioState>;
  scene: { id: string; durationMs: number; transition?: { type?: 'cut' | 'fade' | 'slide-left' | 'slide-right'; durationMs?: number } };
  playheadMs: number;
  isPlaying: boolean;
  sceneActions: { selectScene: (sceneId: string) => void };
  timelineActions: { setPlayhead: (ms: number) => void; setPlaying: (value: boolean) => void };
  widgetActions: { executeAction: (actionId: string) => void };
}) {
  const { fullStateRef, scene, playheadMs, isPlaying, sceneActions, timelineActions, widgetActions } = args;
  const [sceneTransitionActive, setSceneTransitionActive] = useState(false);
  const previousPlayheadRef = useRef(0);
  const previousSceneIdRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (!scene.durationMs || !isPlaying) return;

    let rafId = 0;
    let lastTimestamp: number | null = null;
    let lastSyncedMs = playheadMs;
    let previousActionPlayheadMs = playheadMs;

    playbackEngine.setCurrentMs(playheadMs);

    const tick = (timestamp: number) => {
      if (lastTimestamp === null) {
        lastTimestamp = timestamp;
        rafId = requestAnimationFrame(tick);
        return;
      }

      const elapsed = timestamp - lastTimestamp;
      lastTimestamp = timestamp;

      const nextTime = Math.round(playbackEngine.getCurrentMs() + elapsed);
      if (nextTime >= scene.durationMs) {
        playbackEngine.setCurrentMs(scene.durationMs);
        const fullState = fullStateRef.current;
        const nextSceneId = resolveNextSceneId(fullState, fullState.document.selection.activeSceneId);
        if (nextSceneId && nextSceneId !== fullState.document.selection.activeSceneId) {
          sceneActions.selectScene(nextSceneId);
          timelineActions.setPlayhead(0);
          playbackEngine.setCurrentMs(0);
          return;
        }
        timelineActions.setPlayhead(scene.durationMs);
        timelineActions.setPlaying(false);
        return;
      }

      playbackEngine.setCurrentMs(nextTime);
      const timelineEnterActions = getTimelineEnterActions(fullStateRef.current, nextTime, previousActionPlayheadMs);
      timelineEnterActions.forEach((action) => widgetActions.executeAction(action.id));
      previousActionPlayheadMs = nextTime;
      if (nextTime - lastSyncedMs >= playbackEngine.getSyncIntervalMs()) {
        timelineActions.setPlayhead(nextTime);
        lastSyncedMs = nextTime;
      }
      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(rafId);
      timelineActions.setPlayhead(playbackEngine.getCurrentMs());
    };
  }, [fullStateRef, isPlaying, playheadMs, scene.durationMs, sceneActions, timelineActions, widgetActions]);

  useEffect(() => {
    if (isPlaying) return;
    const previous = previousPlayheadRef.current;
    const timelineEnterActions = getTimelineEnterActions(fullStateRef.current, playheadMs, previous);
    timelineEnterActions.forEach((action) => widgetActions.executeAction(action.id));
    previousPlayheadRef.current = playheadMs;
    playbackEngine.setCurrentMs(playheadMs);
  }, [fullStateRef, isPlaying, playheadMs, widgetActions]);

  useEffect(() => {
    const previousSceneId = previousSceneIdRef.current;
    if (!previousSceneId) {
      previousSceneIdRef.current = scene.id;
      return;
    }
    if (previousSceneId !== scene.id) {
      previousSceneIdRef.current = scene.id;
      if ((scene.transition?.type ?? 'cut') !== 'cut') {
        setSceneTransitionActive(true);
        const timeout = window.setTimeout(
          () => setSceneTransitionActive(false),
          Math.max(120, scene.transition?.durationMs ?? 450),
        );
        return () => window.clearTimeout(timeout);
      }
    }
  }, [scene.id, scene.transition?.durationMs, scene.transition?.type]);

  return { sceneTransitionActive };
}
