export type RenderContext = {
  previewMode: boolean;
  playheadMs: number;
  hovered: boolean;
  active: boolean;
  triggerWidgetAction: (trigger: 'click' | 'hover') => void;
  executeAction?: (actionId: string) => void;
};
