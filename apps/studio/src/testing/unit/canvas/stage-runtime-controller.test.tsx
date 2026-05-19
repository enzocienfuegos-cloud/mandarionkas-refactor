import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useStageRuntimeController } from '../../../canvas/stage/controllers/use-stage-runtime-controller';
import type { StudioState } from '../../../domain/document/types';
import { playbackEngine } from '../../../hooks/use-playback-engine';

function createStateRef(activeSceneId: string): React.MutableRefObject<StudioState> {
  return {
    current: {
      document: {
        selection: { activeSceneId },
        scenes: [],
        widgets: {},
        actions: {},
      },
      ui: {},
    } as unknown as StudioState,
  };
}

function Harness({
  fullStateRef,
  sceneId,
  playheadMs,
  setPlayhead,
}: {
  fullStateRef: React.MutableRefObject<StudioState>;
  sceneId: string;
  playheadMs: number;
  setPlayhead: (ms: number) => void;
}): null {
  useStageRuntimeController({
    fullStateRef,
    scene: { id: sceneId, durationMs: 7000 },
    playheadMs,
    isPlaying: true,
    sceneActions: { selectScene: vi.fn() },
    timelineActions: { setPlayhead, setPlaying: vi.fn() },
    widgetActions: { executeAction: vi.fn() },
  });
  return null;
}

describe('useStageRuntimeController', () => {
  let renderer: ReactTestRenderer | null = null;

  beforeEach(() => {
    vi.stubGlobal('requestAnimationFrame', vi.fn(() => 1));
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    playbackEngine.setCurrentMs(0, 'seek');
    playbackEngine.flushReact('seek');
  });

  afterEach(() => {
    act(() => {
      renderer?.unmount();
    });
    renderer = null;
    vi.unstubAllGlobals();
  });

  it('does not restore the previous scene playhead when switching between same-duration scenes', () => {
    const fullStateRef = createStateRef('scene_1');
    const setPlayhead = vi.fn();

    act(() => {
      renderer = create(
        <Harness
          fullStateRef={fullStateRef}
          sceneId="scene_1"
          playheadMs={0}
          setPlayhead={setPlayhead}
        />,
      );
    });

    playbackEngine.setCurrentMs(4200, 'tick');
    fullStateRef.current = {
      ...fullStateRef.current,
      document: {
        ...fullStateRef.current.document,
        selection: {
          ...fullStateRef.current.document.selection,
          activeSceneId: 'scene_2',
        },
      },
    };

    act(() => {
      renderer?.update(
        <Harness
          fullStateRef={fullStateRef}
          sceneId="scene_2"
          playheadMs={0}
          setPlayhead={setPlayhead}
        />,
      );
    });

    expect(setPlayhead).not.toHaveBeenCalledWith(4200);
    expect(playbackEngine.getCurrentMs()).toBe(0);
  });
});
