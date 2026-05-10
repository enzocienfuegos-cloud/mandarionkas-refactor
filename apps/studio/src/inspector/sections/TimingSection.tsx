import { useWidgetActions } from '../../hooks/use-studio-actions';
import { createInspectorField, createInspectorSection } from '../contract-driven';
import type { WidgetNode } from '../../domain/document/types';

export function TimingSection({ widget }: { widget: WidgetNode }): JSX.Element {
  const { updateWidgetTiming } = useWidgetActions();

  return createInspectorSection({
    title: 'Timing',
    children: (
      <div className="fields-grid">
        {createInspectorField({
          kind: 'number',
          label: 'Start ms',
          value: widget.timeline.startMs,
          onChange: (value) => updateWidgetTiming(widget.id, { startMs: value }),
        })}
        {createInspectorField({
          kind: 'number',
          label: 'End ms',
          value: widget.timeline.endMs,
          onChange: (value) => updateWidgetTiming(widget.id, { endMs: value }),
        })}
      </div>
    ),
  });
}
