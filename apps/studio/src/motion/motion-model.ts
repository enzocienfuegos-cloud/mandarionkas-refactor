import type { MotionReplayPolicy, MotionSlot, WidgetHoverMotion, WidgetMotion, WidgetNode } from '../domain/document/types';
import type { AnimationTrigger } from './animation-engine/events';
import { DEFAULT_REPLAY_POLICY, type ReplayPolicy } from './animation-engine/replay-policy';
import { sanitizeMotionConfig } from './motion-engine';
import { getHoverMotionTemplate, getMotionTemplate } from './motion-registry';
import type { MotionConfig, MotionSelection, MotionTemplate } from './motion-template-contract';

const LEGACY_MOTION_TEMPLATE_IDS = new Set(['appear', 'fade-in', 'fade-up', 'fade-out', 'pulse', 'float', 'slide-in-left', 'slide-in-right', 'slide-in-up', 'slide-in-down']);
const LEGACY_HOVER_TEMPLATE_IDS = new Set(['lift', 'zoom', 'pulse']);
const LOOP_TEMPLATE_IDS = new Set(['float', 'pulse']);
type LegacyWidgetMotionShape = {
  templateId: string | null;
  config: MotionConfig;
};

export type MotionPhase = 'enter' | 'idle' | 'exit';
export type MotionSelectionWithPhase = MotionSelection & {
  phase: MotionPhase;
  trigger: AnimationTrigger;
  replayPolicy: ReplayPolicy;
};

function normalizeTemplateConfig(template: MotionTemplate, config: MotionConfig = {}): MotionConfig {
  return sanitizeMotionConfig(template.fields, template.defaults, config);
}

function resolveLegacyMotion(widget: WidgetNode): WidgetMotion | undefined {
  const templateId = typeof widget.style.animationPreset === 'string' ? widget.style.animationPreset : '';
  if (!LEGACY_MOTION_TEMPLATE_IDS.has(templateId)) return undefined;
  return buildWidgetMotion(templateId, {
    durationMs: Number(widget.style.animationDurationMs ?? undefined),
    delayMs: Number(widget.style.animationDelayMs ?? undefined),
    distancePx: Number(widget.style.animationDistancePx ?? undefined),
    intensity: Number(widget.style.animationIntensity ?? undefined),
    repeatMode: String(widget.style.animationRepeatMode ?? 'once'),
  }, { trigger: 'timeline' });
}

function isLegacyWidgetMotionShape(motion: unknown): motion is LegacyWidgetMotionShape {
  return Boolean(
    motion
      && typeof motion === 'object'
      && 'templateId' in motion
      && !('enter' in (motion as Record<string, unknown>))
      && !('idle' in (motion as Record<string, unknown>))
      && !('exit' in (motion as Record<string, unknown>)),
  );
}

function resolveLegacyHoverMotion(widget: WidgetNode): WidgetHoverMotion | undefined {
  const templateId = typeof widget.style.hoverMotionPreset === 'string' ? widget.style.hoverMotionPreset : '';
  if (!LEGACY_HOVER_TEMPLATE_IDS.has(templateId)) return undefined;
  return {
    templateId,
    config: {
      durationMs: Number(widget.style.hoverMotionDurationMs ?? undefined),
      distancePx: Number(widget.style.hoverMotionDistancePx ?? undefined),
      scale: Number(widget.style.hoverMotionScale ?? undefined),
    },
  };
}

export function resolveWidgetMotion(widget: WidgetNode): MotionSelection | null {
  const selection = resolveWidgetMotionSelection(widget);
  if (!selection) return null;
  return {
    template: selection.template,
    config: selection.config,
  };
}

export function resolveWidgetMotionSelection(widget: WidgetNode): MotionSelectionWithPhase | null {
  const motion = isLegacyWidgetMotionShape(widget.motion)
    ? buildWidgetMotion(widget.motion.templateId, widget.motion.config, { trigger: 'timeline' })
    : widget.motion ?? resolveLegacyMotion(widget);
  if (!motion) return null;
  const candidates: Array<[MotionPhase, MotionSlot | undefined]> = [
    ['enter', motion.enter],
    ['idle', motion.idle],
    ['exit', motion.exit],
  ];
  for (const [phase, slot] of candidates) {
    if (!slot) continue;
    const template = getMotionTemplate(slot.templateId);
    if (!template) continue;
    return {
      template,
      config: normalizeTemplateConfig(template, slot.config),
      phase,
      trigger: slot.trigger,
      replayPolicy: slot.replayPolicy ?? DEFAULT_REPLAY_POLICY,
    };
  }
  return null;
}

