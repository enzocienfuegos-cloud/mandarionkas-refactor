import gsap from 'gsap';
import { createEventClock } from '../../motion/animation-engine/clock';
import type { AnimationEngine } from '../../motion/animation-engine/engine';
import { resolveSceneExitDurationMs } from '../../motion/animation-engine/scene-exit';
import type { ExportRuntimeModel, ExportRuntimeScene, ExportRuntimeWidget } from './runtime-model';

export type SceneManager = {
  showScene(index: number): void;
  nextScene(): void;
  previousScene(): void;
  findSceneIndexById(sceneId: string): number;
  getActiveSceneIndex(): number;
  getActiveScene(): ExportRuntimeScene | null;
  getSceneElapsedMs(): number;
  dispose(): void;
};

type SceneManagerOptions = {
  runtimeModel: ExportRuntimeModel;
  engine: AnimationEngine;
};

type RuntimeWindow = Window & typeof globalThis & {
  smxRuntime?: Record<string, unknown>;
};

function nowMs(): number {
  return typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : Date.now();
}

function setSceneVisibility(sceneNodes: Element[], activeSceneIndex: number): void {
  sceneNodes.forEach((sceneNode, sceneIndex) => {
    const element = sceneNode as HTMLElement;
    element.style.display = sceneIndex === activeSceneIndex ? 'block' : 'none';
  });
}

function emitSceneEvent(
  engine: AnimationEngine,
  trigger: 'load' | 'scene-enter' | 'scene-exit',
  widgets: readonly ExportRuntimeWidget[],
  loadedWidgetIds: Set<string>,
  sceneElapsedMs: number,
): void {
  const realTimeMs = nowMs();
  widgets.forEach((widget) => {
    if (trigger === 'load') {
      if (loadedWidgetIds.has(widget.id)) return;
      loadedWidgetIds.add(widget.id);
    }
    engine.emit({
      trigger,
      sourceId: widget.id,
      targetId: widget.id,
      sceneTimeMs: sceneElapsedMs,
      realTimeMs,
      clock: createEventClock(trigger, realTimeMs, trigger === 'scene-exit' ? 'exit' : 'event'),
    });
  });
}

export function createSceneManager({ runtimeModel, engine }: SceneManagerOptions): SceneManager {
  const runtimeWindow = window as RuntimeWindow;
  const sceneNodes = Array.from(document.querySelectorAll('[data-scene-id]'));
  const loadedWidgetIds = new Set<string>();
  let activeSceneIndex = 0;
  let sceneTimer = 0;
  let transitionTimer = 0;
  let sceneStartedAtMs = nowMs();
  let transitionRevision = 0;

  const tick = (): void => {
    engine.seekScene(Math.max(0, nowMs() - sceneStartedAtMs));
  };

  const clearSceneTimer = (): void => {
    if (!sceneTimer) return;
    window.clearTimeout(sceneTimer);
    sceneTimer = 0;
  };

  const clearTransitionTimer = (): void => {
    if (!transitionTimer) return;
    window.clearTimeout(transitionTimer);
    transitionTimer = 0;
  };

  const scheduleSceneAdvance = (): void => {
    clearSceneTimer();
    const scene = runtimeModel.scenes[activeSceneIndex];
    const durationMs = Math.max(0, Number(scene?.durationMs ?? 0));
    if (!durationMs) return;
    sceneTimer = window.setTimeout(() => {
      const targetIndex = scene?.nextSceneId ? findSceneIndexById(scene.nextSceneId) : -1;
      if (targetIndex >= 0 && targetIndex !== activeSceneIndex) {
        showScene(targetIndex);
        return;
      }
      if (sceneNodes.length > 1) {
        nextScene();
      }
    }, durationMs);
  };

  const findSceneIndexById = (sceneId: string): number => sceneNodes.findIndex(
    (sceneNode) => sceneNode.getAttribute('data-scene-id') === sceneId,
  );

  const getActiveScene = (): ExportRuntimeScene | null => runtimeModel.scenes[activeSceneIndex] ?? null;
  const getSceneElapsedMs = (): number => Math.max(0, nowMs() - sceneStartedAtMs);

  const showScene = (index: number): void => {
    if (!sceneNodes.length) return;
    const nextIndex = Math.max(0, Math.min(index, sceneNodes.length - 1));
    const previousIndex = activeSceneIndex;
    const previousScene = runtimeModel.scenes[previousIndex];
    const finalizeSceneChange = (targetIndex: number, revision: number): void => {
      if (revision !== transitionRevision) return;
      activeSceneIndex = targetIndex;
      sceneStartedAtMs = nowMs();
      engine.resetEventClocks();
      engine.seekScene(0);
      setSceneVisibility(sceneNodes, activeSceneIndex);
      gsap.ticker.remove(tick);
      gsap.ticker.add(tick);
      scheduleSceneAdvance();

      const activeScene = runtimeModel.scenes[activeSceneIndex];
      if (!activeScene) return;
      emitSceneEvent(engine, 'load', activeScene.widgets, loadedWidgetIds, 0);
      emitSceneEvent(engine, 'scene-enter', activeScene.widgets, loadedWidgetIds, 0);
      // Only count real scene transitions — skip the initial showScene(0) at boot
      // (previousIndex === targetIndex on the first call) to avoid off-by-one in
      // the end card trigger scene-visit counter.
      if (targetIndex !== previousIndex) {
        window.dispatchEvent(new CustomEvent('smx:scene-change', { detail: { sceneIndex: activeSceneIndex, sceneId: activeScene.id } }));
      }
    };

    clearSceneTimer();
    clearTransitionTimer();
    transitionRevision += 1;
    const revision = transitionRevision;
    const exitDurationMs = nextIndex === previousIndex ? 0 : resolveSceneExitDurationMs(previousScene?.widgets ?? []);

    if (previousScene && nextIndex !== previousIndex) {
      emitSceneEvent(engine, 'scene-exit', previousScene.widgets, loadedWidgetIds, getSceneElapsedMs());
    }

    if (!exitDurationMs) {
      finalizeSceneChange(nextIndex, revision);
    } else {
      transitionTimer = window.setTimeout(() => {
        transitionTimer = 0;
        finalizeSceneChange(nextIndex, revision);
      }, exitDurationMs);
    }

    runtimeWindow.smxRuntime = runtimeWindow.smxRuntime ?? {};
    Object.assign(runtimeWindow.smxRuntime, {
      showScene,
      nextScene,
      previousScene,
      get activeSceneIndex() {
        return activeSceneIndex;
      },
    });
  };

  const nextScene = (): void => {
    if (!sceneNodes.length) return;
    showScene((activeSceneIndex + 1) % sceneNodes.length);
  };

  const previousScene = (): void => {
    if (!sceneNodes.length) return;
    showScene((activeSceneIndex - 1 + sceneNodes.length) % sceneNodes.length);
  };

  return {
    showScene,
    nextScene,
    previousScene,
    findSceneIndexById,
    getActiveSceneIndex: () => activeSceneIndex,
    getActiveScene,
    getSceneElapsedMs,
    dispose: () => {
      clearSceneTimer();
      clearTransitionTimer();
      gsap.ticker.remove(tick);
    },
  };
}
