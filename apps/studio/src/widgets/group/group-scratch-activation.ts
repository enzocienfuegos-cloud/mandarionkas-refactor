import type { WidgetNode } from '../../domain/document/types';
import { resolveWidgetMotionSelection } from '../../motion/motion-model';

export type ScratchActivationMode = 'delay' | 'after-motion';

export function getScratchActivationMode(group: WidgetNode): ScratchActivationMode {
  const rawMode = String(group.props.scratchActivationMode ?? 'delay').trim();
  return rawMode === 'after-motion' ? 'after-motion' : 'delay';
}

function getMotionWindowMs(widget: WidgetNode): number {
  const selection = resolveWidgetMotionSelection(widget);
  if (!selection) return 0;
  const durationMs = Math.max(0, Number(selection.config.durationMs ?? 700));
  const delayMs = Math.max(0, Number(selection.config.delayMs ?? 0));
  return delayMs + durationMs;
}

export function getScratchActivationDelayMs(
  group: WidgetNode,
  widgetsById: Record<string, WidgetNode>,
): number {
  const customDelayMs = Math.max(0, Number(group.props.scratchActivationDelayMs ?? 0));
  if (getScratchActivationMode(group) === 'delay') return customDelayMs;

  const visited = new Set<string>();
  let maxMotionWindowMs = 0;

  function visit(widget: WidgetNode | undefined): void {
    if (!widget || visited.has(widget.id)) return;
    visited.add(widget.id);
    maxMotionWindowMs = Math.max(maxMotionWindowMs, getMotionWindowMs(widget));
    (widget.childIds ?? []).forEach((childId) => visit(widgetsById[childId]));
  }

  visit(group);
  return maxMotionWindowMs + customDelayMs;
}

export function isScratchGroupActive(args: {
  group: WidgetNode;
  widgetsById: Record<string, WidgetNode>;
  playheadMs: number;
}): boolean {
  const { group, widgetsById, playheadMs } = args;
  if (!group.props.scratchEnabled) return false;
  const activationAtMs = group.timeline.startMs + getScratchActivationDelayMs(group, widgetsById);
  return playheadMs >= activationAtMs;
}
