import { useCallback } from 'react';
import { isWidgetVisibleAt } from '../../../domain/document/timeline';
import type { StudioState } from '../../../domain/document/types';
import type { InteractionState } from '../stage-types';

export function useStageSelectionController(args: {
  widgetsById: StudioState['document']['widgets'];
  playheadMs: number;
  interaction: InteractionState | null;
}) {
  const { widgetsById, playheadMs, interaction } = args;

  const isWidgetVisible = useCallback((widgetId: string) => {
    const widget = widgetsById[widgetId];
    if (!widget) return false;
    return interaction ? !widget.hidden : (!widget.hidden && isWidgetVisibleAt(widget, playheadMs));
  }, [interaction, playheadMs, widgetsById]);

  return { isWidgetVisible };
}
