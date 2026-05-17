import { useEffect } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { studioStore, replaceStudioState } from '../../../core/store/studio-store';
import { createInitialState, createScene } from '../../../domain/document/factories';
import type { StudioState, WidgetMotion, WidgetNode } from '../../../domain/document/types';
import { useSceneActions } from '../../../hooks/use-studio-actions';
import { AnimationEngineProvider } from '../../../motion/animation-engine/react';
import { GsapAnimationEngine } from '../../../motion/animation-engine/gsap-engine';

type SceneActions = ReturnType<typeof useSceneActions>;

function createWidget(id: string, sceneId: string, motion?: WidgetMotion): WidgetNode {
  return {
    id,
    type: 'text',
    name: id,
    sceneId,
    zIndex: 1,
    frame: { x: 0, y: 0, width: 120, height: 40, rotation: 0 },
    props: { text: id },
    style: { opacity: 1 },
    motion,
    timeline: { startMs: 0, endMs: 1500 },
  };
}

function buildStateForSceneTransition(): { state: StudioState; sourceSceneId: string; targetSceneId: string } {
  const state = createInitialState();
  const sourceScene = { ...state.document.scenes[0] };
  const targetScene = { ...createScene(1, 'Scene 2'), order: 1 };
  const exitMotion: WidgetMotion = {
    exit: {
      templateId: 'fade-out',
      trigger: 'scene-exit',
      config: { delayMs: 60, durationMs: 240 },
    },
  };
  const sourceWidget = createWidget('widget_source', sourceScene.id, exitMotion);
  const targetWidget = createWidget('widget_target', targetScene.id);

  sourceScene.widgetIds = [sourceWidget.id];
  targetScene.widgetIds = [targetWidget.id];

  state.document.scenes = [sourceScene, targetScene];
  state.document.widgets = {
    [sourceWidget.id]: sourceWidget,
    [targetWidget.id]: targetWidget,
  };
  state.document.selection.activeSceneId = sourceScene.id;
  state.ui.previewMode = true;
  state.ui.isPlaying = true;
  state.ui.playheadMs = 180;

  return { state, sourceSceneId: sourceScene.id, targetSceneId: targetScene.id };
}

function HookHarness({ onReady }: { onReady: (actions: SceneActions) => void }): null {
  const actions = useSceneActions();

  useEffect(() => {
    onReady(actions);
  }, [actions, onReady]);

  return null;
}

describe('useSceneActions', () => {
  let renderer: ReactTestRenderer | null = null;
  let actions: SceneActions | null = null;
  let emitSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.useFakeTimers();
    emitSpy = vi.spyOn(GsapAnimationEngine.prototype, 'emit').mockImplementation(() => {});
    actions = null;
  });

  afterEach(() => {
    renderer?.unmount();
    renderer = null;
    emitSpy.mockRestore();
    replaceStudioState(createInitialState());
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it('waits for scene-exit motion before switching scenes during preview playback', () => {
    const { state, sourceSceneId, targetSceneId } = buildStateForSceneTransition();
    studioStore.replaceState(state);

    act(() => {
      renderer = create(
        <AnimationEngineProvider>
          <HookHarness onReady={(value) => { actions = value; }} />
        </AnimationEngineProvider>,
      );
    });

    expect(actions).not.toBeNull();

    act(() => {
      actions!.selectScene(targetSceneId);
    });

    expect(emitSpy).toHaveBeenCalledTimes(1);
    expect(emitSpy).toHaveBeenCalledWith(expect.objectContaining({
      trigger: 'scene-exit',
      sourceId: 'widget_source',
      targetId: 'widget_source',
      sceneTimeMs: 180,
    }));
    expect(studioStore.getState().document.selection.activeSceneId).toBe(sourceSceneId);

    act(() => {
      vi.advanceTimersByTime(299);
    });

    expect(studioStore.getState().document.selection.activeSceneId).toBe(sourceSceneId);

    act(() => {
      vi.advanceTimersByTime(1);
    });

    expect(studioStore.getState().document.selection.activeSceneId).toBe(targetSceneId);
    expect(studioStore.getState().ui.playheadMs).toBe(0);
  });

  it('switches scenes immediately outside preview playback', () => {
    const { state, sourceSceneId, targetSceneId } = buildStateForSceneTransition();
    state.ui.previewMode = false;
    state.ui.isPlaying = false;
    studioStore.replaceState(state);

    act(() => {
      renderer = create(
        <AnimationEngineProvider>
          <HookHarness onReady={(value) => { actions = value; }} />
        </AnimationEngineProvider>,
      );
    });

    expect(actions).not.toBeNull();

    act(() => {
      actions!.selectScene(targetSceneId);
    });

    expect(emitSpy).not.toHaveBeenCalled();
    expect(studioStore.getState().document.selection.activeSceneId).not.toBe(sourceSceneId);
    expect(studioStore.getState().document.selection.activeSceneId).toBe(targetSceneId);
  });
});
