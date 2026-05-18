import type { WidgetNode } from '../../domain/document/types';

export type ScratchRevealTargetMode = 'auto' | 'widget' | 'scene';

export function getScratchRevealTargetMode(group: WidgetNode): ScratchRevealTargetMode {
  const rawMode = String(group.props.revealTargetMode ?? 'auto').trim().toLowerCase();
  if (rawMode === 'widget' || rawMode === 'scene') return rawMode;
  return 'auto';
}

export function getScratchRevealTargetId(group: WidgetNode): string {
  return String(group.props.revealTargetId ?? '').trim();
}

export function isWidgetDescendantOf(targetWidgetId: string, ancestorWidgetId: string, widgetsById: Record<string, WidgetNode>): boolean {
  let currentParentId = widgetsById[targetWidgetId]?.parentId;
  const visited = new Set<string>();

  while (currentParentId && !visited.has(currentParentId)) {
    if (currentParentId === ancestorWidgetId) return true;
    visited.add(currentParentId);
    currentParentId = widgetsById[currentParentId]?.parentId;
  }

  return false;
}

export function isWidgetTargetedByScratchGroup(group: WidgetNode, widget: WidgetNode, widgetsById: Record<string, WidgetNode>): boolean {
  const mode = getScratchRevealTargetMode(group);
  const targetId = getScratchRevealTargetId(group);
  if (!targetId) return false;

  if (mode === 'scene') {
    return widget.sceneId === targetId;
  }

  if (mode === 'widget') {
    return widget.id === targetId || isWidgetDescendantOf(widget.id, targetId, widgetsById);
  }

  return false;
}

function rectsOverlap(left: WidgetNode['frame'], right: WidgetNode['frame']): boolean {
  return Number(left.x ?? 0) < Number(right.x ?? 0) + Number(right.width ?? 0)
    && Number(left.x ?? 0) + Number(left.width ?? 0) > Number(right.x ?? 0)
    && Number(left.y ?? 0) < Number(right.y ?? 0) + Number(right.height ?? 0)
    && Number(left.y ?? 0) + Number(left.height ?? 0) > Number(right.y ?? 0);
}

function isScratchCoverDescendant(group: WidgetNode, candidate: WidgetNode, widgetsById: Record<string, WidgetNode>): boolean {
  return candidate.id === group.id || isWidgetDescendantOf(candidate.id, group.id, widgetsById);
}

export function resolveScratchRevealTargets(
  group: WidgetNode,
  sceneWidgets: readonly WidgetNode[],
  widgetsById: Record<string, WidgetNode>,
): WidgetNode[] {
  const mode = getScratchRevealTargetMode(group);
  const targetId = getScratchRevealTargetId(group);

  return sceneWidgets.filter((candidate) => {
    if (isScratchCoverDescendant(group, candidate, widgetsById)) return false;

    if (mode === 'scene') {
      return Boolean(targetId) && candidate.sceneId === targetId;
    }

    if (mode === 'widget') {
      return Boolean(targetId) && (candidate.id === targetId || isWidgetDescendantOf(candidate.id, targetId, widgetsById));
    }

    if (mode !== 'auto') return false;
    if (Number(group.zIndex ?? 0) <= Number(candidate.zIndex ?? 0)) return false;
    return rectsOverlap(group.frame, candidate.frame);
  });
}

export function isRevealTargetCandidate(group: WidgetNode, candidate: WidgetNode, widgetsById: Record<string, WidgetNode>): boolean {
  if (candidate.id === group.id) return false;
  if (candidate.sceneId !== group.sceneId) return false;
  if (isWidgetDescendantOf(candidate.id, group.id, widgetsById)) return false;
  return true;
}
