const STAGE_INTERACTION_ATTR = 'data-stage-interaction';

export const STAGE_INTERACTION = {
  surface: 'surface',
  quickPanel: 'quick-panel',
  toolbarDragHandle: 'toolbar-drag-handle',
  floatingToolbar: 'floating-toolbar',
  selectionToolbar: 'selection-toolbar',
  systemOverlay: 'system-overlay',
  interactiveOverlay: 'interactive-overlay',
  widget: 'widget',
} as const;

export type StageInteractionRole = typeof STAGE_INTERACTION[keyof typeof STAGE_INTERACTION];

function toElement(target: EventTarget | null): Element | null {
  return target instanceof Element ? target : null;
}

function findClosestStageInteraction(target: EventTarget | null, role: StageInteractionRole): Element | null {
  const element = toElement(target);
  return element?.closest(`[${STAGE_INTERACTION_ATTR}="${role}"]`) ?? null;
}

export function createStageInteractionProps(role: StageInteractionRole): Record<typeof STAGE_INTERACTION_ATTR, StageInteractionRole> {
  return { [STAGE_INTERACTION_ATTR]: role };
}

export function isWithinStageSurfaceTarget(target: EventTarget | null): boolean {
  return Boolean(findClosestStageInteraction(target, STAGE_INTERACTION.surface));
}

export function isWithinCanvasQuickPanelTarget(target: EventTarget | null): boolean {
  return Boolean(findClosestStageInteraction(target, STAGE_INTERACTION.quickPanel));
}

export function isStageToolbarDragHandleTarget(target: EventTarget | null): boolean {
  return Boolean(findClosestStageInteraction(target, STAGE_INTERACTION.toolbarDragHandle));
}

export function isStageInteractiveOverlayTarget(target: EventTarget | null): boolean {
  return Boolean(findClosestStageInteraction(target, STAGE_INTERACTION.interactiveOverlay));
}

export function isStageWidgetTarget(target: EventTarget | null): boolean {
  return Boolean(findClosestStageInteraction(target, STAGE_INTERACTION.widget));
}
