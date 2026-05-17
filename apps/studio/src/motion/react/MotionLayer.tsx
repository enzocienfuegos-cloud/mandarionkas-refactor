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
import { buildCompositorMotionSpec, toKeyframeAnimationOptions } from '../compositor-motion';
import type { CompositorMotionSpec } from '../motion-template-contract';

type MotionLayerProps = HTMLAttributes<HTMLDivElement> & {
  widget: WidgetNode;
  playheadMs: number;
  isReproducing: boolean;
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

function anchorTimelineAwareMotion(widget: WidgetNode, spec: CompositorMotionSpec): CompositorMotionSpec {
  if (widget.motion?.templateId !== 'fade-out') return spec;
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

function getInitialAnimationTime(widget: WidgetNode, playheadMs: number, startedAtMs?: number): number {
  const startMs = Number.isFinite(startedAtMs) ? Number(startedAtMs) : widget.timeline.startMs;
  return Math.max(0, playheadMs - startMs);
}

export const MotionLayer = forwardRef<HTMLDivElement, MotionLayerProps>(function MotionLayer({
  widget,
  playheadMs,
  isReproducing,
  startedAtMs,
  children,
  innerClassName = 'stage-widget-compositor-motion',
  innerStyle,
  ...outerProps
}, forwardedRef): JSX.Element {
  const outerRef = useRef<HTMLDivElement | null>(null);
  const motionTargetRef = useRef<HTMLDivElement | null>(null);
  const animationRef = useRef<Animation | null>(null);
  const motionSignature = JSON.stringify({
    motion: widget.motion ?? null,
    timeline: widget.timeline,
    isReproducing,
    startedAtMs: startedAtMs ?? null,
  });

  useLayoutEffect(() => {
    const currentAnimation = animationRef.current;
    const node = motionTargetRef.current;
    const rawSpec = buildCompositorMotionSpec(widget.motion);
    const spec = rawSpec ? anchorTimelineAwareMotion(widget, rawSpec) : null;
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

    const animation = node.animate(spec.keyframes, toKeyframeAnimationOptions(spec.options));
    animation.currentTime = getInitialAnimationTime(widget, playheadMs, startedAtMs);
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
