import { useRef } from 'react';
import { act, create } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useMotionPreview } from '../../../motion/react/use-motion-preview';
import appearTemplate from '../../../motion/templates/appear.motion';

type FakeTimeline = {
  id: number;
  set: ReturnType<typeof vi.fn>;
  to: ReturnType<typeof vi.fn>;
  pause: ReturnType<typeof vi.fn>;
  play: ReturnType<typeof vi.fn>;
  kill: ReturnType<typeof vi.fn>;
  seek: ReturnType<typeof vi.fn>;
  isActive: ReturnType<typeof vi.fn>;
};

const timelineFactory = vi.fn();
const timelines: FakeTimeline[] = [];

vi.mock('gsap', () => ({
  default: {
    timeline: (...args: unknown[]) => timelineFactory(...args),
  },
}));

function createFakeTimeline(): FakeTimeline {
  const timeline: FakeTimeline = {
    id: timelines.length + 1,
    set: vi.fn(),
    to: vi.fn(),
    pause: vi.fn(),
    play: vi.fn(),
    kill: vi.fn(),
    seek: vi.fn(),
    isActive: vi.fn(() => false),
  };
  timeline.set.mockReturnValue(timeline);
  timeline.to.mockReturnValue(timeline);
  timeline.pause.mockReturnValue(timeline);
  timeline.play.mockReturnValue(timeline);
  timeline.seek.mockReturnValue(timeline);
  timelines.push(timeline);
  return timeline;
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
  beforeEach(() => {
    timelines.length = 0;
    timelineFactory.mockReset();
    timelineFactory.mockImplementation(() => createFakeTimeline());
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('does not allocate a GSAP timeline for idle thumbnail previews', () => {
    const element = {} as HTMLElement;

    act(() => {
      create(<Harness element={element} active={false} scrubTimeMs={null} />);
    });

    expect(timelineFactory).not.toHaveBeenCalled();
  });

  it('reuses the same GSAP timeline while scrubbing preview playback', () => {
    const element = {} as HTMLElement;

    let renderer: ReturnType<typeof create>;
    act(() => {
      renderer = create(<Harness element={element} scrubTimeMs={0} />);
    });

    expect(timelineFactory).toHaveBeenCalledTimes(1);
    expect(timelines[0]?.seek).toHaveBeenLastCalledWith(0);

    act(() => {
      renderer!.update(<Harness element={element} scrubTimeMs={320} />);
    });

    expect(timelineFactory).toHaveBeenCalledTimes(1);
    expect(timelines[0]?.seek).toHaveBeenLastCalledWith(0.32);
  });

  it('plays the existing GSAP timeline for selected editor previews', () => {
    const element = {} as HTMLElement;

    act(() => {
      create(<Harness element={element} active />);
    });

    expect(timelineFactory).toHaveBeenCalledTimes(1);
    expect(timelines[0]?.play).toHaveBeenCalled();
  });

  it('does not pause the timeline on every render during free playback', () => {
    const element = {} as HTMLElement;

    let renderer: ReturnType<typeof create>;
    act(() => {
      renderer = create(<Harness element={element} active scrubTimeMs={null} />);
    });

    timelines[0]?.pause.mockClear();
    timelines[0]?.play.mockClear();

    for (let index = 0; index < 60; index += 1) {
      act(() => {
        renderer!.update(<Harness element={element} active scrubTimeMs={null} />);
      });
    }

    expect(timelineFactory).toHaveBeenCalledTimes(1);
    expect(timelines[0]?.pause).not.toHaveBeenCalled();
    expect(timelines[0]?.play).not.toHaveBeenCalled();
  });

  it('preserves seeked time when transitioning from scrub to free playback', () => {
    const element = {} as HTMLElement;

    let renderer: ReturnType<typeof create>;
    act(() => {
      renderer = create(<Harness element={element} scrubTimeMs={500} />);
    });

    expect(timelines[0]?.seek).toHaveBeenLastCalledWith(0.5);

    act(() => {
      renderer!.update(<Harness element={element} active scrubTimeMs={null} />);
    });

    expect(timelineFactory).toHaveBeenCalledTimes(1);
    expect(timelines[0]?.play).toHaveBeenCalled();
  });

  it('pauses and resets to 0 in idle mode', () => {
    const element = {} as HTMLElement;

    let renderer: ReturnType<typeof create>;
    act(() => {
      renderer = create(<Harness element={element} active scrubTimeMs={null} />);
    });

    act(() => {
      renderer!.update(<Harness element={element} active={false} scrubTimeMs={null} />);
    });

    expect(timelines[0]?.pause).toHaveBeenCalledWith(0);
  });
});
