import {
  forwardRef,
  useLayoutEffect,
  useRef,
  type CSSProperties,
  type HTMLAttributes,
  type ReactNode,
  type Ref,
} from 'react';
import type { WidgetNode } from '../../domain/document/types';
import {
  getAnimationClockSignature,
  buildRevealAnimationPlan,
  buildTimelineAnimationPlan,
  isEventDrivenClock,
  SCENE_ANIMATION_CLOCK,
  type AnimationClock,
} from '../animation-clocks';
import { buildCompositorMotionSpec, toKeyframeAnimationOptions } from '../compositor-motion';
import { waapiAnimationAdapter, type AnimationEnginePlayback } from '../motion-engine';
import type { CompositorMotionSpec } from '../motion-template-contract';

type MotionLayerProps = HTMLAttributes<HTMLDivElement> & {
  widget: WidgetNode;
  playheadMs: number;
  isReproducing: boolean;
  clock?: AnimationClock;
  startedAtMs?: number;
  children: ReactNode;
  innerClassName?: string;
  innerStyle?: CSSProperties;
};

function setRefValue(ref: Ref<HTMLDivElement> | undefined, value: HTMLDivElement | null): void {
  if (!ref) return;
  if (typeof ref === 'function') {
    ref(value);
    return;
  }
  (ref as { current: HTMLDivElement | null }).current = value;
}

function anchorTimelineAwareMotion(widget: WidgetNode, spec: CompositorMotionSpec, clock: AnimationClock): CompositorMotionSpec {
  if (widget.motion?.templateId !== 'fade-out') return spec;
  if (isEventDrivenClock(clock)) return spec;
  const durationMs = Math.max(1, Number(spec.options.duration || 1));
  const timelineDurationMs = Math.max(0, widget.timeline.endMs - widget.timeline.startMs);
  return {
    ...spec,
    options: {
      ...spec.options,
      delay: Math.max(0, timelineDurationMs - durationMs),
    },
  };
}

function resolveMotionClock(clock: AnimationClock | undefined, startedAtMs?: number): AnimationClock {
  if (clock) return clock;
  if (Number.isFinite(startedAtMs)) {
    return {
      kind: 'event',
      trigger: 'reveal',
      startMode: 'trigger-local-zero',
      startedAtMs,
    };
  }
  return SCENE_ANIMATION_CLOCK;
}

export const MotionLayer = forwardRef<HTMLDivElement, MotionLayerProps>(function MotionLayer({
  widget,
  playheadMs,
  isReproducing,
  clock,
  startedAtMs,
  children,
  innerClassName = 'stage-widget-compositor-motion',
  innerStyle,
  ...outerProps
}, forwardedRef): JSX.Element {
  const outerRef = useRef<HTMLDivElement | null>(null);
  const motionTargetRef = useRef<HTMLDivElement | null>(null);
  const animationRef = useRef<AnimationEnginePlayback | null>(null);
  const motionClock = resolveMotionClock(clock, startedAtMs);
  const motionSignature = JSON.stringify({
    motion: widget.motion ?? null,
    timeline: widget.timeline,
    isReproducing,
    clock: getAnimationClockSignature(motionClock),
  });

  useLayoutEffect(() => {
    const currentAnimation = animationRef.current;
    const node = motionTargetRef.current;
    const rawSpec = buildCompositorMotionSpec(widget.motion);
    const spec = rawSpec ? anchorTimelineAwareMotion(widget, rawSpec, motionClock) : null;
    if (!isReproducing || !node || !spec || typeof node.animate !== 'function') {
      currentAnimation?.cancel();
      animationRef.current = null;
      return;
    }

    currentAnimation?.cancel();
    const previousWillChange = node.style.willChange;
    if (spec.willChange) {
      node.style.willChange = spec.willChange;
    }

    const plan = isEventDrivenClock(motionClock)
      ? buildRevealAnimationPlan(widget)
      : buildTimelineAnimationPlan(widget);
    if (!plan) {
      node.style.willChange = previousWillChange;
      return undefined;
    }
    const animation = waapiAnimationAdapter.play(
      node,
      spec.keyframes as Keyframe[],
      toKeyframeAnimationOptions(spec.options),
      {
        plan,
        clock: motionClock,
        sceneTimeMs: playheadMs,
        timelineStartMs: widget.timeline.startMs,
      },
    );
    if (!animation) {
      node.style.willChange = previousWillChange;
      return undefined;
    }
    animationRef.current = animation;

    return () => {
      animation.cancel();
      node.style.willChange = previousWillChange;
      if (animationRef.current === animation) {
        animationRef.current = null;
      }
    };
  }, [motionSignature]);

  return (
    <div
      {...outerProps}
      ref={(node) => {
        outerRef.current = node;
        setRefValue(forwardedRef, node);
      }}
    >
      <div
        ref={motionTargetRef}
        className={innerClassName}
        style={{
          width: '100%',
          height: '100%',
          position: 'relative',
          ...innerStyle,
        }}
      >
        {children}
      </div>
    </div>
  );
});
