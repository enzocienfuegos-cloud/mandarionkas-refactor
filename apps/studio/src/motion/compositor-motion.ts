import type { WidgetMotion } from '../domain/document/types';
import type { CompositorMotionOptions, CompositorMotionSpec } from './motion-template-contract';
import { getMotionTemplate } from './motion-registry';

function cloneCompositorMotionSpec(spec: CompositorMotionSpec | null | undefined): CompositorMotionSpec | null {
  if (!spec || !Array.isArray(spec.keyframes) || spec.keyframes.length === 0) return null;
  return {
    keyframes: spec.keyframes.map((keyframe) => ({ ...keyframe })),
    options: { ...spec.options },
    willChange: spec.willChange,
  };
}

export function buildCompositorMotionSpec(motion: WidgetMotion | null | undefined): CompositorMotionSpec | null {
  if (!motion?.templateId) return null;
  const template = getMotionTemplate(motion.templateId);
  if (!template?.buildCompositorMotion) return null;
  return cloneCompositorMotionSpec(template.buildCompositorMotion(motion.config));
}

export function toKeyframeAnimationOptions(options: CompositorMotionOptions): KeyframeAnimationOptions {
  return {
    duration: Math.max(1, Number(options.duration || 1)),
    delay: Math.max(0, Number(options.delay || 0)),
    easing: options.easing || 'linear',
    iterations: options.iterations === 'infinite'
      ? Number.POSITIVE_INFINITY
      : Math.max(0, Number(options.iterations ?? 1)),
    fill: options.fill ?? 'both',
  };
}