export function resolveWidgetHoverMotion(widget: WidgetNode): MotionSelection | null {
  const hoverMotion = widget.hoverMotion?.templateId ? widget.hoverMotion : resolveLegacyHoverMotion(widget);
  const template = getHoverMotionTemplate(hoverMotion?.templateId ?? null);
  if (!template || !hoverMotion?.templateId) return null;
  return {
    template,
    config: normalizeTemplateConfig(template, hoverMotion.config),
  };
}

function resolvePhaseForTemplate(templateId: string, template: MotionTemplate): MotionPhase {
  if (template.category === 'idle' || LOOP_TEMPLATE_IDS.has(templateId)) return 'idle';
  if (template.category === 'exit' || templateId === 'fade-out') return 'exit';
  return 'enter';
}

function buildMotionSlot(
  templateId: string,
  config: MotionConfig,
  options: {
    trigger?: AnimationTrigger;
    replayPolicy?: MotionReplayPolicy;
    phase?: MotionPhase;
  } = {},
): { phase: MotionPhase; slot: MotionSlot } | null {
  const template = getMotionTemplate(templateId);
  if (!template) return null;
  const phase = options.phase ?? resolvePhaseForTemplate(templateId, template);
  const trigger = options.trigger ?? 'load';
  return {
    phase,
    slot: {
      templateId,
      config: normalizeTemplateConfig(template, config),
      trigger,
      replayPolicy: options.replayPolicy,
    },
  };
}

export function buildWidgetMotion(
  templateId: string | null,
  config: MotionConfig = {},
  options: {
    trigger?: AnimationTrigger;
    replayPolicy?: MotionReplayPolicy;
    phase?: MotionPhase;
  } = {},
): WidgetMotion | undefined {
  if (!templateId) return undefined;
  const built = buildMotionSlot(templateId, config, options);
  if (!built) return undefined;
  return { [built.phase]: built.slot };
}

export function buildWidgetHoverMotion(templateId: string | null, config: MotionConfig = {}): WidgetHoverMotion | undefined {
  if (!templateId) return undefined;
  const template = getHoverMotionTemplate(templateId);
  if (!template) return undefined;
  return {
    templateId,
    config: normalizeTemplateConfig(template, config),
  };
}

export function buildLegacyMotionStylePatch(motion?: WidgetMotion): Record<string, unknown> {
  const selection = motion ? resolveMotionSelectionFromValue(motion) : null;
  if (!selection) {
    return {
      animationPreset: '',
      animationRepeatMode: 'once',
    };
  }
  return {
    animationPreset: selection.slot.templateId,
    animationDurationMs: selection.slot.config.durationMs,
    animationDelayMs: selection.slot.config.delayMs,
    animationDistancePx: selection.slot.config.distancePx,
    animationIntensity: selection.slot.config.intensity,
    animationRepeatMode: selection.slot.config.repeatMode ?? 'once',
  };
}

export function buildLegacyHoverMotionStylePatch(hoverMotion?: WidgetHoverMotion): Record<string, unknown> {
  if (!hoverMotion?.templateId) {
    return { hoverMotionPreset: 'none' };
  }
  return {
    hoverMotionPreset: hoverMotion.templateId,
    hoverMotionDurationMs: hoverMotion.config.durationMs,
    hoverMotionDistancePx: hoverMotion.config.distancePx,
    hoverMotionScale: hoverMotion.config.scale,
  };
}

function resolveMotionSelectionFromValue(motion: WidgetMotion): { phase: MotionPhase; slot: MotionSlot } | null {
  if (isLegacyWidgetMotionShape(motion)) {
    const legacyMotion = buildWidgetMotion(motion.templateId, motion.config, { trigger: 'timeline' });
    return legacyMotion ? resolveMotionSelectionFromValue(legacyMotion) : null;
  }
  const candidates: Array<[MotionPhase, MotionSlot | undefined]> = [
    ['enter', motion.enter],
    ['idle', motion.idle],
    ['exit', motion.exit],
  ];
  for (const [phase, slot] of candidates) {
    if (slot) return { phase, slot };
  }
  return null;
}

export function cloneWidgetMotion(motion?: WidgetMotion): WidgetMotion | undefined {
  if (!motion) return undefined;
  if (isLegacyWidgetMotionShape(motion)) {
    return buildWidgetMotion(motion.templateId, motion.config, { trigger: 'timeline' });
  }
  return {
    enter: motion.enter ? { ...motion.enter, config: { ...motion.enter.config } } : undefined,
    idle: motion.idle ? { ...motion.idle, config: { ...motion.idle.config } } : undefined,
    exit: motion.exit ? { ...motion.exit, config: { ...motion.exit.config } } : undefined,
  };
}
