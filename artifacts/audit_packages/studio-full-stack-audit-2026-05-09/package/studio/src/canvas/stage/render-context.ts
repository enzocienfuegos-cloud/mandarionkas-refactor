import type { ActionNode } from '../../domain/document/types';

export type RenderContext = {
  previewMode: boolean;
  playheadMs: number;
  sceneDurationMs: number;
  hovered: boolean;
  active: boolean;
  triggerWidgetAction: (trigger: ActionNode['trigger'], metadata?: Record<string, unknown>) => void;
  executeAction?: (actionId: string) => void;
};
