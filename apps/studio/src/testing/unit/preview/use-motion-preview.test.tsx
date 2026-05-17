import { useRef } from 'react';
import { act, create } from 'react-test-renderer';
import { describe, expect, it, vi } from 'vitest';
import { useMotionPreview } from '../../../motion/react/use-motion-preview';
import appearTemplate from '../../../motion/templates/appear.motion';

type FakeAnimation = {
  pause: ReturnType<typeof vi.fn>;
  play: ReturnType<typeof vi.fn>;
  cancel: ReturnType<typeof vi.fn>;
  currentTime: number;
  playState: 'idle' | 'running' | 'paused';
};

function createFakeAnimation(): FakeAnimation {
  let playState: FakeAnimation['playState'] = 'idle';
  return {
    pause: vi.fn(() => {
      playState = 'paused';
    }),
    play: vi.fn(() => {
      playState = 'running';
    }),
    cancel: vi.fn(),
    currentTime: 0,
    get playState() {
      return playState;
    },
    set playState(nextState) {
      playState = nextState;
    },
  };
}

function createFakeElement(animation: FakeAnimation) {
  return {
    animate: vi.fn(() => animation),
  } as unknown as HTMLElement;
}

function Harness({
  element,
  active = false,
  scrubTimeMs = null,
}: {
  element: HTMLElement;
  active?: boolean;
  scrubTimeMs?: number | null;
}): null {
  const ref = useRef<HTMLElement | null>(element);
  ref.current = element;
  useMotionPreview({
    ref,
    template: appearTemplate,
    config: { durationMs: 700, delayMs: 0 },
    baseOpacity: 1,
    active,
    scrubTimeMs,
  });
  return null;
}

describe('useMotionPreview', () => {
  it('does not allocate an animation for idle thumbnail previews', () => {
    const animation = createFakeAnimation();
    const element = createFakeElement(animation);

    act(() => {
      create(<Harness element={element} active={false} scrubTimeMs={null} />);
    });

    expect((element.animate as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(0);
  });

  it('reuses the same animation instance while scrubbing preview playback', () => {
    const animation = createFakeAnimation();
    const element = createFakeElement(animation);

    let renderer: ReturnType<typeof create>;
    act(() => {
      renderer = create(<Harness element={element} scrubTimeMs={0} />);
    });

    expect((element.animate as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(1);
    expect(animation.currentTime).toBe(0);

    act(() => {
      renderer!.update(<Harness element={element} scrubTimeMs={320} />);
    });

    expect((element.animate as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(1);
    expect(animation.currentTime).toBe(320);
  });

  it('plays the existing animation instance for selected editor previews', () => {
    const animation = createFakeAnimation();
    const element = createFakeElement(animation);

    act(() => {
      create(<Harness element={element} active />);
    });

    expect((element.animate as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(1);
    expect(animation.play).toHaveBeenCalled();
  });

  it('does not pause the animation on every render during free playback', () => {
    const animation = createFakeAnimation();
    const element = createFakeElement(animation);

    let renderer: ReturnType<typeof create>;
    act(() => {
      renderer = create(<Harness element={element} active scrubTimeMs={null} />);
    });

    expect(animation.play).toHaveBeenCalledTimes(1);
    animation.pause.mockClear();
    animation.play.mockClear();

    for (let index = 0; index < 60; index += 1) {
      act(() => {
        renderer!.update(<Harness element={element} active scrubTimeMs={null} />);
      });
    }

    expect(animation.pause).not.toHaveBeenCalled();
    expect(animation.play).not.toHaveBeenCalled();
  });

  it('preserves currentTime when transitioning from scrub to free playback', () => {
    const animation = createFakeAnimation();
    const element = createFakeElement(animation);

    let renderer: ReturnType<typeof create>;
    act(() => {
      renderer = create(<Harness element={element} scrubTimeMs={500} />);
    });

    expect(animation.currentTime).toBe(500);
    expect(animation.playState).toBe('paused');

    act(() => {
      renderer!.update(<Harness element={element} active scrubTimeMs={null} />);
    });

    expect(animation.currentTime).toBe(500);
    expect(animation.play).toHaveBeenCalled();
  });

  it('pauses and resets to 0 in idle mode', () => {
    const animation = createFakeAnimation();
    const element = createFakeElement(animation);

    let renderer: ReturnType<typeof create>;
    act(() => {
      renderer = create(<Harness element={element} active scrubTimeMs={null} />);
    });

    act(() => {
      renderer!.update(<Harness element={element} active={false} scrubTimeMs={null} />);
    });

    expect(animation.pause).toHaveBeenCalled();
    expect(animation.currentTime).toBe(0);
  });
});
