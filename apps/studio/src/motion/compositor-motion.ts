import type { WidgetMotion } from '../domain/document/types';
import type { CompositorMotionOptions, CompositorMotionSpec } from './motion-template-contract';
import { getMotionTemplate } from './motion-registry';

function isLegacyMotionSlotCandidate(value: unknown): value is { templateId: string; config: Record<string, number | string> } {
  return Boolean(
    value
      && typeof value === 'object'
      && 'templateId' in value
      && typeof (value as { templateId?: unknown }).templateId === 'string'
      && 'config' in value
      && typeof (value as { config?: unknown }).config === 'object'
      && (value as { config?: unknown }).config !== null,
  );
}

function resolvePrimaryMotionSlot(motion: WidgetMotion | null | undefined) {
  if (isLegacyMotionSlotCandidate(motion)) {
    return motion;
  }
  return motion?.enter ?? motion?.idle ?? motion?.exit;
}

function cloneCompositorMotionSpec(spec: CompositorMotionSpec | null | undefined): CompositorMotionSpec | null {
  if (!spec || !Array.isArray(spec.keyframes) || spec.keyframes.length === 0) return null;
  return {
    keyframes: spec.keyframes.map((keyframe) => ({ ...keyframe })),
    options: { ...spec.options },
    willChange: spec.willChange,
  };
}

export function buildCompositorMotionSpec(motion: WidgetMotion | null | undefined): CompositorMotionSpec | null {
  const slot = resolvePrimaryMotionSlot(motion);
  if (!slot?.templateId) return null;
  const template = getMotionTemplate(slot.templateId);
  if (!template) return null;
  return cloneCompositorMotionSpec(template.buildCompositorMotion(slot.config));
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
