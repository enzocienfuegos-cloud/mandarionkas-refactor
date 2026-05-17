import type { ActionNode, StudioState, WidgetNode } from '../../domain/document/types';

export type RenderContext = {
  previewMode: boolean;
  isReproducing?: boolean;
  playheadMs: number;
  sceneDurationMs: number;
  hovered: boolean;
  active: boolean;
  widgetsById: Record<string, WidgetNode>;
  state?: StudioState;
  triggerWidgetAction: (trigger: ActionNode['trigger'], metadata?: Record<string, unknown>) => void;
  executeAction?: (actionId: string) => void;
};
