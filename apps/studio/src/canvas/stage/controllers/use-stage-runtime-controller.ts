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
  const playheadMsRef = useRef(playheadMs);
  const sceneActionsRef = useRef(sceneActions);
  const timelineActionsRef = useRef(timelineActions);
  const widgetActionsRef = useRef(widgetActions);
  playheadMsRef.current = playheadMs;
  sceneActionsRef.current = sceneActions;
  timelineActionsRef.current = timelineActions;
  widgetActionsRef.current = widgetActions;

  useEffect(() => {
    if (!scene.durationMs || !isPlaying) return;

    let rafId = 0;
    let lastTimestamp: number | null = null;
    let lastSyncedMs = playheadMsRef.current;
    let previousActionPlayheadMs = playheadMsRef.current;

    playbackEngine.setCurrentMs(playheadMsRef.current);

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
        playbackEngine.flushReact();
        const fullState = fullStateRef.current;
        const nextSceneId = resolveNextSceneId(fullState, fullState.document.selection.activeSceneId);
        if (nextSceneId && nextSceneId !== fullState.document.selection.activeSceneId) {
          sceneActionsRef.current.selectScene(nextSceneId);
          timelineActionsRef.current.setPlayhead(0);
          playbackEngine.setCurrentMs(0);
          playbackEngine.flushReact();
          return;
        }
        timelineActionsRef.current.setPlayhead(scene.durationMs);
        timelineActionsRef.current.setPlaying(false);
        return;
      }

      playbackEngine.setCurrentMs(nextTime);
      const timelineEnterActions = getTimelineEnterActions(fullStateRef.current, nextTime, previousActionPlayheadMs);
      timelineEnterActions.forEach((action) => widgetActionsRef.current.executeAction(action.id));
      previousActionPlayheadMs = nextTime;
      if (nextTime - lastSyncedMs >= playbackEngine.getSyncIntervalMs()) {
        lastSyncedMs = nextTime;
      }
      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(rafId);
      timelineActionsRef.current.setPlayhead(playbackEngine.getCurrentMs());
      playbackEngine.flushReact();
    };
  }, [fullStateRef, isPlaying, scene.durationMs]);

  useEffect(() => {
    if (isPlaying) return;
    const previous = previousPlayheadRef.current;
    const timelineEnterActions = getTimelineEnterActions(fullStateRef.current, playheadMs, previous);
    timelineEnterActions.forEach((action) => widgetActionsRef.current.executeAction(action.id));
    previousPlayheadRef.current = playheadMs;
    playbackEngine.setCurrentMs(playheadMs);
    playbackEngine.flushReact();
  }, [fullStateRef, isPlaying, playheadMs]);

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
