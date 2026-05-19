import {
  forwardRef,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  type CSSProperties,
  type HTMLAttributes,
  type ReactNode,
  type Ref,
} from 'react';
import type { WidgetNode } from '../../domain/document/types';
import { SCENE_CLOCK, createEventClock } from '../animation-engine/clock';
import type { AnimationTrigger } from '../animation-engine/events';
import type { AnimationPlan } from '../animation-engine/plan';
import { buildRevealReplayPlan, shouldReplayLoadMotionOnReveal } from '../animation-engine/reveal-replay';
import { useAnimationEngine } from '../animation-engine';

type MotionLayerProps = HTMLAttributes<HTMLDivElement> & {
  widget: WidgetNode;
  widgetsById?: Record<string, WidgetNode>;
  previewMode?: boolean;
  isReproducing: boolean;
  children: ReactNode;
  innerClassName?: string;
  innerStyle?: CSSProperties;
};

const EVENT_TRIGGERS: readonly AnimationTrigger[] = [
  'scene-enter',
  'scene-exit',
  'reveal',
  'scratch-complete',
  'click',
  'hover-enter',
  'hover-exit',
  'completion',
  'game-state',
];

function setRefValue(ref: Ref<HTMLDivElement> | undefined, value: HTMLDivElement | null): void {
  if (!ref) return;
  if (typeof ref === 'function') {
    ref(value);
    return;
  }
  (ref as { current: HTMLDivElement | null }).current = value;
}

function buildMotionSignature(plans: readonly AnimationPlan[]): string {
  if (!plans.length) return '0';
  return plans
    .map((plan) => `${plan.id}|${plan.trigger}|${plan.durationMs}|${plan.delayMs}|${plan.iterations}`)
    .join(';');
}

export const MotionLayer = forwardRef<HTMLDivElement, MotionLayerProps>(function MotionLayer({
  widget,
  widgetsById,
  previewMode = false,
  isReproducing,
  children,
  innerClassName = 'stage-widget-compositor-motion',
  innerStyle,
  ...outerProps
}, forwardedRef): JSX.Element {
  const engine = useAnimationEngine();
  const outerRef = useRef<HTMLDivElement | null>(null);
  const motionTargetRef = useRef<HTMLDivElement | null>(null);
  const planContext = useMemo(() => ({
    widgetsById: widgetsById ?? { [widget.id]: widget },
    previewMode,
  }), [
    previewMode,
    widget.id,
    widget.type,
    widget.parentId,
    widget.childIds,
    widget.props,
    widget.motion,
    widget.hoverMotion,
    widgetsById,
  ]);
  const widgetRef = useRef(widget);
  const plans = useMemo(
    () => engine.buildPlansForWidget(widget, planContext),
    [
      engine,
      planContext,
      widget.id,
      widget.type,
      widget.parentId,
      widget.childIds,
      widget.props,
      widget.motion,
      widget.hoverMotion,
      widget.timeline,
    ],
  );
  const plansRef = useRef(plans);
  const motionSignature = useMemo(() => buildMotionSignature(plans), [plans]);

  useEffect(() => {
    widgetRef.current = widget;
    plansRef.current = plans;
  }, [plans, widget]);

  useLayoutEffect(() => {
    if (!isReproducing || !motionTargetRef.current) {
      engine.cancelAllForWidget(widget.id);
      return undefined;
    }

    const unsubscribes = EVENT_TRIGGERS.map((trigger) => engine.subscribe(trigger, (event) => {
      if (!motionTargetRef.current) return;
      const matchesWidget = event.targetId === widget.id;
      if (!matchesWidget) return;
      const replayLoadPlans = shouldReplayLoadMotionOnReveal(event)
        ? plansRef.current
          .filter((plan) => plan.trigger === 'load')
          .map((plan) => buildRevealReplayPlan(plan, widgetRef.current.timeline.startMs))
        : [];
      const matchingPlans = plansRef.current
        .filter((plan) => plan.trigger === event.trigger)
        .concat(replayLoadPlans);
      matchingPlans.forEach((plan) => {
        engine.play({ node: motionTargetRef.current as Element, widget: widgetRef.current }, plan, event.clock);
      });
    }));

    return () => {
      unsubscribes.forEach((unsubscribe) => unsubscribe());
      engine.cancelAllForWidget(widget.id);
    };
  }, [engine, isReproducing, motionSignature, widget.id]);

  useLayoutEffect(() => {
    if (!isReproducing || !motionTargetRef.current) return undefined;
    plansRef.current
      .filter((plan) => plan.trigger === 'timeline')
      .forEach((plan) => {
        engine.play({ node: motionTargetRef.current as Element, widget: widgetRef.current }, plan, SCENE_CLOCK);
      });
    plansRef.current
      .filter((plan) => plan.trigger === 'load')
      .forEach((plan) => {
        engine.play(
          { node: motionTargetRef.current as Element, widget: widgetRef.current },
          plan,
          createEventClock('load', performance.now()),
        );
      });
    return undefined;
  }, [engine, isReproducing, motionSignature, widget.id]);

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
