import { createId } from '../domain/document/factories';
import type { KeyframeNode, WidgetFrame, WidgetMotion, WidgetNode, WidgetTimeline } from '../domain/document/types';
import { markMotionManagedKeyframes, stripMotionManagedKeyframes } from './motion-managed-keyframes';
import { getMotionTemplate } from './motion-registry';

function sortKeyframes(keyframes: KeyframeNode[]): KeyframeNode[] {
  return [...keyframes].sort((left, right) => left.atMs - right.atMs);
}

function scaleOpacityTrack(keyframes: KeyframeNode[], baseOpacity: number): KeyframeNode[] {
  return keyframes.map((keyframe) => (
    keyframe.property === 'opacity'
      ? { ...keyframe, value: Math.max(0, Math.min(1, keyframe.value * baseOpacity)) }
      : keyframe
  ));
}

function ensureKeyframeIds(keyframes: KeyframeNode[]): KeyframeNode[] {
  return keyframes.map((keyframe) => ({
    ...keyframe,
    id: keyframe.id || createId('kf'),
  }));
}

export function buildMotionTemplateKeyframes(
  motion: WidgetMotion,
  widgetFrame: WidgetFrame,
  widgetTimeline: WidgetTimeline,
  baseOpacity = 1,
): KeyframeNode[] {
  if (!motion.templateId) return [];
  const template = getMotionTemplate(motion.templateId);
  if (!template) return [];
  if (template.buildCompositorMotion?.(motion.config)) return [];
  const built = template.buildKeyframes(motion.config, widgetFrame, widgetTimeline);
  return markMotionManagedKeyframes(
    ensureKeyframeIds(scaleOpacityTrack(built, baseOpacity)),
    motion.templateId,
  );
}

export function rebuildWidgetMotionKeyframes(
  widget: Pick<WidgetNode, 'frame' | 'style' | 'timeline'>,
  motion: WidgetMotion | undefined,
  currentKeyframes: KeyframeNode[] = widget.timeline.keyframes ?? [],
): KeyframeNode[] {
  const unmanaged = stripMotionManagedKeyframes(currentKeyframes);
  if (!motion?.templateId) return sortKeyframes(unmanaged);
  const generated = buildMotionTemplateKeyframes(
    motion,
    widget.frame,
    widget.timeline,
    Number(widget.style.opacity ?? 1),
  );
  return sortKeyframes([...unmanaged, ...generated]);
}
