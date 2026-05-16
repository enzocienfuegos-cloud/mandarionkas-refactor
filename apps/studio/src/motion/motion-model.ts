import type { WidgetHoverMotion, WidgetMotion, WidgetNode } from '../domain/document/types';
import { resolveMotionCurrentTime, resolveMotionElapsedMs, sanitizeMotionConfig } from './motion-engine';
import { getHoverMotionTemplate, getMotionTemplate } from './motion-registry';
import type { MotionConfig, MotionFrameState, MotionSelection, MotionTemplate } from './motion-template-contract';

const LEGACY_MOTION_TEMPLATE_IDS = new Set(['appear', 'fade-in', 'fade-up', 'fade-out', 'pulse', 'float', 'slide-in-left', 'slide-in-right', 'slide-in-up', 'slide-in-down']);
const LEGACY_HOVER_TEMPLATE_IDS = new Set(['lift', 'zoom', 'pulse']);

function normalizeTemplateConfig(template: MotionTemplate, config: MotionConfig = {}): MotionConfig {
  return sanitizeMotionConfig(template.fields, template.defaults, config);
}

function resolveLegacyMotion(widget: WidgetNode): WidgetMotion | undefined {
  const templateId = typeof widget.style.animationPreset === 'string' ? widget.style.animationPreset : '';
  if (!LEGACY_MOTION_TEMPLATE_IDS.has(templateId)) return undefined;
  return {
    templateId,
    config: {
      durationMs: Number(widget.style.animationDurationMs ?? undefined),
      delayMs: Number(widget.style.animationDelayMs ?? undefined),
      distancePx: Number(widget.style.animationDistancePx ?? undefined),
      intensity: Number(widget.style.animationIntensity ?? undefined),
      repeatMode: String(widget.style.animationRepeatMode ?? 'once'),
    },
  };
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
  const motion = widget.motion?.templateId ? widget.motion : resolveLegacyMotion(widget);
  const template = getMotionTemplate(motion?.templateId ?? null);
  if (!template || !motion?.templateId) return null;
  return {
    template,
    config: normalizeTemplateConfig(template, motion.config),
  };
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

export function buildWidgetMotion(templateId: string | null, config: MotionConfig = {}): WidgetMotion | undefined {
  if (!templateId) return undefined;
  const template = getMotionTemplate(templateId);
  if (!template) return undefined;
  return {
    templateId,
    config: normalizeTemplateConfig(template, config),
  };
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
  if (!motion?.templateId) {
    return {
      animationPreset: '',
      animationRepeatMode: 'once',
    };
  }
  return {
    animationPreset: motion.templateId,
    animationDurationMs: motion.config.durationMs,
    animationDelayMs: motion.config.delayMs,
    animationDistancePx: motion.config.distancePx,
    animationIntensity: motion.config.intensity,
    animationRepeatMode: motion.config.repeatMode ?? 'once',
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

export function computeWidgetMotionState(
  widget: WidgetNode,
  playheadMs: number,
  baseOpacity: number,
): MotionFrameState | null {
  const selection = resolveWidgetMotion(widget);
  if (!selection) return null;
  const elapsedMs = resolveMotionElapsedMs({
    playheadMs,
    timeline: widget.timeline,
    config: selection.config,
    category: selection.template.category,
  });
  return selection.template.computeState(selection.config, elapsedMs, baseOpacity);
}

export function resolveWidgetMotionCurrentTime(widget: WidgetNode, playheadMs: number): number | null {
  const selection = resolveWidgetMotion(widget);
  if (!selection) return null;
  return resolveMotionCurrentTime({
    playheadMs,
    timeline: widget.timeline,
    config: selection.config,
    category: selection.template.category,
  });
}
