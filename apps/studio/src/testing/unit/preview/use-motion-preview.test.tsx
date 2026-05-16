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
};

function createFakeAnimation(): FakeAnimation {
  return {
    pause: vi.fn(),
    play: vi.fn(),
    cancel: vi.fn(),
    currentTime: 0,
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
    baseTransform: 'rotate(0deg)',
    active,
    scrubTimeMs,
  });
  return null;
}

describe('useMotionPreview', () => {
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
});
