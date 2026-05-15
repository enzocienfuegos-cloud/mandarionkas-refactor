import type { ActionNode, WidgetNode } from '../../domain/document/types';

export type RenderContext = {
  previewMode: boolean;
  playheadMs: number;
  sceneDurationMs: number;
  hovered: boolean;
  active: boolean;
  widgetsById: Record<string, WidgetNode>;
  triggerWidgetAction: (trigger: ActionNode['trigger'], metadata?: Record<string, unknown>) => void;
  executeAction?: (actionId: string) => void;
};
